import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gt, or, sql } from "drizzle-orm";
import { hasMasterSession } from "../../master-auth";
import { getDb } from "../../../db";
import { hashIp, requestIp } from "../../ip-security";
import { marketplaceOrders, parcels, vendorSessions, vendors } from "../../../db/schema";

export const runtime = "edge";

function privateJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Cookie");
  return response;
}

async function vendorFromRequest(request: NextRequest) {
  const token = request.cookies.get("mpd_vendor_session")?.value;
  if (!token) return null;
  const db = await getDb();
  const rows = await db.select({ vendorId: vendors.id, status: vendors.status })
    .from(vendorSessions).innerJoin(vendors, eq(vendorSessions.vendorId, vendors.id))
    .where(and(eq(vendorSessions.token, token),
      eq(vendorSessions.ipHash, await hashIp(requestIp(request))), gt(vendorSessions.expiresAt, new Date().toISOString()))).limit(1);
  return rows[0]?.status === "active" ? rows[0] : null;
}

export async function GET(request: NextRequest) {
  const db = await getDb();
  const masterRequest = request.headers.get("x-mpd-panel") === "master";
  const master = masterRequest && await hasMasterSession(request);
  const vendor = masterRequest ? null : await vendorFromRequest(request);
  if (masterRequest && !master) return privateJson({ error: "Master login required" }, { status: 401 });
  if (!masterRequest && !vendor) return privateJson({ error: "Vendor login required" }, { status: 401 });
  const rows = masterRequest
    ? await db.select({
      id: parcels.id, vendorId: parcels.vendorId, trackingId: parcels.trackingId, bagId: parcels.bagId,
      uploadStatus: parcels.uploadStatus, videoUrl: parcels.videoUrl, customerName: parcels.customerName,
      customerMobile: parcels.customerMobile, pincode: parcels.pincode, deliveryPartner: parcels.deliveryPartner,
      createdAt: parcels.createdAt, vendorName: vendors.businessName, vendorCode: vendors.vendorCode,
    }).from(parcels).innerJoin(vendors, eq(parcels.vendorId, vendors.id)).orderBy(desc(parcels.id)).limit(250)
    : await db.select({
      id: parcels.id,
      trackingId: parcels.trackingId,
      bagId: parcels.bagId,
      uploadStatus: parcels.uploadStatus,
      videoUrl: parcels.videoUrl,
      createdAt: parcels.createdAt,
    }).from(parcels).where(eq(parcels.vendorId, vendor!.vendorId)).orderBy(desc(parcels.id)).limit(100);
  return privateJson({ parcels: rows });
}

