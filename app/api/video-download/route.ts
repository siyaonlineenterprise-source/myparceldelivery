import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gt } from "drizzle-orm";
import { getDb } from "../../../db";
import { hashIp, requestIp } from "../../ip-security";
import { parcels, returnProofs, vendorSessions, vendors } from "../../../db/schema";
import { driveFileIdFromUrl, getDriveVideo } from "../../google-workspace";

export const runtime = "edge";

async function vendorFromRequest(request: NextRequest) {
  const token = request.cookies.get("mpd_vendor_session")?.value;
  if (!token) return null;
  const db = await getDb();
  const rows = await db.select({ vendorId: vendors.id, status: vendors.status })
    .from(vendorSessions).innerJoin(vendors, eq(vendorSessions.vendorId, vendors.id))
    .where(and(eq(vendorSessions.token, token),
      eq(vendorSessions.ipHash, await hashIp(requestIp(request))), gt(vendorSessions.expiresAt, new Date().toISOString())))
    .limit(1);
  return rows[0]?.status === "active" ? rows[0] : null;
}

export async function GET(request: NextRequest) {
  const vendor = await vendorFromRequest(request);
  if (!vendor) return NextResponse.json({ error: "Vendor login required" }, { status: 401 });
  const trackingId = String(request.nextUrl.searchParams.get("trackingId") || "").trim().toUpperCase();
  if (!trackingId) return NextResponse.json({ error: "Tracking ID required hai" }, { status: 400 });
  const db = await getDb();
  const parcelRows = await db.select({ videoUrl: parcels.videoUrl })
    .from(parcels)
    .where(and(eq(parcels.vendorId, vendor.vendorId), eq(parcels.trackingId, trackingId)))
    .orderBy(desc(parcels.id))
    .limit(1);
  const returnRows = parcelRows[0]?.videoUrl ? [] : await db.select({ videoUrl: returnProofs.videoUrl })
    .from(returnProofs)
    .where(and(eq(returnProofs.vendorId, vendor.vendorId), eq(returnProofs.trackingId, trackingId)))
    .orderBy(desc(returnProofs.id))
    .limit(1);
  const videoUrl = parcelRows[0]?.videoUrl || returnRows[0]?.videoUrl || "";
  if (!videoUrl) return NextResponse.json({ error: "Is Tracking ID ki uploaded video nahi mili" }, { status: 404 });
  if (request.nextUrl.searchParams.get("download") !== "1") {
    return NextResponse.json({ available: true, trackingId }, {
      headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
    });
  }
  const driveFileId = driveFileIdFromUrl(videoUrl);
  if (driveFileId) {
    try {
      const response = await getDriveVideo(driveFileId);
      const headers = new Headers();
      headers.set("Content-Type", response.headers.get("Content-Type") || "video/webm");
      headers.set("Content-Disposition", `attachment; filename="${trackingId}-proof.webm"`);
      headers.set("Cache-Control", "private, no-store");
      return new Response(response.body, { headers });
    } catch {
      return NextResponse.json({ error: "Drive se video download nahi hui" }, { status: 502 });
    }
  }
  try {
    const url = new URL(videoUrl, request.nextUrl.origin);
    const key = url.searchParams.get("key") || "";
    if (!/^(packing|return)\/\d+\/[a-f0-9-]+\.(webm|mp4)$/.test(key)) throw new Error();
    const { env } = await import("cloudflare:workers");
    const object = await env.BUCKET.get(key);
    if (!object) throw new Error();
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Content-Disposition", `attachment; filename="${trackingId}-proof.webm"`);
    headers.set("Cache-Control", "private, no-store");
    return new Response(object.body, { headers });
  } catch {
    return NextResponse.json({ error: "Video download available nahi hai" }, { status: 404 });
  }
}
