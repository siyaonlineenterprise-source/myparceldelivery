import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { parcels, returnProofs, vendors } from "../../../db/schema";
import { hasMasterSession } from "../../master-auth";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  if (!await hasMasterSession(request)) {
    return NextResponse.json({ error: "Master login required" }, { status: 401 });
  }

  const db = await getDb();
  const [parcelRecords, returnRecords] = await Promise.all([
    db.select({
      id: parcels.id,
      vendorCode: vendors.vendorCode,
      createdAt: parcels.createdAt,
    })
      .from(parcels)
      .innerJoin(vendors, eq(parcels.vendorId, vendors.id))
      .orderBy(desc(parcels.id))
      .limit(5000),
    db.select({
      id: returnProofs.id,
      vendorCode: vendors.vendorCode,
      createdAt: returnProofs.createdAt,
    })
      .from(returnProofs)
      .innerJoin(vendors, eq(returnProofs.vendorId, vendors.id))
      .orderBy(desc(returnProofs.id))
      .limit(5000),
  ]);

  return NextResponse.json(
    { parcels: parcelRecords, returns: returnRecords },
    { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } },
  );
}
