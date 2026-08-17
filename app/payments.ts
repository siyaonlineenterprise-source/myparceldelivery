import { and, eq, gt } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getDb } from "../db";
import { hashIp, requestIp } from "./ip-security";
import { coupons, paymentOrders, vendorSessions, vendorSubscriptions, vendors } from "../db/schema";

export const planCatalog = {
  Trial: { monthlyVideoCredits: 35, retentionDays: 7, durationDays: 7, baseAmountPaise: 9_900 },
  Nano: { monthlyVideoCredits: 150, retentionDays: 30, durationDays: 30, baseAmountPaise: 18_800 },
  Starter: { monthlyVideoCredits: 1500, retentionDays: 30, durationDays: 30, baseAmountPaise: 150_000 },
  Growth: { monthlyVideoCredits: 3000, retentionDays: 30, durationDays: 30, baseAmountPaise: 255_000 },
} as const;

export type PlanName = keyof typeof planCatalog;

export function isPlanName(value: string): value is PlanName {
  return Object.hasOwn(planCatalog, value);
}

export function planAmounts(planName: PlanName, userLimit = 1, extraUserRatePaise = 9900) {
  const plan = planCatalog[planName];
  const safeUserLimit = Math.max(1, Math.min(100, Math.round(userLimit)));
  const safeUserRate = Math.max(0, Math.round(extraUserRatePaise));
  const userChargePaise = Math.max(0, safeUserLimit - 1) * safeUserRate;
  const baseAmountPaise = plan.baseAmountPaise + userChargePaise;
  const gstAmountPaise = Math.round(baseAmountPaise * 18 / 100);
  return { ...plan, baseAmountPaise, userLimit: safeUserLimit, extraUserRatePaise: safeUserRate, userChargePaise, gstAmountPaise, totalAmountPaise: baseAmountPaise + gstAmountPaise };
}

export function discountedPlanAmounts(planName: PlanName, discountPercent = 0, userLimit = 1, extraUserRatePaise = 9900) {
  const original = planAmounts(planName, userLimit, extraUserRatePaise);
  const safePercent = Math.max(0, Math.min(100, Math.round(discountPercent)));
  const discountedBaseAmountPaise = Math.round(original.baseAmountPaise * (100 - safePercent) / 100);
  const gstAmountPaise = Math.round(discountedBaseAmountPaise * 18 / 100);
  const totalAmountPaise = discountedBaseAmountPaise + gstAmountPaise;
  return {
    ...original,
    baseAmountPaise: discountedBaseAmountPaise,
    gstAmountPaise,
    totalAmountPaise,
    originalTotalAmountPaise: original.totalAmountPaise,
    discountPercent: safePercent,
    discountAmountPaise: original.totalAmountPaise - totalAmountPaise,
  };
}

export async function vendorHasUsedTrial(vendorId: number) {
  const db = await getDb();
  const rows = await db.select({ id: paymentOrders.id }).from(paymentOrders)
    .where(and(
      eq(paymentOrders.vendorId, vendorId),
      eq(paymentOrders.planName, "Trial"),
      eq(paymentOrders.status, "paid"),
    ))
    .limit(1);
  return rows.length > 0;
}

export async function authenticatedVendor(request: NextRequest) {
  const token = request.cookies.get("mpd_vendor_session")?.value;
  if (!token) return null;
  const db = await getDb();
  const rows = await db.select({
    vendorId: vendors.id,
    businessName: vendors.businessName,
    contactName: vendors.contactName,
    mobile: vendors.mobile,
    status: vendors.status,
    userLimit: vendors.userLimit,
    extraUserRatePaise: vendors.extraUserRatePaise,
    ipPolicyBlocked: vendors.ipPolicyBlocked,
  })
    .from(vendorSessions)
    .innerJoin(vendors, eq(vendorSessions.vendorId, vendors.id))
    .where(and(
      eq(vendorSessions.token, token),
      eq(vendorSessions.ipHash, await hashIp(requestIp(request))),
      gt(vendorSessions.expiresAt, new Date().toISOString()),
    ))
    .limit(1);
  return rows[0]?.status === "active" && !rows[0]?.ipPolicyBlocked ? rows[0] : null;
}

export async function activateSubscription(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  receivedAmountPaise?: number,
  providerStatus = "captured",
) {
  const db = await getDb();
  const rows = await db.select().from(paymentOrders)
    .where(eq(paymentOrders.razorpayOrderId, razorpayOrderId))
    .limit(1);
  const order = rows[0];
  if (!order) return null;
  if (order.status === "paid") return order;

  const startsAt = new Date();
  const endsAt = new Date(startsAt);
  const plan = isPlanName(order.planName) ? planCatalog[order.planName] : planCatalog.Starter;
  endsAt.setUTCDate(endsAt.getUTCDate() + plan.durationDays);
  const paidAt = startsAt.toISOString();
  const received = receivedAmountPaise ?? order.totalAmountPaise;
  const reconciliationStatus = received === order.totalAmountPaise
    ? "matched"
    : received < order.totalAmountPaise
      ? "short"
      : "excess";

  await db.update(paymentOrders).set({
    razorpayPaymentId,
    receivedAmountPaise: received,
    providerStatus,
    reconciliationStatus,
    reconciledAt: paidAt,
    status: "paid",
    paidAt,
  }).where(eq(paymentOrders.id, order.id));

  if (order.couponId) {
    await db.update(coupons).set({
      status: "used",
      reservedUntil: "",
      reservedOrderRef: order.razorpayOrderId,
      usedAt: paidAt,
      updatedAt: paidAt,
    }).where(eq(coupons.id, order.couponId));
  }

  await db.insert(vendorSubscriptions).values({
    vendorId: order.vendorId,
    planName: order.planName,
    monthlyVideoCredits: order.monthlyVideoCredits,
    userLimit: order.userLimit,
    extraUserRatePaise: order.extraUserRatePaise,
    retentionDays: order.retentionDays,
    baseAmountPaise: order.baseAmountPaise,
    gstAmountPaise: order.gstAmountPaise,
    totalAmountPaise: order.totalAmountPaise,
    razorpayPaymentId,
    status: "active",
    startsAt: paidAt,
    endsAt: endsAt.toISOString(),
    updatedAt: paidAt,
  }).onConflictDoUpdate({
    target: vendorSubscriptions.vendorId,
    set: {
      planName: order.planName,
      monthlyVideoCredits: order.monthlyVideoCredits,
      userLimit: order.userLimit,
      extraUserRatePaise: order.extraUserRatePaise,
      retentionDays: order.retentionDays,
      baseAmountPaise: order.baseAmountPaise,
      gstAmountPaise: order.gstAmountPaise,
      totalAmountPaise: order.totalAmountPaise,
      razorpayPaymentId,
      status: "active",
      startsAt: paidAt,
      endsAt: endsAt.toISOString(),
      updatedAt: paidAt,
    },
  });
  return {
    ...order,
    status: "paid" as const,
    razorpayPaymentId,
    receivedAmountPaise: received,
    providerStatus,
    reconciliationStatus,
    paidAt,
  };
}

export async function hmacSha256Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function timingSafeHexEqual(left: string, right: string) {
  if (left.length !== right.length || left.length % 2 !== 0) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}
