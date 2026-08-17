import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { hashIp, requestIp } from "../../ip-security";
import { returnClaims, returnProofs, vendorSessions, vendors } from "../../../db/schema";
import { hasMasterSession } from "../../master-auth";
import { copyDriveVideo, driveFileIdFromUrl, driveVideoUrl } from "../../google-workspace";

export const runtime = "edge";

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
  if (!masterRequest) {
    const vendor = await vendorFromRequest(request);
    if (!vendor) return NextResponse.json({ error: "Active vendor login required" }, { status: 401 });
    const claims = await db.select({
      id: returnClaims.id,
      returnProofId: returnClaims.returnProofId,
      trackingId: returnClaims.trackingId,
      status: returnClaims.status,
    }).from(returnClaims)
      .where(eq(returnClaims.vendorId, vendor.vendorId))
      .orderBy(desc(returnClaims.id))
      .limit(250);
    return NextResponse.json({ claims }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  }
  if (!await hasMasterSession(request)) return NextResponse.json({ error: "Master login required" }, { status: 401 });
  const claims = await db.select({
    id: returnClaims.id,
    trackingId: returnClaims.trackingId,
    portal: returnClaims.portal,
    issueType: returnClaims.issueType,
    note: returnClaims.note,
    status: returnClaims.status,
    savedAmount: returnClaims.savedAmount,
    createdAt: returnClaims.createdAt,
    returnType: returnProofs.returnType,
    videoUrl: sql<string>`COALESCE(NULLIF(${returnClaims.claimVideoUrl}, ''), ${returnProofs.videoUrl})`,
    uploadStatus: returnProofs.uploadStatus,
    vendorName: vendors.businessName,
    vendorCode: vendors.vendorCode,
  }).from(returnClaims)
    .innerJoin(returnProofs, eq(returnClaims.returnProofId, returnProofs.id))
    .innerJoin(vendors, eq(returnClaims.vendorId, vendors.id))
    .orderBy(desc(returnClaims.id)).limit(500);
  return NextResponse.json({ claims });
}

export async function POST(request: NextRequest) {
  const vendor = await vendorFromRequest(request);
  if (!vendor) return NextResponse.json({ error: "Active vendor login required" }, { status: 401 });
  const body = await request.json() as { returnProofId?: number; issueType?: string; note?: string };
  const returnProofId = Number(body.returnProofId || 0);
  const issueType = String(body.issueType || "").trim();
  const note = String(body.note || "").trim().slice(0, 500);
  if (!returnProofId || !issueType) return NextResponse.json({ error: "Proof record aur issue type required hain" }, { status: 400 });
  const db = await getDb();
  const proof = await db.select({
    id: returnProofs.id,
    trackingId: returnProofs.trackingId,
    videoUrl: returnProofs.videoUrl,
    claimsFolderId: vendors.claimsFolderId,
  }).from(returnProofs)
    .innerJoin(vendors, eq(returnProofs.vendorId, vendors.id))
    .where(and(eq(returnProofs.id, returnProofId), eq(returnProofs.vendorId, vendor.vendorId)))
    .limit(1);
  if (!proof[0]) return NextResponse.json({ error: "Return proof nahi mila" }, { status: 404 });
  const existing = await db.select({ id: returnClaims.id }).from(returnClaims)
    .where(eq(returnClaims.returnProofId, returnProofId)).limit(1);
  if (existing[0]) return NextResponse.json({ error: "Is return proof par claim pehle hi raise ho chuka hai" }, { status: 409 });
  let claimVideoUrl = proof[0].videoUrl;
  const sourceFileId = driveFileIdFromUrl(proof[0].videoUrl);
  if (sourceFileId) {
    if (!proof[0].claimsFolderId) {
      return NextResponse.json({ error: "Raise Claims Drive folder connection missing hai" }, { status: 503 });
    }
    try {
      const extension = proof[0].videoUrl.includes("mp4") ? "mp4" : "webm";
      const copy = await copyDriveVideo(
        sourceFileId,
        proof[0].claimsFolderId,
        `${proof[0].trackingId}-claim-${new Date().toISOString().replaceAll(":", "-")}.${extension}`,
      );
      claimVideoUrl = driveVideoUrl(copy.id);
    } catch {
      return NextResponse.json({ error: "Claim video Raise Claims folder mein copy nahi hui" }, { status: 502 });
    }
  }
  const inserted = await db.insert(returnClaims).values({
    returnProofId,
    vendorId: vendor.vendorId,
    trackingId: proof[0].trackingId,
    issueType,
    note,
    claimVideoUrl,
  }).returning({ id: returnClaims.id });
  return NextResponse.json({ ok: true, id: inserted[0]?.id });
}

export async function PATCH(request: NextRequest) {
  if (!await hasMasterSession(request)) return NextResponse.json({ error: "Master login required" }, { status: 401 });
  const body = await request.json() as { id?: number; savedAmount?: number; status?: string };
  const id = Number(body.id || 0);
  const savedAmount = Math.round(Number(body.savedAmount || 0));
  const status = String(body.status || "resolved");
  if (!id || savedAmount < 0 || !["raised", "submitted", "resolved"].includes(status)) {
    return NextResponse.json({ error: "Valid claim, amount aur status required hain" }, { status: 400 });
  }
  const db = await getDb();
  await db.update(returnClaims).set({
    savedAmount,
    status: status as "raised" | "submitted" | "resolved",
  }).where(eq(returnClaims.id, id));
  return NextResponse.json({ ok: true });
}
