import { NextRequest, NextResponse } from "next/server";
import { and, eq, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { customerVideoViews, parcels } from "../../../db/schema";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const parcelId = String(request.nextUrl.searchParams.get("parcelId") || "").trim().toUpperCase();
  if (!parcelId) {
    return NextResponse.json({ error: "Tracking ID ya Bag ID required hai" }, { status: 400 });
  }

  const db = await getDb();
  const rows = await db.select({
    trackingId: parcels.trackingId,
    bagId: parcels.bagId,
  }).from(parcels)
    .where(or(eq(parcels.trackingId, parcelId), eq(parcels.bagId, parcelId)))
    .limit(1);

  const parcel = rows[0];
  if (!parcel) {
    return NextResponse.json({ error: "Tracking ID ya Bag ID record mein nahi mila" }, { status: 404 });
  }

  return NextResponse.json({ parcel });
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    parcelId?: string;
    pincode?: string;
  };
  const parcelId = String(body.parcelId || "").trim().toUpperCase();
  const enteredPincode = String(body.pincode || "").trim();

  if (!parcelId || !/^\d{6}$/.test(enteredPincode)) {
    return NextResponse.json({ error: "Tracking ID aur 6-digit label pincode sahi enter kijiye" }, { status: 400 });
  }

  const db = await getDb();
  const rows = await db.select({
    id: parcels.id,
    vendorId: parcels.vendorId,
    trackingId: parcels.trackingId,
    bagId: parcels.bagId,
    deliveryPartner: parcels.deliveryPartner,
    videoUrl: parcels.videoUrl,
    pincode: parcels.pincode,
  }).from(parcels)
    .where(or(eq(parcels.trackingId, parcelId), eq(parcels.bagId, parcelId)))
    .limit(1);
  const parcel = rows[0];
  if (!parcel) {
    return NextResponse.json({ error: "Tracking ID ya Bag ID record mein nahi mila" }, { status: 404 });
  }
  if (!/^\d{6}$/.test(parcel.pincode)) {
    return NextResponse.json({ error: "Is parcel ka shipping-label pincode abhi sync nahi hua" }, { status: 409 });
  }
  if (enteredPincode !== parcel.pincode) {
    return NextResponse.json({ error: "Label par likha pincode match nahi hua. Video locked hai." }, { status: 403 });
  }

  const verificationKey = `PIN-${enteredPincode}`;
  const existingView = await db.select({ id: customerVideoViews.id }).from(customerVideoViews)
    .where(and(eq(customerVideoViews.parcelId, parcel.id), eq(customerVideoViews.customerMobile, verificationKey)))
    .limit(1);
  if (!existingView[0]) {
    await db.insert(customerVideoViews).values({
      parcelId: parcel.id,
      vendorId: parcel.vendorId,
      customerMobile: verificationKey,
    });
  }

  return NextResponse.json({
    parcel: {
      trackingId: parcel.trackingId,
      bagId: parcel.bagId,
      deliveryPartner: parcel.deliveryPartner,
      videoUrl: parcel.videoUrl,
    },
  });
}
