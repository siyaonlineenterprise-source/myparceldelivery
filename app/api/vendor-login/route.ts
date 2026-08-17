import { NextRequest, NextResponse } from "next/server";
import { and, count, eq, gt } from "drizzle-orm";
import { getDb } from "../../../db";
import { vendorDevices, vendorSessions, vendors } from "../../../db/schema";
import { deviceCookieName, deviceTokenFrom, hashIp, maskedIp, requestIp } from "../../ip-security";

export const runtime = "edge";
const cookieName = "mpd_vendor_session";

function privateJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Cookie");
  return response;
}

async function pinHash(pin: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`mpd-vendor:${pin}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { vendorCode?: string; pin?: string };
  const vendorCode = String(body.vendorCode || "").trim().toUpperCase();
  const pin = String(body.pin || "").replace(/\D/g, "");
  if (!vendorCode || !/^\d{4,8}$/.test(pin)) return NextResponse.json({ error: "Vendor ID aur 4–8 digit PIN enter kijiye" }, { status: 400 });
  const db = await getDb();
  const rows = await db.select().from(vendors).where(and(eq(vendors.vendorCode, vendorCode), eq(vendors.loginPinHash, await pinHash(pin)))).limit(1);
  const vendor = rows[0];
  if (!vendor) return NextResponse.json({ error: "Vendor ID ya PIN galat hai" }, { status: 401 });
  if (vendor.status !== "active") return NextResponse.json({ error: "Aapka vendor account blocked hai. Master Admin se contact karein." }, { status: 403 });
  if (vendor.ipPolicyBlocked) {
    return NextResponse.json({
      error: "Bar-bar IP change hone ki wajah se account security block ho gaya hai. Master Admin se IP Reset karvayein.",
      code: "IP_POLICY_BLOCKED",
    }, { status: 403 });
  }

  const currentIp = requestIp(request);
  const currentIpHash = await hashIp(currentIp);
  const currentDeviceToken = deviceTokenFrom(request);
  const deviceToken = currentDeviceToken || crypto.randomUUID();
  const [device] = await db.select().from(vendorDevices).where(and(
    eq(vendorDevices.vendorId, vendor.id),
    eq(vendorDevices.deviceToken, deviceToken),
  )).limit(1);

  if (!device) {
    const [usage] = await db.select({ total: count() }).from(vendorDevices).where(and(
      eq(vendorDevices.vendorId, vendor.id),
      eq(vendorDevices.status, "active"),
    ));
    if (Number(usage?.total || 0) >= vendor.userLimit) {
      return NextResponse.json({
        error: `Is vendor ki ${vendor.userLimit} user limit full hai. Naye user ke liye Master Admin se limit badhvayein.`,
        code: "USER_LIMIT_REACHED",
      }, { status: 403 });
    }
    await db.insert(vendorDevices).values({
      vendorId: vendor.id,
      deviceToken,
      ipHash: currentIpHash,
      maskedIp: maskedIp(currentIp),
      ipChangeCount: 0,
      lastSeenAt: new Date().toISOString(),
    });
  } else if (device.ipHash !== currentIpHash) {
    if (device.ipChangeCount >= 5) {
      const blockedAt = new Date().toISOString();
      await db.update(vendors).set({ ipPolicyBlocked: true, ipBlockedAt: blockedAt }).where(eq(vendors.id, vendor.id));
      await db.update(vendorDevices).set({ status: "blocked", lastSeenAt: blockedAt }).where(eq(vendorDevices.id, device.id));
      await db.delete(vendorSessions).where(eq(vendorSessions.vendorId, vendor.id));
      return NextResponse.json({
        error: "6वीं बार IP change detect हुआ। Account security block कर दिया गया है। Master Admin से IP Reset करवाएँ।",
        code: "IP_CHANGE_LIMIT_EXCEEDED",
      }, { status: 403 });
    }
    await db.update(vendorDevices).set({
      ipHash: currentIpHash,
      maskedIp: maskedIp(currentIp),
      ipChangeCount: device.ipChangeCount + 1,
      lastSeenAt: new Date().toISOString(),
    }).where(eq(vendorDevices.id, device.id));
  } else {
    await db.update(vendorDevices).set({ lastSeenAt: new Date().toISOString() }).where(eq(vendorDevices.id, device.id));
  }

  const token = crypto.randomUUID() + crypto.randomUUID();
  const expires = new Date(Date.now() + 12 * 60 * 60 * 1000);
  await db.insert(vendorSessions).values({ token, vendorId: vendor.id, deviceToken, ipHash: currentIpHash, expiresAt: expires.toISOString() });
  const response = NextResponse.json({ ok: true, vendor: {
    id: vendor.id,
    businessName: vendor.businessName,
    contactName: vendor.contactName,
    vendorCode: vendor.vendorCode,
    userLimit: vendor.userLimit,
    extraUserRatePaise: vendor.extraUserRatePaise,
  } });
  response.cookies.set(cookieName, token, { httpOnly: true, sameSite: "strict", secure: true, path: "/", expires });
  response.cookies.set(deviceCookieName(), deviceToken, { httpOnly: true, sameSite: "strict", secure: true, path: "/", maxAge: 365 * 24 * 60 * 60 });
  return response;
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(cookieName)?.value;
  if (!token) return privateJson({ error: "Login required" }, { status: 401 });
  const db = await getDb();
  const currentIpHash = await hashIp(requestIp(request));
  const rows = await db.select({ id: vendors.id, businessName: vendors.businessName, contactName: vendors.contactName, vendorCode: vendors.vendorCode, status: vendors.status, ipPolicyBlocked: vendors.ipPolicyBlocked, userLimit: vendors.userLimit, extraUserRatePaise: vendors.extraUserRatePaise })
    .from(vendorSessions).innerJoin(vendors, eq(vendorSessions.vendorId, vendors.id))
    .where(and(eq(vendorSessions.token, token), eq(vendorSessions.ipHash, currentIpHash), gt(vendorSessions.expiresAt, new Date().toISOString()))).limit(1);
  const vendor = rows[0];
  if (!vendor || vendor.status !== "active" || vendor.ipPolicyBlocked) return privateJson({ error: "Session expired or IP changed. Dobara login kijiye." }, { status: 401 });
  return privateJson({ vendor });
}

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get(cookieName)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(vendorSessions).where(eq(vendorSessions.token, token));
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookieName, "", { httpOnly: true, sameSite: "strict", secure: true, path: "/", maxAge: 0 });
  return response;
}
