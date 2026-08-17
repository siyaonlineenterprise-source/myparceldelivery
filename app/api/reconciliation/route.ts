import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gt } from "drizzle-orm";
import { getDb } from "../../../db";
import { hashIp, requestIp } from "../../ip-security";
import { marketplaceOrders, settlementRecords, vendorSessions, vendors } from "../../../db/schema";

export const runtime = "edge";

type SettlementStatus = "pending" | "paid" | "partial" | "held" | "returned";

function privateJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Cookie");
  return response;
}

function orderKey(value: string) {
  return value.trim().toUpperCase();
}

async function vendorFromRequest(request: NextRequest) {
  const token = request.cookies.get("mpd_vendor_session")?.value;
  if (!token) return null;
  const db = await getDb();
  const rows = await db.select({ vendorId: vendors.id, status: vendors.status })
    .from(vendorSessions)
    .innerJoin(vendors, eq(vendorSessions.vendorId, vendors.id))
    .where(and(eq(vendorSessions.token, token),
      eq(vendorSessions.ipHash, await hashIp(requestIp(request))), gt(vendorSessions.expiresAt, new Date().toISOString())))
    .limit(1);
  return rows[0]?.status === "active" ? rows[0] : null;
}

export async function GET(request: NextRequest) {
  const vendor = await vendorFromRequest(request);
  if (!vendor) return privateJson({ error: "Active vendor login required" }, { status: 401 });
  const db = await getDb();

  const orders = await db.select({
    id: marketplaceOrders.id,
    marketplace: marketplaceOrders.marketplace,
    orderId: marketplaceOrders.orderId,
    trackingId: marketplaceOrders.trackingId,
    deliveryPartner: marketplaceOrders.deliveryPartner,
    labelUrl: marketplaceOrders.labelUrl,
    orderDate: marketplaceOrders.orderDate,
    paymentMode: marketplaceOrders.paymentMode,
    orderAmountPaise: marketplaceOrders.orderAmountPaise,
    marketplaceStatus: marketplaceOrders.marketplaceStatus,
    packingStatus: marketplaceOrders.packingStatus,
  })
    .from(marketplaceOrders)
    .where(eq(marketplaceOrders.vendorId, vendor.vendorId))
    .orderBy(desc(marketplaceOrders.id))
    .limit(1000);

  const settlements = await db.select({
    id: settlementRecords.id,
    marketplace: settlementRecords.marketplace,
    orderRef: settlementRecords.orderRef,
    trackingId: settlementRecords.trackingId,
    grossAmountPaise: settlementRecords.grossAmountPaise,
    deductionsPaise: settlementRecords.deductionsPaise,
    netPaidPaise: settlementRecords.netPaidPaise,
    paymentStatus: settlementRecords.paymentStatus,
    paymentDate: settlementRecords.paymentDate,
    utr: settlementRecords.utr,
  })
    .from(settlementRecords)
    .where(eq(settlementRecords.vendorId, vendor.vendorId))
    .orderBy(desc(settlementRecords.id))
    .limit(1000);

  const settlementByOrder = new Map(settlements.map((item) => [orderKey(item.orderRef), item]));
  const matchedSettlementIds = new Set<number>();
  const rows = orders.map((order) => {
    const settlement = settlementByOrder.get(orderKey(order.orderId));
    if (settlement) matchedSettlementIds.add(settlement.id);
    const gross = settlement?.grossAmountPaise || order.orderAmountPaise || 0;
    const deductions = settlement?.deductionsPaise || 0;
    const paid = settlement?.netPaidPaise || 0;
    const expectedNet = Math.max(0, gross - deductions);
    const difference = expectedNet - paid;
    let status: SettlementStatus = settlement?.paymentStatus || "pending";
    if (status !== "returned" && status !== "held") {
      if (!settlement) status = "pending";
      else if (paid > 0 && Math.abs(difference) <= 100) status = "paid";
      else if (paid > 0) status = "partial";
    }
    return {
      orderId: order.orderId,
      trackingId: order.trackingId,
      orderDate: order.orderDate,
      paymentMode: order.paymentMode,
      marketplaceStatus: order.marketplaceStatus,
      packingStatus: order.packingStatus,
      grossAmountPaise: gross,
      deductionsPaise: deductions,
      netPaidPaise: paid,
      differencePaise: difference,
      paymentStatus: status,
      paymentDate: settlement?.paymentDate || "",
      utr: settlement?.utr || "",
      matched: Boolean(settlement),
    };
  });

  const shippingLabels = orders.map((order) => ({
    id: order.id,
    orderId: order.orderId,
    trackingId: order.trackingId,
    deliveryPartner: order.deliveryPartner || "Pending",
    labelAvailable: Boolean(order.labelUrl),
  }));

  const unmatchedSettlements = settlements
    .filter((item) => !matchedSettlementIds.has(item.id))
    .map((item) => ({
      orderId: item.orderRef,
      trackingId: item.trackingId,
      orderDate: "",
      paymentMode: "",
      marketplaceStatus: "",
      packingStatus: "pending",
      grossAmountPaise: item.grossAmountPaise,
      deductionsPaise: item.deductionsPaise,
      netPaidPaise: item.netPaidPaise,
      differencePaise: Math.max(0, item.grossAmountPaise - item.deductionsPaise) - item.netPaidPaise,
      paymentStatus: item.paymentStatus,
      paymentDate: item.paymentDate,
      utr: item.utr,
      matched: false,
    }));

  const allRows = [...rows, ...unmatchedSettlements];
  const stats = allRows.reduce((total, item) => {
    total.totalOrders += 1;
    total.grossAmountPaise += item.grossAmountPaise;
    total.deductionsPaise += item.deductionsPaise;
    total.netPaidPaise += item.netPaidPaise;
    if (item.paymentStatus === "paid") total.paidOrders += 1;
    else if (item.paymentStatus === "returned") total.returnedOrders += 1;
    else total.attentionOrders += 1;
    if (!item.matched) total.unmatchedOrders += 1;
    return total;
  }, {
    totalOrders: 0,
    paidOrders: 0,
    attentionOrders: 0,
    returnedOrders: 0,
    unmatchedOrders: 0,
    grossAmountPaise: 0,
    deductionsPaise: 0,
    netPaidPaise: 0,
  });

  return privateJson({ stats, rows: allRows.slice(0, 1000), shippingLabels });
}

