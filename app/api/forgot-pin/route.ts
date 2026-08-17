import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { pinResetRequests, vendors } from "../../../db/schema";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  const body = await request.json() as { vendorCode?: string };
  const vendorCode = String(body.vendorCode || "").trim().toUpperCase();
  if (!vendorCode) return NextResponse.json({ error: "Vendor ID enter kijiye" }, { status: 400 });
  const db = await getDb();
  const rows = await db.select({ id: vendors.id }).from(vendors).where(and(eq(vendors.vendorCode, vendorCode), eq(vendors.status, "active"))).limit(1);
  if (!rows[0]) return NextResponse.json({ error: "Active Vendor ID nahi mili" }, { status: 404 });
  const existing = await db.select({ id: pinResetRequests.id }).from(pinResetRequests).where(and(eq(pinResetRequests.vendorId, rows[0].id), eq(pinResetRequests.status, "pending"))).limit(1);
  if (!existing[0]) await db.insert(pinResetRequests).values({ vendorId: rows[0].id });
  return NextResponse.json({ ok: true, message: "PIN reset request Master Admin ko bhej di gayi." });
}