export async function POST(request: NextRequest) {
  const vendor = await vendorFromRequest(request);
  if (!vendor) return NextResponse.json({ error: "Active vendor login required" }, { status: 401 });
  const body = await request.json() as { trackingId?: string; bagId?: string; deliveryPartner?: string };
  const trackingId = String(body.trackingId || "").trim().toUpperCase();
  const bagId = String(body.bagId || "").trim().toUpperCase();
  const selectedDeliveryPartner = String(body.deliveryPartner || "").trim().slice(0, 60);
  if (!trackingId || !bagId) return NextResponse.json({ error: "Tracking ID aur Bag ID required hain" }, { status: 400 });
  if (trackingId === bagId) return NextResponse.json({ error: "Tracking ID aur Bag ID same nahi ho sakte" }, { status: 400 });
  const db = await getDb();
  const duplicate = await db.select({
    id: parcels.id,
    vendorId: parcels.vendorId,
    trackingId: parcels.trackingId,
    bagId: parcels.bagId,
    uploadStatus: parcels.uploadStatus,
    videoUrl: parcels.videoUrl,
  }).from(parcels)
    .where(or(eq(parcels.trackingId, trackingId), eq(parcels.bagId, bagId), eq(parcels.trackingId, bagId), eq(parcels.bagId, trackingId))).limit(2);
  if (duplicate[0]) {
    const sameVendorParcel = duplicate.length === 1 && duplicate[0].vendorId === vendor.vendorId;
    const recordingIncomplete = sameVendorParcel
      && duplicate[0].uploadStatus !== "uploaded"
      && !duplicate[0].videoUrl;
    const exactSameParcel = sameVendorParcel
      && duplicate[0].trackingId === trackingId
      && duplicate[0].bagId === bagId;
    if (recordingIncomplete || exactSameParcel) {
      const matchingOrder = await db.select({
        customerName: marketplaceOrders.customerName,
        customerPincode: marketplaceOrders.customerPincode,
        deliveryPartner: marketplaceOrders.deliveryPartner,
      })
        .from(marketplaceOrders)
        .where(and(eq(marketplaceOrders.vendorId, vendor.vendorId), eq(marketplaceOrders.trackingKey, trackingId)))
        .limit(1);
      const now = new Date().toISOString();
      await db.batch([
        db.update(marketplaceOrders).set({ bagId, packingStatus: "packed", packedAt: now, updatedAt: now })
          .where(and(eq(marketplaceOrders.vendorId, vendor.vendorId), eq(marketplaceOrders.trackingKey, trackingId))),
        db.update(parcels).set({
          trackingId,
          bagId,
          customerName: matchingOrder[0]?.customerName || "",
          pincode: matchingOrder[0]?.customerPincode || "",
          deliveryPartner: selectedDeliveryPartner && selectedDeliveryPartner !== "Auto"
            ? selectedDeliveryPartner
            : matchingOrder[0]?.deliveryPartner || "Pending",
          updatedAt: now,
        })
          .where(and(eq(parcels.id, duplicate[0].id), eq(parcels.vendorId, vendor.vendorId))),
      ]);
      return NextResponse.json({
        ok: true,
        id: duplicate[0].id,
        existing: true,
        resumed: recordingIncomplete,
        marketplaceMatched: Boolean(matchingOrder[0]),
      });
    }
    return NextResponse.json({
      error: exactSameParcel
        ? "Is parcel ki packing video pehle se complete hai"
        : "Ye Tracking ID ya Bag ID pehle se kisi completed parcel mein use ho chuki hai",
    }, { status: 409 });
  }
  const matchingOrder = await db.select({
    customerName: marketplaceOrders.customerName,
    customerPincode: marketplaceOrders.customerPincode,
    deliveryPartner: marketplaceOrders.deliveryPartner,
  })
    .from(marketplaceOrders)
    .where(and(eq(marketplaceOrders.vendorId, vendor.vendorId), eq(marketplaceOrders.trackingKey, trackingId)))
    .limit(1);
  const now = new Date().toISOString();
  await db.batch([
    db.insert(parcels).values({
      vendorId: vendor.vendorId,
      trackingId,
      bagId,
      customerName: matchingOrder[0]?.customerName || "",
      pincode: matchingOrder[0]?.customerPincode || "",
      deliveryPartner: selectedDeliveryPartner && selectedDeliveryPartner !== "Auto"
        ? selectedDeliveryPartner
        : matchingOrder[0]?.deliveryPartner || "Pending",
    }),
    db.update(vendors).set({ parcelCount: sql`${vendors.parcelCount} + 1` }).where(eq(vendors.id, vendor.vendorId)),
    db.update(marketplaceOrders).set({ bagId, packingStatus: "packed", packedAt: now, updatedAt: now })
      .where(and(eq(marketplaceOrders.vendorId, vendor.vendorId), eq(marketplaceOrders.trackingKey, trackingId))),
  ]);
  const inserted = await db.select({ id: parcels.id }).from(parcels).where(eq(parcels.trackingId, trackingId)).limit(1);
  return NextResponse.json({ ok: true, id: inserted[0]?.id, marketplaceMatched: Boolean(matchingOrder[0]) });
}
