import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Buy Now opens a selected-plan buyer form without payment checkout", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(page, /YOU CLICKED BUY NOW ON/);
  assert.match(page, /planName: buyerModalPlan\.name/);
  assert.match(page, /Payment abhi nahi hoga/);
  assert.doesNotMatch(page, /window\.location\.assign\(`\/admin/);
});

test("buyer leads are durable and master-only for reads and updates", async () => {
  const schema = await readFile(new URL("db/schema.ts", root), "utf8");
  const api = await readFile(new URL("app/api/buyer-leads/route.ts", root), "utf8");
  assert.match(schema, /export const buyerLeads = sqliteTable\("buyer_leads"/);
  assert.match(schema, /purchaseStage: text\("purchase_stage"\).*"Day 1 Purchase"/);
  assert.match(schema, /followUpStatus: text\("follow_up_status"/);
  assert.match(api, /export async function GET[\s\S]*hasMasterSession/);
  assert.match(api, /export async function PATCH[\s\S]*hasMasterSession/);
});

test("Master Panel highlights plan and supports buyer follow-up outcomes", async () => {
  const master = await readFile(new URL("app/master/MasterDashboard.tsx", root), "utf8");
  assert.match(master, /New Buyer Leads/);
  assert.match(master, /Interested Plan/);
  assert.match(master, />✓ Connect</);
  assert.match(master, />× Not Connect</);
  assert.match(master, /Yes — Work Karega/);
  assert.match(master, /No — Not Interested/);
  assert.match(master, /From Time/);
  assert.match(master, /To Time/);
});
