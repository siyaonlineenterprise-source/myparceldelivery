import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("master navigation does not expose Packing Studio", async () => {
  const dashboard = await source("app/master/MasterDashboard.tsx");
  assert.doesNotMatch(dashboard, /href="\/admin">[^<]*Packing Studio/);
});

test("vendor reconciliation is the default Home and first navigation section", async () => {
  const panel = await source("app/admin/page.tsx");
  assert.match(panel, /useState<AdminView>\("integration"\)/);
  assert.match(panel, /setView\("integration"\)/);
  const homeButton = panel.indexOf('onClick={() => void openView("integration")}>⌂ Home</button>');
  const workSelectButton = panel.indexOf('onClick={() => void openView("home")}>⌂ Work Select</button>');
  assert.notEqual(homeButton, -1);
  assert.notEqual(workSelectButton, -1);
  assert.ok(homeButton < workSelectButton);
  assert.doesNotMatch(panel, />₹ Orders &amp; Payments<\/button>/);
});

test("vendor report reads are tenant-scoped and never cache across sessions", async () => {
  const route = await source("app/api/report-requests/route.ts");
  assert.match(route, /where\(eq\(reportRequests\.vendorId,\s*vendor!\.vendorId\)\)/);
  assert.match(route, /Cache-Control", "private, no-store, max-age=0"/);
  assert.match(route, /Vary", "Cookie"/);
});

test("vendor dashboard metrics are private and scoped to the logged-in vendor", async () => {
  const route = await source("app/api/vendor-stats/route.ts");
  const panel = await source("app/admin/page.tsx");
  assert.match(route, /eq\(returnClaims\.vendorId,\s*vendor\.vendorId\)/);
  assert.match(route, /eq\(customerVideoViews\.vendorId,\s*vendor\.vendorId\)/);
  assert.match(route, /eq\(marketplaceOrders\.vendorId,\s*vendor\.vendorId\)/);
  assert.match(route, /eq\(marketplaceOrders\.packingStatus,\s*"pending"\)/);
  assert.match(route, /Cache-Control", "private, no-store, max-age=0"/);
  assert.match(route, /Vary", "Cookie"/);
  assert.match(panel, /fetch\("\/api\/vendor-stats"/);
  assert.doesNotMatch(panel, /fetch\("\/api\/public-stats"/);
});

test("marketplace orders stay vendor-private and a matching packing scan marks only that vendor order packed", async () => {
  const ordersRoute = await source("app/api/marketplace-orders/route.ts");
  const parcelsRoute = await source("app/api/parcels/route.ts");
  const panel = await source("app/admin/page.tsx");
  assert.match(ordersRoute, /eq\(marketplaceOrders\.vendorId,\s*vendor\.vendorId\)/);
  assert.match(ordersRoute, /trackingId:\s*originalTrackingId/);
  assert.match(parcelsRoute, /eq\(marketplaceOrders\.vendorId,\s*vendor\.vendorId\)/);
  assert.match(parcelsRoute, /eq\(marketplaceOrders\.trackingKey,\s*trackingId\)/);
  assert.match(parcelsRoute, /packingStatus:\s*"packed"/);
  assert.match(parcelsRoute, /set\(\{\s*bagId,\s*packingStatus:\s*"packed"/);
  assert.match(panel, /Today Orders/);
  assert.match(panel, /Packing Baaki/);
});

test("an incomplete same-vendor packing record can resume without weakening cross-vendor duplicate protection", async () => {
  const route = await source("app/api/parcels/route.ts");
  assert.match(route, /duplicate\.length === 1 && duplicate\[0\]\.vendorId === vendor\.vendorId/);
  assert.match(route, /duplicate\[0\]\.uploadStatus !== "uploaded"/);
  assert.match(route, /!duplicate\[0\]\.videoUrl/);
  assert.match(route, /resumed:\s*recordingIncomplete/);
  assert.match(route, /completed parcel/);
});

test("payment reconciliation is vendor-private and matches settlement rows by order reference", async () => {
  const route = await source("app/api/reconciliation/route.ts");
  const panel = await source("app/admin/page.tsx");
  assert.match(route, /eq\(settlementRecords\.vendorId,\s*vendor\.vendorId\)/);
  assert.match(route, /eq\(marketplaceOrders\.vendorId,\s*vendor\.vendorId\)/);
  assert.match(route, /settlementByOrder\.get\(orderKey\(order\.orderId\)\)/);
  assert.match(route, /Cache-Control", "private, no-store, max-age=0"/);
  assert.match(panel, /Meesho Orders & Payment Reconciliation/);
  assert.match(panel, /Settlement CSV Match Karo/);
});

test("vendor creation succeeds even when Google Drive folder setup is pending", async () => {
  const route = await source("app/api/vendors/route.ts");
  const dashboard = await source("app/master/MasterDashboard.tsx");
  assert.match(route, /await db\.insert\(vendors\)/);
  assert.match(route, /drivePending:\s*true/);
  assert.match(route, /Vendor account ban gaya\. Drive folder baad mein connect hoga/);
  assert.match(dashboard, /data\.drivePending/);
});

test("vendor mobile numbers are unique across active and deleted vendor records", async () => {
  const route = await source("app/api/vendors/route.ts");
  const schema = await source("db/schema.ts");
  assert.match(schema, /vendors_mobile_unique/);
  assert.match(schema, /deletedVendors = sqliteTable\("deleted_vendors"/);
  assert.match(route, /where\(eq\(vendors\.mobile,\s*mobile\)\)/);
  assert.match(route, /previousVendor\?\.status === "deleted"/);
  assert.match(route, /approvalRequired:\s*true/);
});

test("vendor deletion archives the account, ends sessions, and requires master approval before restore", async () => {
  const route = await source("app/api/vendors/route.ts");
  const dashboard = await source("app/master/MasterDashboard.tsx");
  assert.match(route, /export async function DELETE/);
  assert.match(route, /db\.insert\(deletedVendors\)/);
  assert.match(route, /status:\s*"deleted"/);
  assert.match(route, /db\.delete\(vendorSessions\)/);
  assert.match(route, /body\.action === "approve_reactivation"/);
  assert.match(route, /approvalStatus:\s*"pending"/);
  assert.match(dashboard, /Deleted Vendors/);
  assert.match(dashboard, /Approve &amp; Restore/);
  assert.match(dashboard, /filtered-deleted-vendors/);
});

test("master filters export only the current filtered section and exclude customer verification data", async () => {
  const dashboard = await source("app/master/MasterDashboard.tsx");
  const coupons = await source("app/master/CouponManager.tsx");
  const payments = await source("app/master/PaymentLedger.tsx");
  assert.match(dashboard, /downloadCurrentFilteredData/);
  assert.match(dashboard, /filteredTrackingOrders\.map/);
  assert.match(dashboard, /filteredParcels\.map/);
  assert.match(dashboard, /filteredClaims\.map/);
  assert.match(dashboard, /filteredFollowUps\.map/);
  assert.match(dashboard, /filteredReports\.map/);
  assert.match(dashboard, /!\["payments", "coupons", "customers"\]\.includes\(view\)/);
  assert.match(coupons, /filteredCoupons\.map/);
  assert.match(payments, /downloadPaymentsExcel\(filteredPayments\)/);
});

test("customer video is unlocked only by the pincode stored for that shipping-label tracking record", async () => {
  const route = await source("app/api/customer-track/route.ts");
  const panel = await source("app/customer/page.tsx");
  assert.match(route, /enteredPincode !== parcel\.pincode/);
  assert.doesNotMatch(route, /FIXED_CUSTOMER_PIN/);
  assert.doesNotMatch(route, /customerName:\s*name/);
  assert.match(panel, /Shipping Label Pincode/);
  assert.doesNotMatch(panel, /10-digit mobile number/);
});

test("master tracking combines shipping-label fields across vendors behind master authentication", async () => {
  const route = await source("app/api/master-orders/route.ts");
  const dashboard = await source("app/master/MasterDashboard.tsx");
  assert.match(route, /hasMasterSession\(request\)/);
  assert.match(route, /customerAddress:\s*marketplaceOrders\.customerAddress/);
  assert.match(route, /customerPincode:\s*marketplaceOrders\.customerPincode/);
  assert.match(route, /bagId:\s*marketplaceOrders\.bagId/);
  assert.match(dashboard, /Master Tracking/);
  assert.match(dashboard, /All Vendor Shipping Labels/);
});

test("shared record APIs require an explicit master request before returning all vendors", async () => {
  for (const path of ["app/api/parcels/route.ts", "app/api/claims/route.ts", "app/api/report-requests/route.ts"]) {
    const route = await source(path);
    assert.match(route, /request\.headers\.get\("x-mpd-panel"\) === "master"/);
  }
  const dashboard = await source("app/master/MasterDashboard.tsx");
  assert.match(dashboard, /"x-mpd-panel": "master"/);
});

test("master dashboard totals aggregate all vendor records behind master authentication", async () => {
  const route = await source("app/api/master-stats/route.ts");
  const dashboard = await source("app/master/MasterDashboard.tsx");
  assert.match(route, /hasMasterSession\(request\)/);
  assert.match(route, /totalParcels: sql<number>`count\(\*\)`/);
  assert.match(route, /savedAmount: sql<number>`coalesce\(sum/);
  assert.match(dashboard, /Till-Date Packed Parcels/);
  assert.match(dashboard, /Sab vendors ka total/);
});

test("changing vendor sessions clears all private workspace data", async () => {
  const panel = await source("app/admin/page.tsx");
  assert.match(panel, /function resetVendorWorkspace\(\)/);
  assert.match(panel, /setParcels\(\[\]\)/);
  assert.match(panel, /setReturnProofs\(\[\]\)/);
  assert.match(panel, /setReportRequests\(\[\]\)/);
  assert.match(panel, /resetVendorWorkspace\(\);\s*setVendor\(data\.vendor\)/);
  assert.match(panel, /await fetch\("\/api\/vendor-login", \{ method: "DELETE" \}\);\s*resetVendorWorkspace\(\)/);
});

test("failed uploads never trigger an automatic browser download", async () => {
  const panel = await source("app/admin/page.tsx");
  assert.doesNotMatch(panel, /document\.createElement\("a"\)[\s\S]{0,300}a\.download/);
  assert.match(panel, /Video automatic download nahi ki gayi/);
});

test("manual video downloads are restricted to the logged-in vendor tracking id", async () => {
  const route = await source("app/api/video-download/route.ts");
  assert.match(route, /eq\(parcels\.vendorId,\s*vendor\.vendorId\)/);
  assert.match(route, /eq\(returnProofs\.vendorId,\s*vendor\.vendorId\)/);
  assert.match(route, /Content-Disposition", `attachment/);
});

test("return records include claim state and show follow-up plus manual video download", async () => {
  const route = await source("app/api/returns/route.ts");
  const panel = await source("app/admin/page.tsx");
  assert.match(route, /claimId:\s*returnClaims\.id/);
  assert.match(route, /\.leftJoin\(returnClaims,\s*eq\(returnClaims\.returnProofId,\s*returnProofs\.id\)\)/);
  assert.match(panel, /☎ Follow Up/);
  assert.match(panel, /↓ Download Video/);
  assert.match(panel, /↓ Video Pending/);
});

test("follow ups require a claim owned by the logged-in vendor", async () => {
  const route = await source("app/api/follow-ups/route.ts");
  assert.match(route, /eq\(returnClaims\.vendorId,\s*vendor\.vendorId\)/);
  assert.match(route, /appendFollowUpRow/);
  assert.match(route, /Cache-Control", "private, no-store, max-age=0"/);
});
