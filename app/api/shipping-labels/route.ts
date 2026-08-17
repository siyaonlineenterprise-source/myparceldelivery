import { NextRequest } from "next/server";
import { and, asc, eq, gt } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { getDb } from "../../../db";
import { hashIp, requestIp } from "../../ip-security";
import { marketplaceOrders, vendorSessions, vendors } from "../../../db/schema";

export const runtime = "edge";

const MAX_LABEL_FILES = 500;
const MAX_TOTAL_BYTES = 60 * 1024 * 1024;
const DEFAULT_ALLOWED_SUFFIXES = [
  ".meesho.com",
  ".meesho.io",
  ".amazonaws.com",
  ".cloudfront.net",
  ".googleapis.com",
  ".googleusercontent.com",
];

function privateJson(body: unknown, init?: ResponseInit) {
  const response = Response.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Cookie");
  return response;
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

function allowedLabelUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return null;
    const hostname = url.hostname.toLowerCase();
    const configured = (process.env.SHIPPING_LABEL_ALLOWED_HOSTS || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    const suffixes = configured.length ? configured : DEFAULT_ALLOWED_SUFFIXES;
    if (!suffixes.some((suffix) => hostname === suffix.replace(/^\./, "") || hostname.endsWith(suffix))) return null;
    return url;
  } catch {
    return null;
  }
}

function safeFilePart(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) || "courier";
}

async function appendLabel(output: PDFDocument, bytes: Uint8Array, contentType: string) {
  if (contentType.includes("application/pdf") || bytes.slice(0, 4).every((value, index) => value === [37, 80, 68, 70][index])) {
    const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = await output.copyPages(source, source.getPageIndices());
    pages.forEach((page) => output.addPage(page));
    return;
  }

  const isPng = contentType.includes("image/png") || (bytes[0] === 137 && bytes[1] === 80);
  const image = isPng ? await output.embedPng(bytes) : await output.embedJpg(bytes);
  const page = output.addPage([288, 432]);
  const scale = Math.min(276 / image.width, 420 / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  page.drawImage(image, { x: (288 - width) / 2, y: (432 - height) / 2, width, height });
}

export async function GET(request: NextRequest) {
  const vendor = await vendorFromRequest(request);
  if (!vendor) return privateJson({ error: "Active vendor login required" }, { status: 401 });
  const partner = request.nextUrl.searchParams.get("partner")?.trim().slice(0, 60);
  if (!partner) return privateJson({ error: "Delivery partner select kijiye" }, { status: 400 });

  const db = await getDb();
  const orders = await db.select({
    orderId: marketplaceOrders.orderId,
    trackingId: marketplaceOrders.trackingId,
    labelUrl: marketplaceOrders.labelUrl,
  })
    .from(marketplaceOrders)
    .where(and(
      eq(marketplaceOrders.vendorId, vendor.vendorId),
      eq(marketplaceOrders.deliveryPartner, partner),
    ))
    .orderBy(asc(marketplaceOrders.id))
    .limit(MAX_LABEL_FILES);

  const uniqueUrls = [...new Set(orders.map((order) => order.labelUrl.trim()).filter(Boolean))];
  if (!uniqueUrls.length) {
    return privateJson({ error: `${partner} ke shipping labels abhi available nahi hain` }, { status: 404 });
  }

  const output = await PDFDocument.create();
  let totalBytes = 0;
  let mergedFiles = 0;
  const skipped: string[] = [];

  for (const rawUrl of uniqueUrls) {
    const url = allowedLabelUrl(rawUrl);
    if (!url) {
      skipped.push("Unsupported label host");
      continue;
    }
    try {
      const response = await fetch(url, { redirect: "follow" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      totalBytes += bytes.byteLength;
      if (totalBytes > MAX_TOTAL_BYTES) {
        return privateJson({ error: "Label batch 60 MB se bada hai. Chhote batch mein download kijiye." }, { status: 413 });
      }
      await appendLabel(output, bytes, response.headers.get("content-type") || "");
      mergedFiles += 1;
    } catch {
      skipped.push("Label download failed");
    }
  }

  if (!mergedFiles || output.getPageCount() === 0) {
    return privateJson({
      error: "Shipping labels merge nahi hue. Label link expire ya unsupported ho sakti hai.",
      skipped: skipped.length,
    }, { status: 422 });
  }

  output.setTitle(`${partner} Shipping Labels`);
  output.setSubject(`${orders.length} vendor orders grouped by delivery partner`);
  const pdf = await output.save();
  const date = new Date().toISOString().slice(0, 10);
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeFilePart(partner)}-${date}-shipping-labels.pdf"`,
      "Cache-Control": "private, no-store, max-age=0",
      "Vary": "Cookie",
      "X-MPD-Label-Files": String(mergedFiles),
      "X-MPD-Skipped-Labels": String(skipped.length),
    },
  });
}
