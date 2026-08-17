import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Razorpay order amount is calculated from the server-side plan catalog with 18% GST", async () => {
  const paymentHelper = await source("app/payments.ts");
  const orderRoute = await source("app/api/payments/order/route.ts");
  assert.match(paymentHelper, /Trial:\s*\{[^}]*durationDays:\s*7[^}]*baseAmountPaise:\s*9_900/);
  assert.match(paymentHelper, /baseAmountPaise:\s*18_800/);
  assert.match(paymentHelper, /baseAmountPaise:\s*150_000/);
  assert.match(paymentHelper, /baseAmountPaise:\s*255_000/);
  assert.match(paymentHelper, /userChargePaise = Math\.max\(0, safeUserLimit - 1\) \* safeUserRate/);
  assert.match(paymentHelper, /baseAmountPaise = plan\.baseAmountPaise \+ userChargePaise/);
  assert.match(paymentHelper, /Math\.round\(baseAmountPaise \* 18 \/ 100\)/);
  assert.match(orderRoute, /amount:\s*amounts\.totalAmountPaise/);
  assert.doesNotMatch(orderRoute, /body\.amount/);
});

test("7-day trial is available only once per vendor", async () => {
  const paymentHelper = await source("app/payments.ts");
  const orderRoute = await source("app/api/payments/order/route.ts");
  assert.match(paymentHelper, /vendorHasUsedTrial/);
  assert.match(paymentHelper, /eq\(paymentOrders\.planName,\s*"Trial"\)/);
  assert.match(paymentHelper, /eq\(paymentOrders\.status,\s*"paid"\)/);
  assert.match(orderRoute, /planName === "Trial" && await vendorHasUsedTrial\(vendor\.vendorId\)/);
  assert.match(orderRoute, /status:\s*409/);
});

test("plan activates only after server signature and captured-payment verification", async () => {
  const verifyRoute = await source("app/api/payments/verify/route.ts");
  assert.match(verifyRoute, /hmacSha256Hex\(keySecret/);
  assert.match(verifyRoute, /timingSafeHexEqual\(expectedSignature,\s*receivedSignature\)/);
  assert.match(verifyRoute, /payment\.order_id === order\.razorpayOrderId/);
  assert.match(verifyRoute, /payment\.amount === order\.totalAmountPaise/);
  assert.match(verifyRoute, /payment\.status === "captured"/);
  assert.match(verifyRoute, /activateSubscription/);
});

test("Razorpay secrets stay server-side and are never embedded in the client", async () => {
  const admin = await source("app/admin/page.tsx");
  const orderRoute = await source("app/api/payments/order/route.ts");
  assert.doesNotMatch(admin, /RAZORPAY_KEY_SECRET/);
  assert.match(orderRoute, /process\.env\.RAZORPAY_KEY_SECRET/);
});

test("webhook validates the raw body signature before accepting captured payment", async () => {
  const webhook = await source("app/api/payments/webhook/route.ts");
  assert.match(webhook, /const rawBody = await request\.text\(\)/);
  assert.match(webhook, /x-razorpay-signature/);
  assert.match(webhook, /hmacSha256Hex\(secret,\s*rawBody\)/);
  assert.match(webhook, /event\.event === "order\.paid"/);
});