export async function POST(request: NextRequest) {
  const vendor = await vendorFromRequest(request);
  if (!vendor) return privateJson({ error: "Active vendor login required" }, { status: 401 });
  const body = await request.json() as {
    sourceFile?: string;
    rows?: Array<{
      marketplace?: string;
      orderRef?: string;
      trackingId?: string;
      grossAmountPaise?: number;
      deductionsPaise?: number;
      netPaidPaise?: number;
      paymentStatus?: SettlementStatus;
      paymentDate?: string;
      utr?: string;
    }>;
  };
  const incoming = Array.isArray(body.rows) ? body.rows.slice(0, 1000) : [];
  if (!incoming.length) return privateJson({ error: "Settlement rows required hain" }, { status: 400 });

  const db = await getDb();
  let synced = 0;
  for (const row of incoming) {
    const orderRef = orderKey(String(row.orderRef || "")).slice(0, 160);
    if (!orderRef) continue;
    const now = new Date().toISOString();
    const paymentStatus: SettlementStatus = ["pending", "paid", "partial", "held", "returned"].includes(String(row.paymentStatus))
      ? row.paymentStatus as SettlementStatus
      : Number(row.netPaidPaise || 0) > 0 ? "paid" : "pending";
    const sharedValues = {
      trackingId: String(row.trackingId || "").trim().toUpperCase().slice(0, 160),
      grossAmountPaise: Math.max(0, Math.round(Number(row.grossAmountPaise || 0))),
      deductionsPaise: Math.max(0, Math.round(Number(row.deductionsPaise || 0))),
      netPaidPaise: Math.max(0, Math.round(Number(row.netPaidPaise || 0))),
      paymentStatus,
      paymentDate: String(row.paymentDate || "").trim().slice(0, 20),
      utr: String(row.utr || "").trim().slice(0, 160),
      sourceFile: String(body.sourceFile || "").trim().slice(0, 240),
      updatedAt: now,
    };
    const marketplace = String(row.marketplace || "Meesho").trim().slice(0, 40);
    await db.insert(settlementRecords).values({
      vendorId: vendor.vendorId,
      marketplace,
      orderRef,
      ...sharedValues,
    }).onConflictDoUpdate({
      target: [settlementRecords.vendorId, settlementRecords.marketplace, settlementRecords.orderRef],
      set: sharedValues,
    });
    synced += 1;
  }
  return privateJson({ ok: true, synced });
}
