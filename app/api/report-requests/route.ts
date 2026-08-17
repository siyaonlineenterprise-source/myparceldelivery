import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gt } from "drizzle-orm";
import { getDb } from "../../../db";
import { hashIp, requestIp } from "../../ip-security";
import { reportRequests, vendorSessions, vendors } from "../../../db/schema";
import { hasMasterSession } from "../../master-auth";

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
  const query = db.select({
    id: reportRequests.id, reportType: reportRequests.reportType, dateFrom: reportRequests.dateFrom,
    dateTo: reportRequests.dateTo, note: reportRequests.note, status: reportRequests.status,
    masterNote: reportRequests.masterNote, reportUrl: reportRequests.reportUrl,
    createdAt: reportRequests.createdAt, updatedAt: reportRequests.updatedAt,
    vendorName: vendors.businessName, vendorCode: vendors.vendorCode,
  }).from(reportRequests).innerJoin(vendors, eq(reportRequests.vendorId, vendors.id));
  const rows = masterRequest
    ? await query.orderBy(desc(reportRequests.id)).limit(500)
    : await query.where(eq(reportRequests.vendorId, vendor!.vendorId)).orderBy(desc(reportRequests.id)).limit(100);
  return privateJson({ requests: rows });
}

export async function POST(request: NextRequest) {
  const vendor = await vendorFromRequest(request);
  if (!vendor) return privateJson({ error: "Active vendor login required" }, { status: 401 });
  const body = await request.json() as { reportType?: string; dateFrom?: string; dateTo?: string; note?: string };
  const reportType = String(body.reportType || "");
  const dateFrom = String(body.dateFrom || "");
  const dateTo = String(body.dateTo || "");
  if (!["orders", "returns", "claims", "custom"].includes(reportType) || !dateFrom || !dateTo) return privateJson({ error: "Report type aur date range required hain" }, { status: 400 });
  if (dateFrom > dateTo) return privateJson({ error: "From date, To date se aage nahi ho sakti" }, { status: 400 });
  const db = await getDb();
  const result = await db.insert(reportRequests).values({ vendorId: vendor.vendorId, reportType: reportType as "orders" | "returns" | "claims" | "custom", dateFrom, dateTo, note: String(body.note || "").trim().slice(0, 500) }).returning({ id: reportRequests.id });
  return privateJson({ ok: true, id: result[0]?.id });
}

export async function PATCH(request: NextRequest) {
  if (!await hasMasterSession(request)) return privateJson({ error: "Master login required" }, { status: 401 });
  const body = await request.json() as { id?: number; status?: string; masterNote?: string; reportUrl?: string };
  const id = Number(body.id || 0);
  const status = String(body.status || "");
  if (!id || !["requested", "preparing", "ready", "sent", "rejected"].includes(status)) return privateJson({ error: "Valid request aur status required hai" }, { status: 400 });
  const db = await getDb();
  await db.update(reportRequests).set({ status: status as "requested" | "preparing" | "ready" | "sent" | "rejected", masterNote: String(body.masterNote || "").trim().slice(0, 500), reportUrl: String(body.reportUrl || "").trim().slice(0, 1000), updatedAt: new Date().toISOString() }).where(eq(reportRequests.id, id));
  return privateJson({ ok: true });
}
