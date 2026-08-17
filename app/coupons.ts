import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { coupons } from "../db/schema";

export function cleanCouponCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);
}

export function cleanMobile(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}

export function masterActor() {
  return (process.env.MASTER_ADMIN_EMAIL || "master-admin").trim().toLowerCase();
}

export async function getEligibleCoupon(mobileValue: string, codeValue: string) {
  const mobile = cleanMobile(mobileValue);
  const code = cleanCouponCode(codeValue);
  if (!code) return { coupon: null, error: "" };

  const db = await getDb();
  const rows = await db.select().from(coupons).where(and(
    eq(coupons.code, code),
    eq(coupons.mobile, mobile),
  )).limit(1);
  const coupon = rows[0];
  if (!coupon) return { coupon: null, error: "Coupon Code is mobile number ke liye valid nahi hai" };

  const now = new Date();
  const startAt = new Date(coupon.startAt);
  const expiresAt = new Date(coupon.expiresAt);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(expiresAt.getTime())) {
    return { coupon: null, error: "Coupon date setup invalid hai" };
  }
  if (now < startAt) return { coupon: null, error: "Coupon abhi active nahi hua hai" };
  if (now > expiresAt) return { coupon: null, error: "Coupon expire ho chuka hai" };
  if (coupon.status === "paused") return { coupon: null, error: "Coupon abhi paused hai" };
  if (coupon.status === "used") return { coupon: null, error: "Coupon pehle hi use ho chuka hai" };
  if (coupon.status === "reserved") {
    const reservedUntil = new Date(coupon.reservedUntil);
    if (!Number.isNaN(reservedUntil.getTime()) && reservedUntil > now) {
      return { coupon: null, error: "Coupon ka payment already process mein hai. 15 minute baad retry kijiye." };
    }
    await db.update(coupons).set({
      status: "active",
      reservedUntil: "",
      reservedOrderRef: "",
      updatedAt: now.toISOString(),
    }).where(eq(coupons.id, coupon.id));
    return {
      coupon: { ...coupon, status: "active" as const, reservedUntil: "", reservedOrderRef: "" },
      error: "",
    };
  }
  return { coupon, error: "" };
}

