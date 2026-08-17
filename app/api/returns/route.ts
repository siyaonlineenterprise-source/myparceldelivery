import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gt } from "drizzle-orm";
import { getDb } from "../../../db";
import { hashIp, requestIp } from "../../ip-security";
import { returnClaims, returnProofs, vendorSessions, vendors } from "../../../db/schema";

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
  const vendor = await vendorFromRequest(request);
  if (!vendor) return privateJson({ error: "Active vendor login required" }, { status: 401 });
  const db = await getDb();
  const records = await db.select({
    id: returnProofs.id,
    vendorId: returnProofs.vendorId,
    trackingId: returnProofs.trackingId,
    returnType: returnProofs.returnType,
    uploadStatus: returnProofs.uploadStatus,
    videoUrl: returnProofs.videoUrl,
    createdAt: returnProofs.createdAt,
    updatedAt: returnProofs.updatedAt,
    claimId: returnClaims.id,
  }).from(returnProofs)
    .leftJoin(returnClaims, eq(returnClaims.returnProofId, returnProofs.id))
    .where(eq(returnProofs.vendorId, vendor.vendorId)).orderBy(desc(returnProofs.id)).limit(100);
  return privateJson({ records });
}

export async function POST(request: NextRequest) {
  const vendor = await vendorFromRequest(request);
  if (!vendor) return NextResponse.json({ error: "Active vendor login required" }, { status: 401 });
  const body = await request.json() as { trackingId?: string; returnType?: string };
  const trackingId = String(body.trackingId || "").trim().toUpperCase();
  const returnType = body.returnType === "rto" ? "rto" : body.returnType === "return" ? "return" : "";
  if (!trackingId || !returnType) return NextResponse.json({ error: "Tracking ID aur Return Type required hain" }, { status: 400 });
  const db = await getDb();
  const inserted = await db.insert(returnProofs).values({
    vendorId: vendor.vendorId,
    trackingId,
    returnType,
  }).returning({ id: returnProofs.id });
  return NextResponse.json({ ok: true, id: inserted[0]?.id });
}
