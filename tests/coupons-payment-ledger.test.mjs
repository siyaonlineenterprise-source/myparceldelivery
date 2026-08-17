import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("coupon is locked to the vendor mobile, date window, and one successful use", async () => {
  const helper = await source("app/coupons.ts");
  const orderRoute = await source("app/api/payments/order/route.ts");
  const payments = await source("app/payments.ts");
  assert.match(helper, /const mobile = cleanMobile\(mobileValue\)/);
  assert.match(helper, /eq\(coupons\.mobile,\s*mobile\)/);
  assert.match(helper, /Coupon abhi active nahi hua hai/);
  assert.match(helper, /Coupon expire ho chuka hai/);
  assert.match(orderRoute, /status:\s*"reserved"/);
  assert.match(payments, /status:\s*"used"/);
  assert.match(payments, /usedAt:\s*paidAt/);
});

test("master can create, pause, resume, and archive coupons with deletion audit", async () => {
  const route = await source("app/api/master-coupons/route.ts");
  assert.match(route, /hasMasterSession/);
  assert.match(route, /discountPercent < 1 \|\| discountPercent > 100/);
  assert.match(route, /action\?: "pause" \| "resume"/);
  assert.match(route, /db\.insert\(deletedCoupons\)/);
  assert.match(route, /deletedBy:\s*masterActor\(\)/);
  assert.match(route, /deleteReason/);
});

test("100 percent coupon activates without opening Razorpay checkout", async () => {
  const orderRoute = await source("app/api/payments/order/route.ts");
  assert.match(orderRoute, /amounts\.totalAmountPaise === 0 && coupon/);
  assert.match(orderRoute, /freeActivation:\s*true/);
  assert.match(orderRoute, /activateSubscription\(internalOrderId/);
});

test("master payment ledger is read-only and shows only Razorpay website orders", async () => {
  const route = await source("app/api/master-payments/route.ts");
  const ui = await source("app/master/PaymentLedger.tsx");
  assert.match(route, /like\(paymentOrders\.razorpayOrderId,\s*"order_%"\)/);
  assert.doesNotMatch(route, /export async function PATCH/);
  assert.match(ui, /Razorpay Website Payments/);
  assert.match(ui, /item\.razorpayOrderId\.startsWith\("order_"\)/);
  assert.doesNotMatch(ui, /Received Amount \(₹\)/);
  assert.doesNotMatch(ui, /saveReconciliation/);
  assert.match(ui, /Download Excel/);
});

test("master Excel downloads require an active search or date filter", async () => {
  const dashboard = await source("app/master/MasterDashboard.tsx");
  const payments = await source("app/master/PaymentLedger.tsx");
  const coupons = await source("app/master/CouponManager.tsx");
  for (const ui of [dashboard, payments, coupons]) {
    assert.match(ui, /const hasActiveFilter = Boolean\(/);
    assert.match(ui, /disabled=\{!hasActiveFilter\}/);
  }
  assert.match(dashboard, /if \(!hasActiveFilter\) return/);
  assert.match(payments, /if \(hasActiveFilter\) downloadPaymentsExcel/);
  assert.match(coupons, /if \(!hasActiveFilter\) return/);
});

test("public marketplace logos are non-clickable and highlight on hover", async () => {
  const page = await source("app/page.tsx");
  const css = await source("app/globals.css");
  assert.match(page, /\/brands\/meesho\.png/);
  assert.match(page, /\/brands\/amazon\.svg/);
  assert.match(page, /\/brands\/flipkart\.svg/);
  assert.match(page, /\/brands\/myntra\.svg/);
  assert.match(page, /\/brands\/woocommerce\.svg/);
  assert.doesNotMatch(page, /marketplaceBrands\.map[\s\S]{0,500}<a/);
  assert.match(css, /\.market-brand:hover/);
  assert.match(css, /transform:scale\(1\.22\)/);
});
