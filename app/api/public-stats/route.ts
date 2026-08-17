import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { customerVideoViews, returnClaims, vendors } from "../../../db/schema";

export const runtime = "edge";

export async function GET() {
  const db = await getDb();
  const [vendorStats] = await db.select({
    activeVendors: sql<number>`count(*)`,
  }).from(vendors).where(eq(vendors.status, "active"));
  const [claimStats] = await db.select({
    savedAmount: sql<number>`coalesce(sum(${returnClaims.savedAmount}), 0)`,
    protectedVendors: sql<number>`count(distinct case when ${returnClaims.savedAmount} > 0 then ${returnClaims.vendorId} end)`,
  }).from(returnClaims);
  const [viewStats] = await db.select({
    customerViews: sql<number>`count(*)`,
  }).from(customerVideoViews);

  return NextResponse.json({
    activeVendors: Number(vendorStats?.activeVendors || 0),
    savedAmount: Number(claimStats?.savedAmount || 0),
    protectedVendors: Number(claimStats?.protectedVendors || 0),
    customerViews: Number(viewStats?.customerViews || 0),
  });
}
