import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gt } from "drizzle-orm";
import { getDb } from "../../../db";
import { hashIp, requestIp } from "../../ip-security";
import { followUps, returnClaims, vendorSessions, vendors } from "../../../db/schema";
import { hasMasterSession } from "../../master-auth";
import { appendFollowUpRow } from "../../google-workspace";

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
  const rows = await db.select({
    vendorId: vendors.id,
    vendorCode: vendors.vendorCode,
    businessName: vendors.businessName,
    status: vendors.status,
  }).from(vendorSessions)
    .innerJoin(vendors, eq(vendorSessions.vendorId, vendors.id))
    .where(and(eq(vendorSessions.token, token),
      eq(vendorSessions.ipHash, await hashIp(requestIp(request))), gt(vendorSessions.expiresAt, new Date().toISOString())))
    .limit(1);
  return rows[0]?.status === "active" ? rows[0] : null;
}

export async function GET(request: NextRequest) {
  if (!await hasMasterSession(request)) return privateJson({ error: "Master login required" }, { status: 401 });
  const db = await getDb();
  const rows = await db.select({
    id: followUps.id,
    claimId: followUps.claimId,
    trackingId: followUps.trackingId,
    personName: followUps.personName,
    contactNumber: followUps.contactNumber,
    reason: followUps.reason,
    status: followUps.status,
    sheetSynced: followUps.sheetSynced,
    createdAt: followUps.createdAt,
    updatedAt: followUps.updatedAt,
    vendorName: vendors.businessName,
    vendorCode: vendors.vendorCode,
  }).from(followUps)
    .innerJoin(vendors, eq(followUps.vendorId, vendors.id))
    .orderBy(desc(followUps.id))
    .limit(500);
  return privateJson({ followUps: rows });
}

export async function POST(request: NextRequest) {
  const vendor = await vendorFromRequest(request);
  if (!vendor) return privateJson({ error: "Active vendor login required" }, { status: 401 });
  const body = await request.json() as {
    claimId?: number;
    personName?: string;
    contactNumber?: string;
    reason?: string;
  };
  const claimId = Number(body.claimId || 0);
  const personName = String(body.personName || "").trim().slice(0, 120);
  const contactNumber = String(body.contactNumber || "").replace(/\D/g, "");
  const reason = String(body.reason || "").trim().slice(0, 600);
  if (!claimId || personName.length < 2 || !/^[6-9]\d{9}$/.test(contactNumber) || reason.length < 5) {
    return privateJson({ error: "Person name, 10-digit contact aur reason sahi enter kijiye" }, { status: 400 });
  }
  const db = await getDb();
  const claim = await db.select({ id: returnClaims.id, trackingId: returnClaims.trackingId })
    .from(returnClaims)
    .where(and(eq(returnClaims.id, claimId), eq(returnClaims.vendorId, vendor.vendorId)))
    .limit(1);
  if (!claim[0]) return privateJson({ error: "Aapka claim record nahi mila" }, { status: 404 });
  const now = new Date().toISOString();
  const inserted = await db.insert(followUps).values({
    claimId,
    vendorId: vendor.vendorId,
    trackingId: claim[0].trackingId,
    personName,
    contactNumber,
    reason,
    createdAt: now,
    updatedAt: now,
  }).returning({ id: followUps.id });
  const id = inserted[0]?.id;
  let sheetSynced = false;
  try {
    await appendFollowUpRow([
      id || "",
      claimId,
      vendor.vendorCode,
      vendor.businessName,
      claim[0].trackingId,
      personName,
      contactNumber,
      reason,
      "Open",
      now,
      now,
    ]);
    sheetSynced = true;
    await db.update(followUps).set({ sheetSynced: true }).where(eq(followUps.id, id!));
  } catch {
    // D1 remains authoritative; Master Admin can still see the follow-up.
  }
  return privateJson({ ok: true, id, sheetSynced });
}

export async function PATCH(request: NextRequest) {
  if (!await hasMasterSession(request)) return privateJson({ error: "Master login required" }, { status: 401 });
  const body = await request.json() as { id?: number; status?: string };
  const id = Number(body.id || 0);
  const status = String(body.status || "");
  if (!id || !["open", "contacted", "closed"].includes(status)) {
    return privateJson({ error: "Valid follow-up aur status required hai" }, { status: 400 });
  }
  const db = await getDb();
  await db.update(followUps).set({
    status: status as "open" | "contacted" | "closed",
    updatedAt: new Date().toISOString(),
  }).where(eq(followUps.id, id));
  return privateJson({ ok: true });
}
