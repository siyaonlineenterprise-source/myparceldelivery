import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { coupons, paymentOrders } from "../../../../db/schema";
import { cleanCouponCode, getEligibleCoupon } from "../../../coupons";
import { activateSubscription, authenticatedVendor, discountedPlanAmounts, isPlanName, vendorHasUsedTrial } from "../../../payments";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  const vendor = await authenticatedVendor(request);
  if (!vendor) return NextResponse.json({ error: "Vendor login required" }, { status: 401 });

  const keyId = process.env.RAZORPAY_KEY_ID || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";

  const body = await request.json() as { plan?: string; couponCode?: string };
  const planName = String(body.plan || "");
  if (!isPlanName(planName)) return NextResponse.json({ error: "Valid plan select kijiye" }, { status: 400 });
  if (planName === "Trial" && await vendorHasUsedTrial(vendor.vendorId)) {
    return NextResponse.json({
      error: "7-Day Trial is vendor account par pehle hi use ho chuka hai. Regular plan select kijiye.",
    }, { status: 409 });
  }
  const couponCode = cleanCouponCode(String(body.couponCode || ""));
  const couponResult = couponCode ? await getEligibleCoupon(vendor.mobile, couponCode) : { coupon: null, error: "" };
  if (couponResult.error) return NextResponse.json({ error: couponResult.error }, { status: 409 });
  const coupon = couponResult.coupon;
  const amounts = discountedPlanAmounts(planName, coupon?.discountPercent || 0, vendor.userLimit, vendor.extraUserRatePaise);
  const receipt = `MPD-${vendor.vendorId}-${Date.now()}`.slice(0, 40);
  const db = await getDb();

  if (coupon) {
    const reservedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const reserved = await db.update(coupons).set({
      status: "reserved",
      reservedUntil,
      reservedOrderRef: receipt,
      updatedAt: new Date().toISOString(),
    }).where(and(
      eq(coupons.id, coupon.id),
      eq(coupons.status, "active"),
    )).returning({ id: coupons.id });
    if (!reserved[0]) {
      return NextResponse.json({ error: "Coupon ab available nahi hai. Dobara verify kijiye." }, { status: 409 });
    }
  }

  if (amounts.totalAmountPaise === 0 && coupon) {
    const internalOrderId = `coupon_${coupon.id}_${Date.now()}`;
    await db.insert(paymentOrders).values({
      vendorId: vendor.vendorId,
      planName,
      monthlyVideoCredits: amounts.monthlyVideoCredits,
      userLimit: amounts.userLimit,
      extraUserRatePaise: amounts.extraUserRatePaise,
      retentionDays: amounts.retentionDays,
      baseAmountPaise: amounts.baseAmountPaise,
      gstAmountPaise: amounts.gstAmountPaise,
      totalAmountPaise: 0,
      originalTotalAmountPaise: amounts.originalTotalAmountPaise,
      discountPercent: amounts.discountPercent,
      discountAmountPaise: amounts.discountAmountPaise,
      couponId: coupon.id,
      couponCode: coupon.code,
      razorpayOrderId: internalOrderId,
      providerStatus: "coupon-free",
    });
    await activateSubscription(internalOrderId, `coupon:${coupon.code}`, 0, "coupon-free");
    return NextResponse.json({
      freeActivation: true,
      planName,
      message: `${coupon.discountPercent}% coupon verified. ${planName} plan activate ho gaya.`,
      ...amounts,
      currency: "INR",
    });
  }

  if (!keyId || !keySecret) {
    if (coupon) {
      await db.update(coupons).set({
        status: "active",
        reservedUntil: "",
        reservedOrderRef: "",
        updatedAt: new Date().toISOString(),
      }).where(eq(coupons.id, coupon.id));
    }
    return NextResponse.json({ error: "Online payment setup abhi complete nahi hai" }, { status: 503 });
  }

  const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amounts.totalAmountPaise,
      currency: "INR",
      receipt,
      notes: {
        mpd_vendor_id: String(vendor.vendorId),
        mpd_plan: planName,
        gst_rate: "18%",
        coupon_code: coupon?.code || "",
        discount_percent: String(amounts.discountPercent),
      },
    }),
  });

  const razorpayOrder = await razorpayResponse.json() as { id?: string; error?: { description?: string } };
  if (!razorpayResponse.ok || !razorpayOrder.id) {
    if (coupon) {
      await db.update(coupons).set({
        status: "active",
        reservedUntil: "",
        reservedOrderRef: "",
        updatedAt: new Date().toISOString(),
      }).where(eq(coupons.id, coupon.id));
    }
    return NextResponse.json({ error: razorpayOrder.error?.description || "Payment order create nahi hua" }, { status: 502 });
  }

  await db.insert(paymentOrders).values({
    vendorId: vendor.vendorId,
    planName,
    monthlyVideoCredits: amounts.monthlyVideoCredits,
    userLimit: amounts.userLimit,
    extraUserRatePaise: amounts.extraUserRatePaise,
    retentionDays: amounts.retentionDays,
    baseAmountPaise: amounts.baseAmountPaise,
    gstAmountPaise: amounts.gstAmountPaise,
    totalAmountPaise: amounts.totalAmountPaise,
    originalTotalAmountPaise: amounts.originalTotalAmountPaise,
    discountPercent: amounts.discountPercent,
    discountAmountPaise: amounts.discountAmountPaise,
    couponId: coupon?.id,
    couponCode: coupon?.code || "",
    razorpayOrderId: razorpayOrder.id,
  });
  if (coupon) {
    await db.update(coupons).set({
      reservedOrderRef: razorpayOrder.id,
      updatedAt: new Date().toISOString(),
    }).where(eq(coupons.id, coupon.id));
  }

  return NextResponse.json({
    keyId,
    orderId: razorpayOrder.id,
    planName,
    businessName: vendor.businessName,
    contactName: vendor.contactName,
    mobile: vendor.mobile,
    ...amounts,
    couponCode: coupon?.code || "",
    currency: "INR",
  });
}
