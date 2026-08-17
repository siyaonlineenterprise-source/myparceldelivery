import { NextRequest, NextResponse } from "next/server";
import { desc, eq, like } from "drizzle-orm";
import { getDb } from "../../../db";
import { paymentOrders, vendors } from "../../../db/schema";
import { hasMasterSession } from "../../master-auth";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  if (!await hasMasterSession(request)) {
    return NextResponse.json({ error: "Master login required" }, { status: 401 });
  }
  const db = await getDb();
  const payments = await db.select({
    id: paymentOrders.id,
    vendorId: paymentOrders.vendorId,
    vendorName: vendors.businessName,
    vendorCode: vendors.vendorCode,
    mobile: vendors.mobile,
    planName: paymentOrders.planName,
    originalTotalAmountPaise: paymentOrders.originalTotalAmountPaise,
    discountPercent: paymentOrders.discountPercent,
    discountAmountPaise: paymentOrders.discountAmountPaise,
    couponCode: paymentOrders.couponCode,
    expectedAmountPaise: paymentOrders.totalAmountPaise,
    receivedAmountPaise: paymentOrders.receivedAmountPaise,
    razorpayOrderId: paymentOrders.razorpayOrderId,
    razorpayPaymentId: paymentOrders.razorpayPaymentId,
    providerStatus: paymentOrders.providerStatus,
    status: paymentOrders.status,
    createdAt: paymentOrders.createdAt,
    paidAt: paymentOrders.paidAt,
  }).from(paymentOrders)
    .innerJoin(vendors, eq(paymentOrders.vendorId, vendors.id))
    .where(like(paymentOrders.razorpayOrderId, "order_%"))
    .orderBy(desc(paymentOrders.id))
    .limit(2000);
  const response = NextResponse.json({ payments });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
