import { NextRequest, NextResponse } from "next/server";
import { activateSubscription, hmacSha256Hex, timingSafeHexEqual } from "../../../payments";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
  if (!secret) return NextResponse.json({ error: "Webhook setup incomplete" }, { status: 503 });

  const rawBody = await request.text();
  const receivedSignature = request.headers.get("x-razorpay-signature") || "";
  const expectedSignature = await hmacSha256Hex(secret, rawBody);
  if (!timingSafeHexEqual(expectedSignature, receivedSignature)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody) as {
    event?: string;
    payload?: {
      payment?: { entity?: { id?: string; order_id?: string; status?: string; amount?: number } };
      order?: { entity?: { id?: string; status?: string } };
    };
  };
  if (event.event === "order.paid" || event.event === "payment.captured") {
    const payment = event.payload?.payment?.entity;
    const orderId = payment?.order_id || event.payload?.order?.entity?.id || "";
    if (orderId && payment?.id && payment.status === "captured") {
      await activateSubscription(orderId, payment.id, payment.amount, payment.status);
    }
  }
  return NextResponse.json({ ok: true });
}
