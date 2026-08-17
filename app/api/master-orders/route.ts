import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { marketplaceOrders, vendors } from "../../../db/schema";
import { hasMasterSession } from "../../master-auth";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  if (!await hasMasterSession(request)) {
    return NextResponse.json({ error: "Master login required" }, { status: 401 });
  }
  const db = await getDb();
  const orders = await db.select({
    id: marketplaceOrders.id,
    vendorName: vendors.businessName,
    vendorCode: vendors.vendorCode,
    marketplace: marketplaceOrders.marketplace,
    orderId: marketplaceOrders.orderId,
    trackingId: marketplaceOrders.trackingId,
    deliveryPartner: marketplaceOrders.deliveryPartner,
    bagId: marketplaceOrders.bagId,
    customerName: marketplaceOrders.customerName,
    customerAddress: marketplaceOrders.customerAddress,
    customerPincode: marketplaceOrders.customerPincode,
    orderDate: marketplaceOrders.orderDate,
    packingStatus: marketplaceOrders.packingStatus,
    packedAt: marketplaceOrders.packedAt,
  })
    .from(marketplaceOrders)
    .innerJoin(vendors, eq(marketplaceOrders.vendorId, vendors.id))
    .orderBy(desc(marketplaceOrders.id))
    .limit(500);
  const response = NextResponse.json({ orders });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Cookie");
  return response;
}
