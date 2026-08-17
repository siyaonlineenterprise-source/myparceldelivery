import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { paymentOrders } from "../../../../db/schema";
import { activateSubscription, authenticatedVendor, hmacSha256Hex, timingSafeHexEqual } from "../../../payments";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  const vendor = await authenticatedVendor(request);
  if (!vendor) return NextResponse.json({ error: "Vendor login required" }, { status: 401 });
  const keyId = process.env.RAZORPAY_KEY_ID || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
  if (!keyId || !keySecret) return NextResponse.json({ error: "Payment verification setup incomplete" }, { status: 503 });

  const body = await request.json() as {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  const orderId = String(body.razorpay_order_id || "");
  const paymentId = String(body.razorpay_payment_id || "");
  const receivedSignature = String(body.razorpay_signature || "");
  if (!orderId || !paymentId || !receivedSignature) {
    return NextResponse.json({ error: "Payment response incomplete hai" }, { status: 400 });
  }

  const db = await getDb();
  const rows = await db.select().from(paymentOrders).where(and(
    eq(paymentOrders.razorpayOrderId, orderId),
    eq(paymentOrders.vendorId, vendor.vendorId),
  )).limit(1);
  const order = rows[0];
  if (!order) return NextResponse.json({ error: "Payment order match nahi hua" }, { status: 404 });

  const expectedSignature = await hmacSha256Hex(keySecret, `${order.razorpayOrderId}|${paymentId}`);
  if (!timingSafeHexEqual(expectedSignature, receivedSignature)) {
    return NextResponse.json({ error: "Payment signature invalid hai" }, { status: 400 });
  }

  const paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}` },
  });
  const payment = await paymentResponse.json() as {
    id?: string;
    order_id?: string;
    amount?: number;
    currency?: string;
    status?: string;
  };
  const genuinePayment = paymentResponse.ok
    && payment.id === paymentId
    && payment.order_id === order.razorpayOrderId
    && payment.amount === order.totalAmountPaise
    && payment.currency === "INR"
    && payment.status === "captured";
  if (!genuinePayment) {
    return NextResponse.json({ error: "Payment abhi captured/verified nahi hai. Dobara check kijiye." }, { status: 409 });
  }

  await activateSubscription(order.razorpayOrderId, paymentId, payment.amount, payment.status);
  return NextResponse.json({
    ok: true,
    message: `${order.planName} plan payment verified aur activate ho gaya`,
    planName: order.planName,
  });
}
