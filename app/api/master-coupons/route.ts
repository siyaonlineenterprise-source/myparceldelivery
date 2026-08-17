import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { coupons, deletedCoupons } from "../../../db/schema";
import { cleanCouponCode, cleanMobile, masterActor } from "../../coupons";
import { hasMasterSession } from "../../master-auth";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  if (!await hasMasterSession(request)) {
    return NextResponse.json({ error: "Master login required" }, { status: 401 });
  }
  const db = await getDb();
  const [activeCoupons, archivedCoupons] = await Promise.all([
    db.select().from(coupons).orderBy(desc(coupons.id)).limit(1000),
    db.select().from(deletedCoupons).orderBy(desc(deletedCoupons.id)).limit(1000),
  ]);
  const response = NextResponse.json({ coupons: activeCoupons, deletedCoupons: archivedCoupons });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export async function POST(request: NextRequest) {
  if (!await hasMasterSession(request)) {
    return NextResponse.json({ error: "Master login required" }, { status: 401 });
  }
  const body = await request.json() as {
    code?: string;
    mobile?: string;
    discountPercent?: number;
    startAt?: string;
    expiresAt?: string;
  };
  const code = cleanCouponCode(String(body.code || ""));
  const mobile = cleanMobile(String(body.mobile || ""));
  const discountPercent = Math.round(Number(body.discountPercent));
  const startAt = new Date(String(body.startAt || ""));
  const expiresAt = new Date(String(body.expiresAt || ""));
  if (code.length < 3) return NextResponse.json({ error: "Coupon Code kam se kam 3 characters ka rakhiye" }, { status: 400 });
  if (!/^[6-9]\d{9}$/.test(mobile)) return NextResponse.json({ error: "Sahi 10-digit mobile number enter kijiye" }, { status: 400 });
  if (!Number.isInteger(discountPercent) || discountPercent < 1 || discountPercent > 100) {
    return NextResponse.json({ error: "Discount Percentage 1 se 100 ke beech rakhiye" }, { status: 400 });
  }
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(expiresAt.getTime()) || expiresAt <= startAt) {
    return NextResponse.json({ error: "Start aur Expiry Date/Time sahi select kijiye" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const created = await db.insert(coupons).values({
      code,
      mobile,
      discountPercent,
      startAt: startAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      createdBy: masterActor(),
    }).returning();
    return NextResponse.json({ ok: true, coupon: created[0] }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ye Coupon Code pehle se use ho raha hai" }, { status: 409 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!await hasMasterSession(request)) {
    return NextResponse.json({ error: "Master login required" }, { status: 401 });
  }
  const body = await request.json() as { id?: number; action?: "pause" | "resume" };
  if (!Number.isInteger(body.id) || !["pause", "resume"].includes(String(body.action))) {
    return NextResponse.json({ error: "Invalid coupon update" }, { status: 400 });
  }
  const db = await getDb();
  const rows = await db.select().from(coupons).where(eq(coupons.id, Number(body.id))).limit(1);
  const coupon = rows[0];
  if (!coupon) return NextResponse.json({ error: "Coupon nahi mila" }, { status: 404 });
  if (coupon.status === "used") return NextResponse.json({ error: "Used coupon ko resume nahi kar sakte" }, { status: 409 });
  if (coupon.status === "reserved" && body.action === "pause") {
    return NextResponse.json({ error: "Coupon payment process mein hai; 15 minute baad pause kijiye" }, { status: 409 });
  }
  const nextStatus = body.action === "pause" ? "paused" : "active";
  await db.update(coupons).set({
    status: nextStatus,
    reservedUntil: nextStatus === "active" ? "" : coupon.reservedUntil,
    reservedOrderRef: nextStatus === "active" ? "" : coupon.reservedOrderRef,
    updatedAt: new Date().toISOString(),
  }).where(eq(coupons.id, coupon.id));
  return NextResponse.json({ ok: true, status: nextStatus });
}

export async function DELETE(request: NextRequest) {
  if (!await hasMasterSession(request)) {
    return NextResponse.json({ error: "Master login required" }, { status: 401 });
  }
  const body = await request.json() as { id?: number; reason?: string };
  if (!Number.isInteger(body.id)) return NextResponse.json({ error: "Invalid coupon delete" }, { status: 400 });
  const db = await getDb();
  const rows = await db.select().from(coupons).where(eq(coupons.id, Number(body.id))).limit(1);
  const coupon = rows[0];
  if (!coupon) return NextResponse.json({ error: "Coupon active list mein nahi mila" }, { status: 404 });
  if (coupon.status === "reserved") {
    return NextResponse.json({ error: "Coupon payment process mein hai; 15 minute baad delete kijiye" }, { status: 409 });
  }
  const deletedAt = new Date().toISOString();
  const archived = await db.insert(deletedCoupons).values({
    couponId: coupon.id,
    code: coupon.code,
    mobile: coupon.mobile,
    discountPercent: coupon.discountPercent,
    startAt: coupon.startAt,
    expiresAt: coupon.expiresAt,
    finalStatus: coupon.status,
    reservedUntil: coupon.reservedUntil,
    usedAt: coupon.usedAt,
    originalCreatedAt: coupon.createdAt,
    createdBy: coupon.createdBy,
    deletedAt,
    deletedBy: masterActor(),
    deleteReason: String(body.reason || "Deleted from Master Panel").trim().slice(0, 240),
  }).returning({ id: deletedCoupons.id });
  await db.delete(coupons).where(eq(coupons.id, coupon.id));
  return NextResponse.json({ ok: true, archivedId: archived[0]?.id, deletedAt });
}
