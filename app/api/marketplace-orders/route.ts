import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, gt } from "drizzle-orm";
import { getDb } from "../../../db";
import { hashIp, requestIp } from "../../ip-security";
import { marketplaceOrders, vendorSessions, vendors } from "../../../db/schema";

export const runtime = "edge";

function privateJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Cookie");
  return response;
}

function indiaDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function trackingKey(value: string) {
  return value.trim().toUpperCase();
}

async function vendorFromRequest(request: NextRequest) {
  const token = request.cookies.get("mpd_vendor_session")?.value;
  if (!token) return null;
  const db = await getDb();
  const rows = await db.select({ vendorId: vendors.id, status: vendors.status })
    .from(vendorSessions)
    .innerJoin(vendors, eq(vendorSessions.vendorId, vendors.id))
    .where(and(eq(vendorSessions.token, token),
      eq(vendorSessions.ipHash, await hashIp(requestIp(request))), gt(vendorSessions.expiresAt, new Date().toISOString())))
    .limit(1);
  return rows[0]?.status === "active" ? rows[0] : null;
}

export async function GET(request: NextRequest) {
  const vendor = await vendorFromRequest(request);
  if (!vendor) return privateJson({ error: "Active vendor login required" }, { status: 401 });
  const db = await getDb();
  const date = request.nextUrl.searchParams.get("date") || indiaDate();
  const orders = await db.select({
    id: marketplaceOrders.id,
    marketplace: marketplaceOrders.marketplace,
    orderId: marketplaceOrders.orderId,
    trackingId: marketplaceOrders.trackingId,
    deliveryPartner: marketplaceOrders.deliveryPartner,
    bagId: marketplaceOrders.bagId,
    labelUrl: marketplaceOrders.labelUrl,
    paymentMode: marketplaceOrders.paymentMode,
    orderAmountPaise: marketplaceOrders.orderAmountPaise,
    marketplaceStatus: marketplaceOrders.marketplaceStatus,
    packingStatus: marketplaceOrders.packingStatus,
    packedAt: marketplaceOrders.packedAt,
  })
    .from(marketplaceOrders)
    .where(and(eq(marketplaceOrders.vendorId, vendor.vendorId), eq(marketplaceOrders.orderDate, date)))
    .orderBy(asc(marketplaceOrders.id))
    .limit(500);
  return privateJson({ date, orders });
}

export async function POST(request: NextRequest) {
  const vendor = await vendorFromRequest(request);
  if (!vendor) return privateJson({ error: "Active vendor login required" }, { status: 401 });
  const body = await request.json() as {
    orders?: Array<{
      marketplace?: string;
      orderId?: string;
      trackingId?: string;
      deliveryPartner?: string;
      customerName?: string;
      customerAddress?: string;
      customerPincode?: string;
      labelUrl?: string;
      paymentMode?: string;
      orderAmountPaise?: number;
      marketplaceStatus?: string;
      orderDate?: string;
    }>;
  };
  const incoming = Array.isArray(body.orders) ? body.orders.slice(0, 500) : [];
  if (!incoming.length) return privateJson({ error: "Order list required hai" }, { status: 400 });

  const db = await getDb();
  let synced = 0;
  for (const order of incoming) {
    const originalTrackingId = String(order.trackingId || "").trim();
    const customerPincode = String(order.customerPincode || "").trim();
    if (!originalTrackingId || !/^\d{6}$/.test(customerPincode)) continue;
    const now = new Date().toISOString();
    const sharedValues = {
      marketplace: String(order.marketplace || "Meesho").trim().slice(0, 40),
      orderId: String(order.orderId || "").trim().slice(0, 120),
      trackingId: originalTrackingId.slice(0, 160),
      deliveryPartner: String(order.deliveryPartner || "Pending").trim().slice(0, 60) || "Pending",
      customerName: String(order.customerName || "").trim().slice(0, 160),
      customerAddress: String(order.customerAddress || "").trim().slice(0, 1000),
      customerPincode,
      labelUrl: String(order.labelUrl || "").trim().slice(0, 1000),
      paymentMode: String(order.paymentMode || "").trim().slice(0, 40),
      orderAmountPaise: Math.max(0, Math.round(Number(order.orderAmountPaise || 0))),
      marketplaceStatus: String(order.marketplaceStatus || "").trim().slice(0, 80),
      orderDate: String(order.orderDate || indiaDate()).trim().slice(0, 10),
      updatedAt: now,
    };
    await db.insert(marketplaceOrders).values({
      vendorId: vendor.vendorId,
      trackingKey: trackingKey(originalTrackingId).slice(0, 160),
      ...sharedValues,
    }).onConflictDoUpdate({
      target: [marketplaceOrders.vendorId, marketplaceOrders.trackingKey],
      set: sharedValues,
    });
    synced += 1;
  }
  return privateJson({ ok: true, synced });
}
