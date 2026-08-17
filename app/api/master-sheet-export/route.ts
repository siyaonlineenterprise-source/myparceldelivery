import { NextRequest, NextResponse } from "next/server";
import { asc, eq, ne } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  coupons,
  deletedCoupons,
  parcels,
  paymentOrders,
  reportRequests,
  returnClaims,
  returnProofs,
  vendors,
} from "../../../db/schema";

export const runtime = "edge";

type CsvValue = string | number | null | undefined;

async function secureTokenMatch(received: string, expected: string) {
  if (!received || !expected) return false;
  const encoder = new TextEncoder();
  const [receivedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(received)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(receivedHash);
  const right = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

function csvCell(value: CsvValue) {
  let text = value === null || value === undefined ? "" : String(value);
  // Prevent database text from becoming a formula when Google Sheets imports it.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function csv(rows: CsvValue[][]) {
  if (rows.length === 0) return "\n";
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function vendorDisplayName(
  businessName: string,
  contactName: string,
  mobile: string,
  vendorCode: string,
) {
  const businessDigits = businessName.replace(/\D/g, "");
  const mobileDigits = mobile.replace(/\D/g, "");
  const businessIsMobile =
    businessDigits.length === 10 && businessDigits === mobileDigits;

  if (businessName && !businessIsMobile) return businessName;
  if (contactName) return contactName;
  return vendorCode;
}

type Database = Awaited<ReturnType<typeof getDb>>;

async function loadRows(sheet: string, db: Database): Promise<CsvValue[][] | null> {
  if (sheet === "orders") {
    const records = await db.select({
      createdAt: parcels.createdAt,
      vendorCode: vendors.vendorCode,
      businessName: vendors.businessName,
      contactName: vendors.contactName,
      mobile: vendors.mobile,
      trackingId: parcels.trackingId,
      bagId: parcels.bagId,
      deliveryPartner: parcels.deliveryPartner,
      videoUrl: parcels.videoUrl,
      uploadStatus: parcels.uploadStatus,
    }).from(parcels)
      .innerJoin(vendors, eq(parcels.vendorId, vendors.id))
      .orderBy(asc(parcels.id))
      .limit(5000);
    return records.map((record) => [
      record.createdAt,
      record.vendorCode,
      vendorDisplayName(record.businessName, record.contactName, record.mobile, record.vendorCode),
      record.trackingId,
      record.bagId,
      record.deliveryPartner,
      record.videoUrl,
      titleCase(record.uploadStatus),
      "Active",
      record.vendorCode,
    ]);
  }

  if (sheet === "returns") {
    const records = await db.select({
      createdAt: returnProofs.createdAt,
      vendorCode: vendors.vendorCode,
      businessName: vendors.businessName,
      contactName: vendors.contactName,
      mobile: vendors.mobile,
      trackingId: returnProofs.trackingId,
      returnType: returnProofs.returnType,
      videoUrl: returnProofs.videoUrl,
      uploadStatus: returnProofs.uploadStatus,
      claimId: returnClaims.id,
    }).from(returnProofs)
      .innerJoin(vendors, eq(returnProofs.vendorId, vendors.id))
      .leftJoin(returnClaims, eq(returnClaims.returnProofId, returnProofs.id))
      .orderBy(asc(returnProofs.id))
      .limit(5000);
    return records.map((record) => [
      record.createdAt,
      record.vendorCode,
      vendorDisplayName(record.businessName, record.contactName, record.mobile, record.vendorCode),
      record.trackingId,
      record.returnType.toUpperCase(),
      record.videoUrl,
      titleCase(record.uploadStatus),
      "Pending",
      record.claimId ? "Yes" : "No",
    ]);
  }

  if (sheet === "claims") {
    const records = await db.select({
      createdAt: returnClaims.createdAt,
      vendorCode: vendors.vendorCode,
      businessName: vendors.businessName,
      contactName: vendors.contactName,
      mobile: vendors.mobile,
      trackingId: returnClaims.trackingId,
      returnType: returnProofs.returnType,
      issueType: returnClaims.issueType,
      note: returnClaims.note,
      videoUrl: returnProofs.videoUrl,
      status: returnClaims.status,
    }).from(returnClaims)
      .innerJoin(returnProofs, eq(returnClaims.returnProofId, returnProofs.id))
      .innerJoin(vendors, eq(returnClaims.vendorId, vendors.id))
      .orderBy(asc(returnClaims.id))
      .limit(5000);
    return records.map((record) => [
      record.createdAt,
      record.vendorCode,
      vendorDisplayName(record.businessName, record.contactName, record.mobile, record.vendorCode),
      record.trackingId,
      record.returnType.toUpperCase(),
      record.issueType,
      record.note,
      record.videoUrl,
      record.status === "raised"
        ? "Registered"
        : record.status === "submitted"
          ? "Submitted to Meesho"
          : "Resolved",
      "",
      "",
      "",
      record.createdAt,
    ]);
  }

  if (sheet === "customers") {
    const records = await db.select({
      verifiedAt: parcels.updatedAt,
      vendorCode: vendors.vendorCode,
      businessName: vendors.businessName,
      contactName: vendors.contactName,
      mobile: vendors.mobile,
      trackingId: parcels.trackingId,
      customerName: parcels.customerName,
      customerMobile: parcels.customerMobile,
      pincode: parcels.pincode,
    }).from(parcels)
      .innerJoin(vendors, eq(parcels.vendorId, vendors.id))
      .where(ne(parcels.customerMobile, ""))
      .orderBy(asc(parcels.id))
      .limit(5000);
    return records.map((record) => [
      record.verifiedAt,
      record.vendorCode,
      vendorDisplayName(record.businessName, record.contactName, record.mobile, record.vendorCode),
      record.trackingId,
      record.customerName,
      record.customerMobile,
      record.pincode,
      "",
      "",
      "",
      "Verified",
    ]);
  }

  if (sheet === "reports") {
    const records = await db.select({
      createdAt: reportRequests.createdAt,
      updatedAt: reportRequests.updatedAt,
      vendorCode: vendors.vendorCode,
      businessName: vendors.businessName,
      contactName: vendors.contactName,
      mobile: vendors.mobile,
      reportType: reportRequests.reportType,
      dateFrom: reportRequests.dateFrom,
      dateTo: reportRequests.dateTo,
      note: reportRequests.note,
      status: reportRequests.status,
      masterNote: reportRequests.masterNote,
      reportUrl: reportRequests.reportUrl,
    }).from(reportRequests)
      .innerJoin(vendors, eq(reportRequests.vendorId, vendors.id))
      .orderBy(asc(reportRequests.id))
      .limit(5000);
    return records.map((record) => [
      record.createdAt,
      record.vendorCode,
      vendorDisplayName(record.businessName, record.contactName, record.mobile, record.vendorCode),
      titleCase(record.reportType),
      record.dateFrom,
      record.dateTo,
      record.note,
      titleCase(record.status),
      record.masterNote,
      record.reportUrl,
      ["ready", "sent", "rejected"].includes(record.status) ? record.updatedAt : "",
    ]);
  }

  if (sheet === "vendors") {
    const records = await db.select({
      vendorCode: vendors.vendorCode,
      businessName: vendors.businessName,
      contactName: vendors.contactName,
      mobile: vendors.mobile,
      status: vendors.status,
      createdAt: vendors.createdAt,
    }).from(vendors).orderBy(asc(vendors.id)).limit(2000);
    return records.map((record) => [
      record.vendorCode,
      vendorDisplayName(record.businessName, record.contactName, record.mobile, record.vendorCode),
      record.contactName,
      "",
      record.mobile,
      titleCase(record.status),
      record.createdAt,
      "",
      "None",
    ]);
  }

  if (sheet === "coupons") {
    const records = await db.select().from(coupons).orderBy(asc(coupons.id)).limit(5000);
    return records.map((record) => [
      record.code,
      record.mobile,
      record.discountPercent,
      record.startAt,
      record.expiresAt,
      titleCase(record.status),
      record.reservedUntil,
      record.usedAt,
      record.createdAt,
      record.createdBy,
      record.updatedAt,
    ]);
  }

  if (sheet === "deleted-coupons") {
    const records = await db.select().from(deletedCoupons).orderBy(asc(deletedCoupons.id)).limit(5000);
    return records.map((record) => [
      record.deletedAt,
      record.deletedBy,
      record.couponId,
      record.code,
      record.mobile,
      record.discountPercent,
      record.startAt,
      record.expiresAt,
      titleCase(record.finalStatus),
      record.usedAt,
      record.deleteReason,
      record.originalCreatedAt,
      record.createdBy,
    ]);
  }

  if (sheet === "payments") {
    const records = await db.select({
      createdAt: paymentOrders.createdAt,
      paidAt: paymentOrders.paidAt,
      vendorCode: vendors.vendorCode,
      businessName: vendors.businessName,
      contactName: vendors.contactName,
      mobile: vendors.mobile,
      planName: paymentOrders.planName,
      couponCode: paymentOrders.couponCode,
      discountPercent: paymentOrders.discountPercent,
      originalTotalAmountPaise: paymentOrders.originalTotalAmountPaise,
      expectedAmountPaise: paymentOrders.totalAmountPaise,
      receivedAmountPaise: paymentOrders.receivedAmountPaise,
      razorpayOrderId: paymentOrders.razorpayOrderId,
      razorpayPaymentId: paymentOrders.razorpayPaymentId,
      providerStatus: paymentOrders.providerStatus,
      reconciliationStatus: paymentOrders.reconciliationStatus,
      masterNote: paymentOrders.masterNote,
      reconciledAt: paymentOrders.reconciledAt,
      reconciledBy: paymentOrders.reconciledBy,
    }).from(paymentOrders)
      .innerJoin(vendors, eq(paymentOrders.vendorId, vendors.id))
      .orderBy(asc(paymentOrders.id))
      .limit(5000);
    return records.map((record) => [
      record.createdAt,
      record.paidAt,
      record.vendorCode,
      vendorDisplayName(record.businessName, record.contactName, record.mobile, record.vendorCode),
      record.mobile,
      record.planName,
      record.couponCode,
      record.discountPercent,
      record.originalTotalAmountPaise / 100,
      record.expectedAmountPaise / 100,
      record.receivedAmountPaise / 100,
      (record.receivedAmountPaise - record.expectedAmountPaise) / 100,
      record.razorpayOrderId,
      record.razorpayPaymentId,
      record.providerStatus,
      record.reconciliationStatus,
      record.masterNote,
      record.reconciledAt,
      record.reconciledBy,
    ]);
  }

  return null;
}

export async function GET(request: NextRequest) {
  const receivedToken = request.nextUrl.searchParams.get("token") || "";
  const expectedToken = process.env.GOOGLE_SHEET_SYNC_TOKEN || "";
  if (!await secureTokenMatch(receivedToken, expectedToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sheet = request.nextUrl.searchParams.get("sheet") || "";
  const db = await getDb();
  let rows: CsvValue[][] | null;

  if (sheet === "all") {
    rows = [];
    for (const key of ["orders", "returns", "claims", "customers", "reports", "vendors", "payments", "coupons", "deleted-coupons"]) {
      const sourceRows = await loadRows(key, db) || [];
      for (const sourceRow of sourceRows) {
        rows.push([key, ...sourceRow, ...Array(Math.max(0, 19 - sourceRow.length)).fill("")]);
      }
    }
  } else {
    rows = await loadRows(sheet, db);
  }

  if (!rows) {
    return NextResponse.json({ error: "Unknown sheet" }, { status: 400 });
  }

  return new NextResponse(csv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
