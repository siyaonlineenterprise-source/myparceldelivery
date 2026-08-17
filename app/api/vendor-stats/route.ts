import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { hashIp, requestIp } from "../../ip-security";
import { customerVideoViews, marketplaceOrders, returnClaims, vendorSessions, vendors } from "../../../db/schema";

export const runtime = "edge";

function privateJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Cookie");
  return response;
}

function indiaDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("mpd_vendor_session")?.value;
  if (!token) return privateJson({ error: "Vendor login required" }, { status: 401 });

  const db = await getDb();
  const sessionRows = await db.select({
    vendorId: vendors.id,
    status: vendors.status,
  })
    .from(vendorSessions)
    .innerJoin(vendors, eq(vendorSessions.vendorId, vendors.id))
    .where(and(
      eq(vendorSessions.token, token),
      eq(vendorSessions.ipHash, await hashIp(requestIp(request))),
      gt(vendorSessions.expiresAt, new Date().toISOString()),
    ))
    .limit(1);

  const vendor = sessionRows[0];
  if (!vendor || vendor.status !== "active") {
    return privateJson({ error: "Vendor session invalid or blocked" }, { status: 403 });
  }

  const [claimStats] = await db.select({
    savedAmount: sql<number>`coalesce(sum(${returnClaims.savedAmount}), 0)`,
    protectedClaims: sql<number>`count(case when ${returnClaims.savedAmount} > 0 then 1 end)`,
  })
    .from(returnClaims)
    .where(eq(returnClaims.vendorId, vendor.vendorId));

  const [viewStats] = await db.select({
    customerViews: sql<number>`count(*)`,
  })
    .from(customerVideoViews)
    .where(eq(customerVideoViews.vendorId, vendor.vendorId));

  const today = indiaDate();
  const [orderStats] = await db.select({
    todayOrders: sql<number>`count(*)`,
    packedOrders: sql<number>`count(case when ${marketplaceOrders.packingStatus} = 'packed' then 1 end)`,
    pendingOrders: sql<number>`count(case when ${marketplaceOrders.packingStatus} = 'pending' then 1 end)`,
  })
    .from(marketplaceOrders)
    .where(and(eq(marketplaceOrders.vendorId, vendor.vendorId), eq(marketplaceOrders.orderDate, today)));

  const pendingOrderList = await db.select({
    id: marketplaceOrders.id,
    marketplace: marketplaceOrders.marketplace,
    orderId: marketplaceOrders.orderId,
    trackingId: marketplaceOrders.trackingId,
  })
    .from(marketplaceOrders)
    .where(and(
      eq(marketplaceOrders.vendorId, vendor.vendorId),
      eq(marketplaceOrders.orderDate, today),
      eq(marketplaceOrders.packingStatus, "pending"),
    ))
    .orderBy(asc(marketplaceOrders.id))
    .limit(20);

  return privateJson({
    accountActive: true,
    savedAmount: Number(claimStats?.savedAmount || 0),
    protectedClaims: Number(claimStats?.protectedClaims || 0),
    customerViews: Number(viewStats?.customerViews || 0),
    todayOrders: Number(orderStats?.todayOrders || 0),
    packedOrders: Number(orderStats?.packedOrders || 0),
    pendingOrders: Number(orderStats?.pendingOrders || 0),
    pendingOrderList,
  });
}
