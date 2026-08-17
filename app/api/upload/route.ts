import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "../../../db";
import { hashIp, requestIp } from "../../ip-security";
import { parcels, returnProofs, vendorSessions, vendors } from "../../../db/schema";
import { createVendorFolders, driveVideoUrl, uploadDriveVideo } from "../../google-workspace";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get("mpd_vendor_session")?.value;
  if (!sessionToken) return NextResponse.json({ error: "Vendor login required" }, { status: 401 });
  const db = await getDb();
  const sessionRows = await db.select({
    vendorId: vendors.id,
    status: vendors.status,
    businessName: vendors.businessName,
    driveFolderId: vendors.driveFolderId,
    packingFolderId: vendors.packingFolderId,
    returnFolderId: vendors.returnFolderId,
    claimsFolderId: vendors.claimsFolderId,
  })
    .from(vendorSessions).innerJoin(vendors, eq(vendorSessions.vendorId, vendors.id))
    .where(and(eq(vendorSessions.token, sessionToken),
      eq(vendorSessions.ipHash, await hashIp(requestIp(request))), gt(vendorSessions.expiresAt, new Date().toISOString()))).limit(1);
  const loggedVendor = sessionRows[0];
  if (!loggedVendor || loggedVendor.status !== "active") {
    return NextResponse.json({ error: "Vendor session invalid or blocked" }, { status: 403 });
  }

  let failedTrackingId = "";
  let failedMode = "packing";
  let failedReturnId = 0;
  try {
    const data = await request.formData();
    const video = data.get("video");
    const trackingId = String(data.get("trackingId") || "").trim().toUpperCase();
    const bagId = String(data.get("bagId") || "").trim().toUpperCase();
    const proofMode = String(data.get("proofMode") || "packing");
    const returnProofId = Number(data.get("returnProofId") || 0);
    failedMode = proofMode;
    failedReturnId = returnProofId;
    failedTrackingId = trackingId;

    if (!(video instanceof File) || !trackingId || (proofMode === "packing" && !bagId)) {
      return NextResponse.json({ error: "Video aur required parcel IDs chahiye" }, { status: 400 });
    }
    if (proofMode === "packing" && trackingId === bagId) {
      return NextResponse.json({ error: "Tracking ID aur Bag ID same nahi ho sakte" }, { status: 400 });
    }

    const safeType = video.type.startsWith("video/") ? video.type : "video/webm";
    const extension = safeType.includes("mp4") ? "mp4" : "webm";
    const timestamp = new Date().toISOString().replaceAll(":", "-");
    let videoUrl = "";

    // Prefer the vendor's Drive when it is connected. Until a Shared Drive and
    // service-account secret are available, keep the vendor workflow usable by
    // storing the proof in the site's private R2 bucket.
    try {
      let folders = {
        driveFolderId: loggedVendor.driveFolderId,
        packingFolderId: loggedVendor.packingFolderId,
        returnFolderId: loggedVendor.returnFolderId,
        claimsFolderId: loggedVendor.claimsFolderId,
      };
      if (!folders.packingFolderId || !folders.returnFolderId || !folders.claimsFolderId) {
        folders = await createVendorFolders(loggedVendor.businessName);
        await db.update(vendors).set(folders).where(eq(vendors.id, loggedVendor.vendorId));
      }
      const parentId = proofMode === "return" ? folders.returnFolderId : folders.packingFolderId;
      const uploaded = await uploadDriveVideo(
        new File([video], `${trackingId}-${proofMode}.${extension}`, { type: safeType }),
        parentId,
        `${trackingId}-${proofMode}-${timestamp}.${extension}`,
      );
      videoUrl = driveVideoUrl(uploaded.id);
    } catch {
      const { env } = await import("cloudflare:workers");
      if (!env.BUCKET) throw new Error("Secure video storage unavailable hai");
      const storageMode = proofMode === "return" ? "return" : "packing";
      const key = `${storageMode}/${loggedVendor.vendorId}/${crypto.randomUUID()}.${extension}`;
      await env.BUCKET.put(key, video, {
        httpMetadata: { contentType: safeType },
        customMetadata: {
          trackingId,
          bagId,
          proofMode: storageMode,
          vendorId: String(loggedVendor.vendorId),
          recordedAt: timestamp,
        },
      });
      videoUrl = `/api/video?key=${encodeURIComponent(key)}`;
    }
    const updatedAt = new Date().toISOString();

    if (proofMode === "return") {
      await db.update(returnProofs).set({ uploadStatus: "uploaded", videoUrl, updatedAt })
        .where(and(eq(returnProofs.id, returnProofId), eq(returnProofs.vendorId, loggedVendor.vendorId)));
      return NextResponse.json({ ok: true, url: videoUrl });
    }

    await db.update(parcels).set({ uploadStatus: "uploaded", videoUrl, updatedAt })
      .where(and(eq(parcels.vendorId, loggedVendor.vendorId), eq(parcels.trackingId, trackingId), eq(parcels.bagId, bagId)));
    return NextResponse.json({ ok: true, url: videoUrl });
  } catch (error) {
    if (failedTrackingId) {
      if (failedMode === "return" && failedReturnId) {
        await db.update(returnProofs).set({ uploadStatus: "failed", updatedAt: new Date().toISOString() })
          .where(and(eq(returnProofs.id, failedReturnId), eq(returnProofs.vendorId, loggedVendor.vendorId))).catch(() => undefined);
      } else {
        await db.update(parcels).set({ uploadStatus: "failed", updatedAt: new Date().toISOString() })
          .where(and(eq(parcels.vendorId, loggedVendor.vendorId), eq(parcels.trackingId, failedTrackingId))).catch(() => undefined);
      }
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 500 });
  }
}
