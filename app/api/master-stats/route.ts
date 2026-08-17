import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { customerVideoViews, parcels, returnClaims, returnProofs, vendors } from "../../../db/schema";
import { hasMasterSession } from "../../master-auth";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  if (!await hasMasterSession(request)) {
    return NextResponse.json({ error: "Master login required" }, { status: 401 });
  }

  const db = await getDb();
  const [[vendorStats], [parcelStats], [returnStats], [claimStats], [viewStats]] = await Promise.all([
    db.select({
      totalVendors: sql<number>`count(case when ${vendors.status} != 'deleted' then 1 end)`,
      activeVendors: sql<number>`count(case when ${vendors.status} = 'active' then 1 end)`,
    }).from(vendors),
    db.select({ totalParcels: sql<number>`count(*)` }).from(parcels),
    db.select({ totalReturns: sql<number>`count(*)` }).from(returnProofs),
    db.select({
      totalClaims: sql<number>`count(*)`,
      savedAmount: sql<number>`coalesce(sum(${returnClaims.savedAmount}), 0)`,
    }).from(returnClaims),
    db.select({
      verifiedCustomers: sql<number>`count(distinct ${customerVideoViews.customerMobile})`,
    }).from(customerVideoViews),
  ]);

  return NextResponse.json({
    totalVendors: Number(vendorStats?.totalVendors || 0),
    activeVendors: Number(vendorStats?.activeVendors || 0),
    totalParcels: Number(parcelStats?.totalParcels || 0),
    totalReturns: Number(returnStats?.totalReturns || 0),
    totalClaims: Number(claimStats?.totalClaims || 0),
    savedAmount: Number(claimStats?.savedAmount || 0),
    verifiedCustomers: Number(viewStats?.verifiedCustomers || 0),
  }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
