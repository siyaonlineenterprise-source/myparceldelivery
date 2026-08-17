import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { buyerLeads } from "../../../db/schema";
import { hasMasterSession } from "../../master-auth";

export const runtime = "edge";

const plans = ["Trial", "Nano", "Starter", "Growth"] as const;
const followUpStatuses = ["new", "connect", "not_connect"] as const;
const customerDecisions = ["pending", "yes", "no"] as const;

function privateJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}

function cleanText(value: unknown, max: number) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function isIsoDateTime(value: string) {
  return !value || (!Number.isNaN(Date.parse(value)) && value.length <= 40);
}

export async function GET(request: NextRequest) {
  if (!await hasMasterSession(request)) {
    return privateJson({ error: "Master login required" }, { status: 401 });
  }
  const db = await getDb();
  const rows = await db.select().from(buyerLeads).orderBy(desc(buyerLeads.id)).limit(1000);
  return privateJson({ leads: rows });
}

export async function POST(request: NextRequest) {
  const body = await request.json() as Record<string, unknown>;
  if (cleanText(body.website, 100)) {
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  const contactName = cleanText(body.contactName, 120);
  const mobile = String(body.mobile || "").replace(/\D/g, "").slice(-10);
  const whatsapp = String(body.whatsapp || body.mobile || "").replace(/\D/g, "").slice(-10);
  const email = cleanText(body.email, 160).toLowerCase();
  const businessName = cleanText(body.businessName, 160);
  const city = cleanText(body.city, 100);
  const state = cleanText(body.state, 100);
  const marketplace = cleanText(body.marketplace, 100);
  const planName = cleanText(body.planName, 20);
  const monthlyOrders = Math.max(0, Math.min(1_000_000, Math.round(Number(body.monthlyOrders || 0))));
  const retentionDays = [30, 60, 90].includes(Number(body.retentionDays)) ? Number(body.retentionDays) : 30;
  const note = cleanText(body.note, 800);
  const preferredContactTime = cleanText(body.preferredContactTime, 80) || "Any time";

  if (contactName.length < 2 || businessName.length < 2 || city.length < 2 || state.length < 2 || marketplace.length < 2) {
    return NextResponse.json({ error: "Name, business, city, state aur marketplace complete kijiye" }, { status: 400 });
  }
  if (!/^[6-9]\d{9}$/.test(mobile) || !/^[6-9]\d{9}$/.test(whatsapp)) {
    return NextResponse.json({ error: "Sahi 10-digit mobile aur WhatsApp number enter kijiye" }, { status: 400 });
  }
  if (!plans.includes(planName as typeof plans[number])) {
    return NextResponse.json({ error: "Valid plan select kijiye" }, { status: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email address sahi enter kijiye" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const leadCode = `MPD-${now.slice(2, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const db = await getDb();
  const inserted = await db.insert(buyerLeads).values({
    leadCode,
    contactName,
    mobile,
    whatsapp,
    email,
    businessName,
    city,
    state,
    marketplace,
    monthlyOrders,
    planName: planName as typeof plans[number],
    retentionDays,
    preferredContactTime,
    note,
    purchaseStage: "Day 1 Purchase",
    followUpStatus: "new",
    customerDecision: "pending",
    createdAt: now,
    updatedAt: now,
  }).returning({ id: buyerLeads.id });

  return NextResponse.json({
    ok: true,
    id: inserted[0]?.id,
    leadCode,
    createdAt: now,
    message: "Details save ho gayi. Hamari team aapse jaldi connect karegi.",
  }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  if (!await hasMasterSession(request)) {
    return privateJson({ error: "Master login required" }, { status: 401 });
  }
  const body = await request.json() as Record<string, unknown>;
  const id = Number(body.id || 0);
  const followUpStatus = cleanText(body.followUpStatus, 30);
  const customerDecision = cleanText(body.customerDecision, 20);
  const nextFollowUpAt = cleanText(body.nextFollowUpAt, 40);
  const masterNote = cleanText(body.masterNote, 1200);

  if (!Number.isInteger(id) || id < 1) {
    return privateJson({ error: "Valid buyer lead required hai" }, { status: 400 });
  }
  if (!followUpStatuses.includes(followUpStatus as typeof followUpStatuses[number])) {
    return privateJson({ error: "Connect ya Not Connect status select kijiye" }, { status: 400 });
  }
  if (!customerDecisions.includes(customerDecision as typeof customerDecisions[number])) {
    return privateJson({ error: "Customer decision Pending, Yes ya No select kijiye" }, { status: 400 });
  }
  if (!isIsoDateTime(nextFollowUpAt)) {
    return privateJson({ error: "Next follow-up date/time sahi select kijiye" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const db = await getDb();
  const updated = await db.update(buyerLeads).set({
    followUpStatus: followUpStatus as typeof followUpStatuses[number],
    customerDecision: customerDecision as typeof customerDecisions[number],
    nextFollowUpAt,
    masterNote,
    lastContactedAt: followUpStatus === "connect" ? now : "",
    updatedAt: now,
  }).where(eq(buyerLeads.id, id)).returning({ id: buyerLeads.id });

  if (!updated[0]) return privateJson({ error: "Buyer lead nahi mili" }, { status: 404 });
  return privateJson({ ok: true, updatedAt: now });
}
