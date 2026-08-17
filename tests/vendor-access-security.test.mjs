import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("master controls vendor user limit, per-user rate, and IP reset", async () => {
  const dashboard = await source("app/master/MasterDashboard.tsx");
  const vendorApi = await source("app/api/vendors/route.ts");
  assert.match(dashboard, /Users &amp; Rate/);
  assert.match(dashboard, /IP Reset/);
  assert.match(vendorApi, /action === "access_policy"/);
  assert.match(vendorApi, /action === "reset_ip_policy"/);
  assert.match(vendorApi, /userLimit/);
  assert.match(vendorApi, /extraUserRatePaise/);
});

test("vendor login enforces seat count and blocks the sixth IP change", async () => {
  const login = await source("app/api/vendor-login/route.ts");
  assert.match(login, /USER_LIMIT_REACHED/);
  assert.match(login, /device\.ipChangeCount >= 5/);
  assert.match(login, /IP_CHANGE_LIMIT_EXCEEDED/);
  assert.match(login, /ipPolicyBlocked: true/);
  assert.match(login, /eq\(vendorSessions\.ipHash, currentIpHash\)/);
});

test("private vendor APIs bind sessions to the request IP", async () => {
  const routes = [
    "app/api/claims/route.ts",
    "app/api/follow-ups/route.ts",
    "app/api/marketplace-orders/route.ts",
    "app/api/parcels/route.ts",
    "app/api/reconciliation/route.ts",
    "app/api/report-requests/route.ts",
    "app/api/returns/route.ts",
    "app/api/shipping-labels/route.ts",
    "app/api/upload/route.ts",
    "app/api/vendor-stats/route.ts",
    "app/api/video-download/route.ts",
  ];
  for (const route of routes) {
    const code = await source(route);
    assert.match(code, /vendorSessions\.ipHash/, `${route} must validate the session IP`);
  }
});
