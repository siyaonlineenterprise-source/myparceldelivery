import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("shipping label batch is vendor-private and grouped by delivery partner", async () => {
  const route = await source("app/api/shipping-labels/route.ts");
  assert.match(route, /eq\(marketplaceOrders\.vendorId,\s*vendor\.vendorId\)/);
  assert.match(route, /eq\(marketplaceOrders\.deliveryPartner,\s*partner\)/);
  assert.match(route, /PDFDocument\.create\(\)/);
  assert.match(route, /Content-Disposition/);
  assert.match(route, /Cache-Control", "private, no-store, max-age=0"/);
});

test("vendor Home shows clickable total order quantity and courier-wise label actions", async () => {
  const panel = await source("app/admin/page.tsx");
  assert.match(panel, /Total Order Quantity/);
  assert.match(panel, /setShippingLabelsOpen\(true\)/);
  assert.match(panel, /Courier-wise labels download \/ print/);
  assert.match(panel, /\/api\/shipping-labels\?partner=/);
  assert.match(panel, /Download &amp; Print/);
  assert.match(panel, /labelUrl:\s*firstValue/);
});
