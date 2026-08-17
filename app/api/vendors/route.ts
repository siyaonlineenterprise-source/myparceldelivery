import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, ne } from "drizzle-orm";
import { hasMasterSession } from "../../master-auth";
import { getDb } from "../../../db";
import { deletedVendors, pinResetRequests, vendorDevices, vendorSessions, vendors } from "../../../db/schema";
import { appendDeletedVendorRow, createVendorFolders } from "../../google-workspace";

export const runtime = "edge";

async function pinHash(pin: string) {
  const bytes = new TextEncoder().encode(`mpd-vendor:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cleanCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
}

export async function GET(request: NextRequest) {
  if (!(await hasMasterSession(request))) return NextResponse.json({ error: "Master login required" }, { status: 401 });
  const db = await getDb();
  const rows = await db.select({
    id: vendors.id,
    businessName: vendors.businessName,
    contactName: vendors.contactName,
    mobile: vendors.mobile,
    vendorCode: vendors.vendorCode,
    status: vendors.status,
    userLimit: vendors.userLimit,
    extraUserRatePaise: vendors.extraUserRatePaise,
    ipPolicyBlocked: vendors.ipPolicyBlocked,
    ipBlockedAt: vendors.ipBlockedAt,
    parcelCount: vendors.parcelCount,
    driveFolderId: vendors.driveFolderId,
    createdAt: vendors.createdAt,
  }).from(vendors).where(ne(vendors.status, "deleted")).orderBy(asc(vendors.businessName));
  const deviceRows = await db.select({
    vendorId: vendorDevices.vendorId,
    ipChangeCount: vendorDevices.ipChangeCount,
    maskedIp: vendorDevices.maskedIp,
    status: vendorDevices.status,
  }).from(vendorDevices);
  const accessByVendor = new Map<number, { activeUsers: number; maxIpChanges: number; lastMaskedIp: string }>();
  for (const device of deviceRows) {
    const current = accessByVendor.get(device.vendorId) || { activeUsers: 0, maxIpChanges: 0, lastMaskedIp: "" };
    if (device.status === "active") current.activeUsers += 1;
    current.maxIpChanges = Math.max(current.maxIpChanges, device.ipChangeCount);
    if (device.maskedIp) current.lastMaskedIp = device.maskedIp;
    accessByVendor.set(device.vendorId, current);
  }
  const vendorsWithAccess = rows.map((vendor) => ({
    ...vendor,
    ...(accessByVendor.get(vendor.id) || { activeUsers: 0, maxIpChanges: 0, lastMaskedIp: "" }),
  }));
  const archived = await db.select({
    id: deletedVendors.id,
    vendorId: deletedVendors.vendorId,
    businessName: deletedVendors.businessName,
    contactName: deletedVendors.contactName,
    mobile: deletedVendors.mobile,
    vendorCode: deletedVendors.vendorCode,
    parcelCount: deletedVendors.parcelCount,
    originalCreatedAt: deletedVendors.originalCreatedAt,
    deletedAt: deletedVendors.deletedAt,
    approvalStatus: deletedVendors.approvalStatus,
    approvalRequestedAt: deletedVendors.approvalRequestedAt,
    approvedAt: deletedVendors.approvedAt,
    sheetSynced: deletedVendors.sheetSynced,
  }).from(deletedVendors).orderBy(asc(deletedVendors.deletedAt));
  const requests = await db.select({
    id: pinResetRequests.id,
    vendorId: pinResetRequests.vendorId,
    status: pinResetRequests.status,
    createdAt: pinResetRequests.createdAt,
  }).from(pinResetRequests).where(eq(pinResetRequests.status, "pending")).orderBy(asc(pinResetRequests.createdAt));
  return NextResponse.json({ vendors: vendorsWithAccess, deletedVendors: archived.reverse(), resetRequests: requests });
}

export async function POST(request: NextRequest) {
  if (!(await hasMasterSession(request))) return NextResponse.json({ error: "Master login required" }, { status: 401 });
  const body = await request.json() as Record<string, string>;
  const businessName = String(body.businessName || "").trim();
  const contactName = String(body.contactName || "").trim();
  const mobile = String(body.mobile || "").replace(/\D/g, "");
  const vendorCode = cleanCode(String(body.vendorCode || ""));
  const pin = String(body.pin || "").replace(/\D/g, "");
  const userLimit = Math.max(1, Math.min(100, Number(body.userLimit || 1)));
  const extraUserRatePaise = Math.max(0, Math.min(1_000_000, Math.round(Number(body.extraUserRate || 99) * 100)));
  if (businessName.length < 2 || contactName.length < 2) return NextResponse.json({ error: "Business Name aur Owner Name required hain" }, { status: 400 });
  if (!/^[6-9]\d{9}$/.test(mobile)) return NextResponse.json({ error: "Sahi 10-digit mobile number enter kijiye" }, { status: 400 });
  if (vendorCode.length < 3) return NextResponse.json({ error: "Vendor code kam se kam 3 characters ka rakhiye" }, { status: 400 });
  if (!/^\d{4,8}$/.test(pin)) return NextResponse.json({ error: "Login PIN 4 se 8 digits ka hona chahiye" }, { status: 400 });

  try {
    const db = await getDb();
    const mobileMatches = await db.select({
      id: vendors.id,
      status: vendors.status,
    }).from(vendors).where(eq(vendors.mobile, mobile)).limit(1);
    const previousVendor = mobileMatches[0];

    if (previousVendor?.status === "deleted") {
      const archived = await db.select({ id: deletedVendors.id })
        .from(deletedVendors)
        .where(eq(deletedVendors.vendorId, previousVendor.id))
        .limit(1);
      if (!archived[0]) {
        return NextResponse.json({ error: "Deleted vendor archive missing hai. Restore ke liye support check required hai." }, { status: 409 });
      }
      await db.update(deletedVendors).set({
        approvalStatus: "pending",
        requestedBusinessName: businessName,
        requestedContactName: contactName,
        requestedVendorCode: vendorCode,
        requestedPinHash: await pinHash(pin),
        approvalRequestedAt: new Date().toISOString(),
        approvedAt: "",
      }).where(eq(deletedVendors.id, archived[0].id));
      return NextResponse.json({
        ok: false,
        approvalRequired: true,
        error: "Ye mobile number Deleted Vendors mein mila. Master Approval ke baad hi vendor restore hoga.",
      }, { status: 202 });
    }

    if (previousVendor) {
      return NextResponse.json({ error: "Ye mobile number pehle se kisi Vendor Account mein use ho raha hai" }, { status: 409 });
    }

    const inserted = await db.insert(vendors).values({
      businessName,
      contactName,
      mobile,
      vendorCode,
      loginPinHash: await pinHash(pin),
      userLimit,
      extraUserRatePaise,
    }).returning({ id: vendors.id });
    const vendorId = inserted[0]?.id;
    try {
      const folders = await createVendorFolders(businessName);
      if (vendorId) await db.update(vendors).set(folders).where(eq(vendors.id, vendorId));
      return NextResponse.json({ ok: true, id: vendorId, drivePending: false });
    } catch (folderError) {
      const warning = folderError instanceof Error ? folderError.message : "Google Drive connection pending hai";
      return NextResponse.json({
        ok: true,
        id: vendorId,
        drivePending: true,
        warning: `Vendor account ban gaya. Drive folder baad mein connect hoga: ${warning}`,
      }, { status: 201 });
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    const duplicateMobile = detail.toLowerCase().includes("mobile");
    return NextResponse.json({
      error: duplicateMobile ? "Ye mobile number pehle se Vendor ya Deleted Vendor record mein hai" : "Ye Vendor Code pehle se use ho raha hai",
    }, { status: 409 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await hasMasterSession(request))) return NextResponse.json({ error: "Master login required" }, { status: 401 });
  const body = await request.json() as { id?: number; status?: string; pin?: string; requestId?: number; action?: string; userLimit?: number; extraUserRate?: number };
  if (!Number.isInteger(body.id)) return NextResponse.json({ error: "Invalid vendor update" }, { status: 400 });
  const db = await getDb();
  if (body.action === "approve_reactivation") {
    const archived = await db.select().from(deletedVendors).where(and(
      eq(deletedVendors.id, Number(body.id)),
      eq(deletedVendors.approvalStatus, "pending"),
    )).limit(1);
    const item = archived[0];
    if (!item) return NextResponse.json({ error: "Pending approval request nahi mili" }, { status: 404 });
    const codeConflict = await db.select({ id: vendors.id }).from(vendors).where(and(
      eq(vendors.vendorCode, item.requestedVendorCode),
      ne(vendors.id, item.vendorId),
    )).limit(1);
    if (codeConflict[0]) return NextResponse.json({ error: "Requested Vendor Code kisi aur account mein use ho raha hai" }, { status: 409 });
    await db.update(vendors).set({
      businessName: item.requestedBusinessName || item.businessName,
      contactName: item.requestedContactName || item.contactName,
      vendorCode: item.requestedVendorCode || item.vendorCode,
      loginPinHash: item.requestedPinHash,
      status: "active",
    }).where(eq(vendors.id, item.vendorId));
    await db.update(deletedVendors).set({
      approvalStatus: "approved",
      approvedAt: new Date().toISOString(),
      requestedPinHash: "",
    }).where(eq(deletedVendors.id, item.id));
    return NextResponse.json({ ok: true, restored: true });
  }
  if (body.action === "reject_reactivation") {
    await db.update(deletedVendors).set({
      approvalStatus: "rejected",
      requestedPinHash: "",
    }).where(eq(deletedVendors.id, Number(body.id)));
    return NextResponse.json({ ok: true });
  }
  if (body.action === "access_policy") {
    const userLimit = Math.max(1, Math.min(100, Math.round(Number(body.userLimit || 1))));
    const extraUserRatePaise = Math.max(0, Math.min(1_000_000, Math.round(Number(body.extraUserRate || 0) * 100)));
    await db.update(vendors).set({ userLimit, extraUserRatePaise }).where(eq(vendors.id, Number(body.id)));
    return NextResponse.json({ ok: true, userLimit, extraUserRatePaise });
  }
  if (body.action === "reset_ip_policy") {
    await db.delete(vendorSessions).where(eq(vendorSessions.vendorId, Number(body.id)));
    await db.delete(vendorDevices).where(eq(vendorDevices.vendorId, Number(body.id)));
    await db.update(vendors).set({ ipPolicyBlocked: false, ipBlockedAt: "" }).where(eq(vendors.id, Number(body.id)));
    return NextResponse.json({ ok: true });
  }
  if (body.pin !== undefined) {
    const pin = String(body.pin).replace(/\D/g, "");
    if (!/^\d{4,8}$/.test(pin)) return NextResponse.json({ error: "PIN 4–8 digits ka hona chahiye" }, { status: 400 });
    await db.update(vendors).set({ loginPinHash: await pinHash(pin) }).where(eq(vendors.id, Number(body.id)));
    if (Number.isInteger(body.requestId)) await db.update(pinResetRequests).set({ status: "resolved" }).where(eq(pinResetRequests.id, Number(body.requestId)));
    return NextResponse.json({ ok: true });
  }
  if (!["active", "blocked"].includes(String(body.status))) return NextResponse.json({ error: "Invalid vendor status" }, { status: 400 });
  await db.update(vendors).set({ status: body.status as "active" | "blocked" }).where(eq(vendors.id, Number(body.id)));
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  if (!(await hasMasterSession(request))) return NextResponse.json({ error: "Master login required" }, { status: 401 });
  const body = await request.json() as { id?: number };
  if (!Number.isInteger(body.id)) return NextResponse.json({ error: "Invalid vendor delete" }, { status: 400 });
  const db = await getDb();
  const rows = await db.select().from(vendors).where(eq(vendors.id, Number(body.id))).limit(1);
  const vendor = rows[0];
  if (!vendor || vendor.status === "deleted") return NextResponse.json({ error: "Vendor active list mein nahi mila" }, { status: 404 });
  const deletedAt = new Date().toISOString();
  await db.insert(deletedVendors).values({
    vendorId: vendor.id,
    businessName: vendor.businessName,
    contactName: vendor.contactName,
    mobile: vendor.mobile,
    vendorCode: vendor.vendorCode,
    parcelCount: vendor.parcelCount,
    originalCreatedAt: vendor.createdAt,
    deletedAt,
    approvalStatus: "none",
  }).onConflictDoUpdate({
    target: deletedVendors.vendorId,
    set: {
      businessName: vendor.businessName,
      contactName: vendor.contactName,
      mobile: vendor.mobile,
      vendorCode: vendor.vendorCode,
      parcelCount: vendor.parcelCount,
      deletedAt,
      approvalStatus: "none",
      requestedBusinessName: "",
      requestedContactName: "",
      requestedVendorCode: "",
      requestedPinHash: "",
      approvalRequestedAt: "",
      approvedAt: "",
      sheetSynced: false,
    },
  });
  await db.update(vendors).set({ status: "deleted" }).where(eq(vendors.id, vendor.id));
  await db.delete(vendorSessions).where(eq(vendorSessions.vendorId, vendor.id));

  let sheetSynced = false;
  try {
    await appendDeletedVendorRow([
      vendor.id,
      vendor.businessName,
      vendor.contactName,
      vendor.mobile,
      vendor.vendorCode,
      vendor.parcelCount,
      vendor.status,
      vendor.createdAt,
      deletedAt,
      "Deleted",
      "Master approval required for return",
    ]);
    sheetSynced = true;
    await db.update(deletedVendors).set({ sheetSynced: true }).where(eq(deletedVendors.vendorId, vendor.id));
  } catch {
    // D1 archive is authoritative; Google Sheet sync can be connected or retried later.
  }
  return NextResponse.json({ ok: true, sheetSynced });
}
