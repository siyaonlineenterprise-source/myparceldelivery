import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("delivery partner is stored from marketplace order through parcel and master tracking", async () => {
  const [schema, importRoute, parcelRoute, masterRoute] = await Promise.all([
    read("db/schema.ts"),
    read("app/api/marketplace-orders/route.ts"),
    read("app/api/parcels/route.ts"),
    read("app/api/master-orders/route.ts"),
  ]);

  assert.match(schema, /deliveryPartner:\s*text\("delivery_partner"\)/);
  assert.match(importRoute, /deliveryPartner:\s*String\(order\.deliveryPartner/);
  assert.match(parcelRoute, /deliveryPartner:\s*marketplaceOrders\.deliveryPartner/);
  assert.match(masterRoute, /deliveryPartner:\s*marketplaceOrders\.deliveryPartner/);
});

test("master follow-ups view opens immediately and exposes loading feedback", async () => {
  const dashboard = await read("app/master/MasterDashboard.tsx");
  assert.match(dashboard, /setView\(nextView\)/);
  assert.match(dashboard, /if \(nextView === "followUps"\) void loadFollowUps\(false\)/);
  assert.match(dashboard, /followUpsLoading \? "↻ Refreshing…"/);
  assert.match(dashboard, /headers:\s*\{\s*"x-mpd-panel":\s*"master"\s*\}/);
});
