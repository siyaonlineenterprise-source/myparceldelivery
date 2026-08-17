"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import CouponManager from "./CouponManager";
import PaymentLedger from "./PaymentLedger";
import { downloadExcelWorkbook } from "./excel";
import BrandLogo from "../components/BrandLogo";

type Vendor = {
  id: number;
  businessName: string;
  contactName: string;
  mobile: string;
  vendorCode: string;
  status: "active" | "blocked";
  userLimit: number;
  extraUserRatePaise: number;
  activeUsers: number;
  maxIpChanges: number;
  lastMaskedIp: string;
  ipPolicyBlocked: boolean;
  ipBlockedAt: string;
  parcelCount: number;
  createdAt: string;
};
type DeletedVendor = {
  id: number;
  vendorId: number;
  businessName: string;
  contactName: string;
  mobile: string;
  vendorCode: string;
  parcelCount: number;
  originalCreatedAt: string;
  deletedAt: string;
  approvalStatus: "none" | "pending" | "approved" | "rejected";
  approvalRequestedAt: string;
  approvedAt: string;
  sheetSynced: boolean;
};
type ResetRequest = { id: number; vendorId: number; status: "pending"; createdAt: string };
type MasterView = "vendors" | "buyerLeads" | "payments" | "coupons" | "tracking" | "parcels" | "claims" | "followUps" | "customers" | "reports" | "settings";
type Parcel = { id: number; vendorId: number; vendorName: string; vendorCode: string; trackingId: string; bagId: string; uploadStatus: string; videoUrl: string; customerName: string; customerMobile: string; pincode: string; deliveryPartner: string; createdAt: string };
type Claim = { id: number; trackingId: string; portal: string; issueType: string; note: string; status: string; savedAmount: number; createdAt: string; returnType: string; videoUrl: string; uploadStatus: string; vendorName: string; vendorCode: string };
type ReportRequest = { id: number; reportType: string; dateFrom: string; dateTo: string; note: string; status: string; masterNote: string; reportUrl: string; createdAt: string; vendorName: string; vendorCode: string };
type FollowUp = { id: number; claimId: number; trackingId: string; personName: string; contactNumber: string; reason: string; status: "open" | "contacted" | "closed"; sheetSynced: boolean; createdAt: string; updatedAt: string; vendorName: string; vendorCode: string };
type MasterTrackingOrder = { id: number; vendorName: string; vendorCode: string; marketplace: string; orderId: string; trackingId: string; deliveryPartner: string; bagId: string; customerName: string; customerAddress: string; customerPincode: string; orderDate: string; packingStatus: "pending" | "packed"; packedAt: string };
type MasterStats = { totalVendors: number; activeVendors: number; totalParcels: number; totalReturns: number; totalClaims: number; savedAmount: number; verifiedCustomers: number };
type ActivityRecord = { id: number; vendorCode: string; createdAt: string };
type BuyerLead = {
  id: number;
  leadCode: string;
  contactName: string;
  mobile: string;
  whatsapp: string;
  email: string;
  businessName: string;
  city: string;
  state: string;
  marketplace: string;
  monthlyOrders: number;
  planName: "Trial" | "Nano" | "Starter" | "Growth";
  retentionDays: number;
  preferredContactTime: string;
  note: string;
  purchaseStage: string;
  followUpStatus: "new" | "connect" | "not_connect";
  customerDecision: "pending" | "yes" | "no";
  nextFollowUpAt: string;
  masterNote: string;
  lastContactedAt: string;
  createdAt: string;
  updatedAt: string;
};

const emptyForm = { businessName: "", contactName: "", mobile: "", vendorCode: "", pin: "", userLimit: "1", extraUserRate: "99" };
const indiaDateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
const indiaTimeFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

function parseRecordDate(value: string) {
  if (!value) return null;
  const normalized = value.includes("T") || /(?:Z|[+-]\d\d:\d\d)$/.test(value)
    ? value
    : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function indiaDateKey(value: string | Date) {
  const date = typeof value === "string" ? parseRecordDate(value) : value;
  return date ? indiaDateFormatter.format(date) : "";
}

function indiaTimeKey(value: string | Date) {
  const date = typeof value === "string" ? parseRecordDate(value) : value;
  return date ? indiaTimeFormatter.format(date) : "";
}

function offsetIndiaDate(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return indiaDateKey(date);
}

export default function MasterDashboard({ ownerName }: { ownerName: string }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [masterPasscode, setMasterPasscode] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [deletedVendors, setDeletedVendors] = useState<DeletedVendor[]>([]);
  const [resetRequests, setResetRequests] = useState<ResetRequest[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [resetRequest, setResetRequest] = useState<ResetRequest | null>(null);
  const [newPin, setNewPin] = useState("");
  const [accessVendor, setAccessVendor] = useState<Vendor | null>(null);
  const [accessUserLimit, setAccessUserLimit] = useState("1");
  const [accessUserRate, setAccessUserRate] = useState("99");
  const [message, setMessage] = useState("Loading vendors…");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<MasterView>("vendors");
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [followUpsLoading, setFollowUpsLoading] = useState(false);
  const [buyerLeads, setBuyerLeads] = useState<BuyerLead[]>([]);
  const [buyerLeadsLoading, setBuyerLeadsLoading] = useState(false);
  const [editingBuyerLead, setEditingBuyerLead] = useState<BuyerLead | null>(null);
  const [leadNextFollowUpAt, setLeadNextFollowUpAt] = useState("");
  const [leadMasterNote, setLeadMasterNote] = useState("");
  const [trackingOrders, setTrackingOrders] = useState<MasterTrackingOrder[]>([]);
  const [refreshingView, setRefreshingView] = useState<"tracking" | "parcels" | "claims" | "customers" | null>(null);
  const [refreshMessage, setRefreshMessage] = useState("");
  const [reportRequests, setReportRequests] = useState<ReportRequest[]>([]);
  const [editingReport, setEditingReport] = useState<ReportRequest | null>(null);
  const [reportStatus, setReportStatus] = useState("preparing");
  const [reportMasterNote, setReportMasterNote] = useState("");
  const [reportUrl, setReportUrl] = useState("");
  const [editingClaim, setEditingClaim] = useState<Claim | null>(null);
  const [claimSavedAmount, setClaimSavedAmount] = useState("");
  const [claimStatus, setClaimStatus] = useState("resolved");
  const [masterStats, setMasterStats] = useState<MasterStats>({ totalVendors: 0, activeVendors: 0, totalParcels: 0, totalReturns: 0, totalClaims: 0, savedAmount: 0, verifiedCustomers: 0 });
  const [vendorSearch, setVendorSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [activityParcels, setActivityParcels] = useState<ActivityRecord[]>([]);
  const [activityReturns, setActivityReturns] = useState<ActivityRecord[]>([]);

  const normalizedVendorSearch = vendorSearch.trim().toUpperCase();
  const hasActiveFilter = Boolean(normalizedVendorSearch || dateFrom || dateTo || timeFrom || timeTo);
  const todayKey = offsetIndiaDate(0);
  const yesterdayKey = offsetIndiaDate(-1);
  const matchesVendor = (vendorCode: string) => !normalizedVendorSearch || vendorCode.toUpperCase().includes(normalizedVendorSearch);
  const matchesDate = (value: string) => {
    const key = indiaDateKey(value);
    const timeKey = indiaTimeKey(value);
    return Boolean(key)
      && (!dateFrom || key >= dateFrom)
      && (!dateTo || key <= dateTo)
      && (!timeFrom || timeKey >= timeFrom)
      && (!timeTo || timeKey <= timeTo);
  };
  const matchesFilter = (vendorCode: string, value: string) => matchesVendor(vendorCode) && matchesDate(value);

  const filteredVendors = useMemo(() => vendors.filter((item) => matchesFilter(item.vendorCode, item.createdAt)), [vendors, normalizedVendorSearch, dateFrom, dateTo]);
  const filteredDeletedVendors = useMemo(() => deletedVendors.filter((item) => matchesFilter(item.vendorCode, item.deletedAt)), [deletedVendors, normalizedVendorSearch, dateFrom, dateTo]);
  const filteredTrackingOrders = useMemo(() => trackingOrders.filter((item) => matchesFilter(item.vendorCode, item.packedAt || item.orderDate)), [trackingOrders, normalizedVendorSearch, dateFrom, dateTo]);
  const filteredParcels = useMemo(() => parcels.filter((item) => matchesFilter(item.vendorCode, item.createdAt)), [parcels, normalizedVendorSearch, dateFrom, dateTo]);
  const filteredClaims = useMemo(() => claims.filter((item) => matchesFilter(item.vendorCode, item.createdAt)), [claims, normalizedVendorSearch, dateFrom, dateTo]);
  const filteredFollowUps = useMemo(() => followUps.filter((item) => matchesFilter(item.vendorCode, item.createdAt)), [followUps, normalizedVendorSearch, dateFrom, dateTo]);
  const filteredReports = useMemo(() => reportRequests.filter((item) => matchesFilter(item.vendorCode, item.createdAt)), [reportRequests, normalizedVendorSearch, dateFrom, dateTo]);
  const filteredBuyerLeads = useMemo(() => buyerLeads.filter((item) => {
    const searchText = `${item.leadCode} ${item.contactName} ${item.businessName} ${item.mobile} ${item.whatsapp} ${item.planName}`.toUpperCase();
    return (!normalizedVendorSearch || searchText.includes(normalizedVendorSearch)) && matchesDate(item.createdAt);
  }), [buyerLeads, normalizedVendorSearch, dateFrom, dateTo, timeFrom, timeTo]);
  const buyerLeadSummary = useMemo(() => ({
    newLeads: filteredBuyerLeads.filter((item) => item.followUpStatus === "new").length,
    connected: filteredBuyerLeads.filter((item) => item.followUpStatus === "connect").length,
    followUpDue: filteredBuyerLeads.filter((item) => item.nextFollowUpAt && new Date(item.nextFollowUpAt).getTime() <= Date.now() && item.customerDecision === "pending").length,
  }), [filteredBuyerLeads]);

  const activitySummary = useMemo(() => {
    const vendorParcels = activityParcels.filter((item) => matchesVendor(item.vendorCode));
    const vendorReturns = activityReturns.filter((item) => matchesVendor(item.vendorCode));
    const onDate = (items: ActivityRecord[], key: string) => items.filter((item) => indiaDateKey(item.createdAt) === key).length;
    const inRange = (items: ActivityRecord[]) => items.filter((item) => matchesDate(item.createdAt)).length;
    return {
      todayParcels: onDate(vendorParcels, todayKey),
      todayReturns: onDate(vendorReturns, todayKey),
      yesterdayParcels: onDate(vendorParcels, yesterdayKey),
      yesterdayReturns: onDate(vendorReturns, yesterdayKey),
      rangeParcels: inRange(vendorParcels),
      rangeReturns: inRange(vendorReturns),
    };
  }, [activityParcels, activityReturns, normalizedVendorSearch, dateFrom, dateTo, todayKey, yesterdayKey]);

  async function loadActivitySummary() {
    const response = await fetch("/api/master-activity", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { parcels?: ActivityRecord[]; returns?: ActivityRecord[] };
    setActivityParcels(data.parcels || []);
    setActivityReturns(data.returns || []);
  }

  async function loadMasterStats() {
    const response = await fetch("/api/master-stats", { cache: "no-store" });
    if (!response.ok) return;
    setMasterStats(await response.json() as MasterStats);
  }

  async function loadVendors() {
    const response = await fetch("/api/vendors", { cache: "no-store" });
    const data = await response.json() as { vendors?: Vendor[]; deletedVendors?: DeletedVendor[]; resetRequests?: ResetRequest[]; error?: string };
    if (!response.ok) return setMessage(data.error || "Vendor list load nahi hui");
    setVendors(data.vendors || []);
    setDeletedVendors(data.deletedVendors || []);
    setResetRequests(data.resetRequests || []);
    setMessage("");
    await Promise.all([loadMasterStats(), loadActivitySummary()]);
  }

  useEffect(() => {
    void fetch("/api/master-login", { cache: "no-store" }).then((response) => {
      setAuthenticated(response.ok);
      if (response.ok) void loadVendors();
    });
  }, []);

  async function masterLogin(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setLoginMessage("");
    const response = await fetch("/api/master-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: masterPasscode }),
    });
    const data = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) return setLoginMessage(data.error || "Login nahi hua");
    setMasterPasscode("");
    setAuthenticated(true);
    await loadVendors();
  }

  async function masterLogout() {
    await fetch("/api/master-login", { method: "DELETE" });
    setAuthenticated(false);
    setVendors([]);
    setParcels([]);
    setActivityParcels([]);
    setActivityReturns([]);
    setBuyerLeads([]);
  }

  async function openView(nextView: MasterView) {
    if ((view === "buyerLeads") !== (nextView === "buyerLeads")) setVendorSearch("");
    setView(nextView);
    setRefreshMessage("");
    if (nextView !== "buyerLeads") {
      setTimeFrom("");
      setTimeTo("");
    }
    if (nextView === "parcels" || nextView === "customers") {
      const response = await fetch("/api/parcels", { cache: "no-store", headers: { "x-mpd-panel": "master" } });
      const data = await response.json() as { parcels?: Parcel[]; error?: string };
      if (!response.ok) return setMessage(data.error || "Records load nahi hue");
      setParcels(data.parcels || []);
      setMessage("");
    }
    if (nextView === "claims") {
      const response = await fetch("/api/claims", { cache: "no-store", headers: { "x-mpd-panel": "master" } });
      const data = await response.json() as { claims?: Claim[]; error?: string };
      if (!response.ok) return setMessage(data.error || "Claims load nahi hue");
      setClaims(data.claims || []);
      setMessage("");
    }
    if (nextView === "tracking") {
      const response = await fetch("/api/master-orders", { cache: "no-store" });
      const data = await response.json() as { orders?: MasterTrackingOrder[]; error?: string };
      if (!response.ok) return setMessage(data.error || "Master Tracking load nahi hui");
      setTrackingOrders(data.orders || []);
      setMessage("");
    }
    if (nextView === "followUps") void loadFollowUps(false);
    if (nextView === "buyerLeads") await loadBuyerLeads(false);
    if (nextView === "reports") await loadReportRequests(false);
    if (nextView === "vendors") await loadVendors();
  }

  async function loadBuyerLeads(showConfirmation = false) {
    if (buyerLeadsLoading) return;
    setBuyerLeadsLoading(true);
    if (showConfirmation) setMessage("New Buyer Leads refresh ho rahi hain…");
    try {
      const response = await fetch(`/api/buyer-leads?refresh=${Date.now()}`, { cache: "no-store" });
      const data = await response.json() as { leads?: BuyerLead[]; error?: string };
      if (!response.ok) return setMessage(data.error || "New Buyer Leads load nahi hui");
      setBuyerLeads(data.leads || []);
      setMessage(showConfirmation ? `✓ New Buyer Leads refresh ho gayi · ${new Date().toLocaleTimeString("en-IN")}` : "");
    } catch {
      setMessage("New Buyer Leads load nahi hui. Internet check karke Refresh dabaiye.");
    } finally {
      setBuyerLeadsLoading(false);
    }
  }

  async function updateBuyerLead(item: BuyerLead, updates: Partial<Pick<BuyerLead, "followUpStatus" | "customerDecision" | "nextFollowUpAt" | "masterNote">>) {
    const payload = {
      id: item.id,
      followUpStatus: updates.followUpStatus ?? item.followUpStatus,
      customerDecision: updates.customerDecision ?? item.customerDecision,
      nextFollowUpAt: updates.nextFollowUpAt ?? item.nextFollowUpAt,
      masterNote: updates.masterNote ?? item.masterNote,
    };
    const response = await fetch("/api/buyer-leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) return setMessage(data.error || "Buyer follow-up update nahi hua");
    setBuyerLeads((current) => current.map((lead) => lead.id === item.id ? {
      ...lead,
      ...payload,
      lastContactedAt: payload.followUpStatus === "connect" ? new Date().toISOString() : lead.lastContactedAt,
      updatedAt: new Date().toISOString(),
    } : lead));
    setMessage(`✓ ${item.contactName} ka buyer follow-up update ho gaya`);
  }

  function openBuyerLeadFollowUp(item: BuyerLead) {
    setEditingBuyerLead(item);
    setLeadNextFollowUpAt(item.nextFollowUpAt ? item.nextFollowUpAt.slice(0, 16) : "");
    setLeadMasterNote(item.masterNote);
  }

  async function saveBuyerLeadFollowUp(event: FormEvent) {
    event.preventDefault();
    if (!editingBuyerLead) return;
    setBusy(true);
    await updateBuyerLead(editingBuyerLead, {
      nextFollowUpAt: leadNextFollowUpAt ? new Date(leadNextFollowUpAt).toISOString() : "",
      masterNote: leadMasterNote,
    });
    setBusy(false);
    setEditingBuyerLead(null);
  }

  async function loadReportRequests(showConfirmation = false) {
    if (showConfirmation) setMessage("Report requests refresh ho rahi hain…");
    const response = await fetch(`/api/report-requests?refresh=${Date.now()}`, { cache: "no-store", headers: { "x-mpd-panel": "master" } });
    const data = await response.json() as { requests?: ReportRequest[]; error?: string };
    if (!response.ok) return setMessage(data.error || "Report requests load nahi hui");
    setReportRequests(data.requests || []);
    setMessage(showConfirmation ? `✓ Report requests refresh ho gayi · ${new Date().toLocaleTimeString("en-IN")}` : "");
  }

  async function loadFollowUps(showConfirmation = false) {
    if (followUpsLoading) return;
    setFollowUpsLoading(true);
    setMessage("Follow Ups load ho rahe hain…");
    try {
      const response = await fetch(`/api/follow-ups?refresh=${Date.now()}`, {
        cache: "no-store",
        headers: { "x-mpd-panel": "master" },
      });
      const data = await response.json() as { followUps?: FollowUp[]; error?: string };
      if (!response.ok) {
        setMessage(data.error || "Follow Ups load nahi hue");
        return;
      }
      setFollowUps(data.followUps || []);
      setMessage(showConfirmation ? `✓ Follow Ups refresh ho gaye · ${new Date().toLocaleTimeString("en-IN")}` : "");
    } catch {
      setMessage("Follow Ups load nahi hue. Internet check karke Refresh dabaiye.");
    } finally {
      setFollowUpsLoading(false);
    }
  }

  async function updateFollowUpStatus(item: FollowUp, status: FollowUp["status"]) {
    const response = await fetch("/api/follow-ups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-mpd-panel": "master" },
      body: JSON.stringify({ id: item.id, status }),
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) return setMessage(data.error || "Follow Up status update nahi hua");
    setMessage("✓ Follow Up status update ho gaya");
    await loadFollowUps(false);
  }

  async function updateReportRequest() {
    if (!editingReport) return;
    const response = await fetch("/api/report-requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingReport.id, status: reportStatus, masterNote: reportMasterNote, reportUrl }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) return setMessage(data.error || "Report request update nahi hui");
    setEditingReport(null);
    await loadReportRequests(false);
    setMessage("✓ Report request update ho gayi");
  }

  async function updateClaimSettlement() {
    if (!editingClaim) return;
    const response = await fetch("/api/claims", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingClaim.id, savedAmount: Number(claimSavedAmount || 0), status: claimStatus }),
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) return setMessage(data.error || "Claim settlement save nahi hua");
    setEditingClaim(null);
    setMessage("✓ Claim settlement aur saved amount update ho gaya");
    await refreshData("claims");
  }

  async function refreshData(target: "tracking" | "parcels" | "claims" | "customers") {
    if (refreshingView) return;
    setRefreshingView(target);
    setRefreshMessage("Data refresh ho raha hai…");
    try {
      const endpoint = target === "tracking" ? "/api/master-orders" : target === "claims" ? "/api/claims" : "/api/parcels";
      const response = await fetch(`${endpoint}?refresh=${Date.now()}`, {
        cache: "no-store",
        headers: target === "tracking" ? undefined : { "x-mpd-panel": "master" },
      });
      const data = await response.json() as { orders?: MasterTrackingOrder[]; parcels?: Parcel[]; claims?: Claim[]; error?: string };
      if (!response.ok) {
        setRefreshMessage(data.error || "Refresh nahi hua. Dobara try kijiye.");
        return;
      }
      if (target === "tracking") setTrackingOrders(data.orders || []);
      else if (target === "claims") setClaims(data.claims || []);
      else setParcels(data.parcels || []);
      await loadActivitySummary();
      setRefreshMessage(`✓ Data refresh ho gaya · ${new Date().toLocaleTimeString("en-IN")}`);
    } catch {
      setRefreshMessage("Internet problem ki wajah se refresh nahi hua.");
    } finally {
      setRefreshingView(null);
    }
  }

  function downloadCurrentFilteredData() {
    if (!hasActiveFilter) return;
    if (view === "buyerLeads") {
      downloadExcelWorkbook("filtered-new-buyer-leads", [
        ["Created At", "Lead ID", "Purchase Stage", "Interested Plan", "Retention Days", "Full Name", "Business", "Mobile", "WhatsApp", "Email", "City", "State", "Marketplace", "Orders / Month", "Best Call Time", "Buyer Note", "Connect Status", "Customer Decision", "Next Follow-up", "Last Contacted", "Master Note"],
        ...filteredBuyerLeads.map((item) => [item.createdAt, item.leadCode, item.purchaseStage, item.planName, item.retentionDays, item.contactName, item.businessName, item.mobile, item.whatsapp, item.email, item.city, item.state, item.marketplace, item.monthlyOrders, item.preferredContactTime, item.note, item.followUpStatus, item.customerDecision, item.nextFollowUpAt, item.lastContactedAt, item.masterNote]),
      ]);
      return;
    }
    if (view === "vendors") {
      downloadExcelWorkbook("filtered-vendors", [
        ["Created At", "Business Name", "Owner Name", "Mobile", "Vendor Code", "Parcel Count", "Status"],
        ...filteredVendors.map((item) => [item.createdAt, item.businessName, item.contactName, item.mobile, item.vendorCode, item.parcelCount, item.status]),
      ]);
      return;
    }
    if (view === "tracking") {
      downloadExcelWorkbook("filtered-master-tracking", [
        ["Order Date", "Packed At", "Vendor Name", "Vendor Code", "Marketplace", "Order ID", "Tracking ID", "Delivery Partner", "Bag ID", "Customer Name", "Customer Address", "Customer PIN", "Packing Status"],
        ...filteredTrackingOrders.map((item) => [item.orderDate, item.packedAt, item.vendorName, item.vendorCode, item.marketplace, item.orderId, item.trackingId, item.deliveryPartner, item.bagId, item.customerName, item.customerAddress, item.customerPincode, item.packingStatus]),
      ]);
      return;
    }
    if (view === "parcels") {
      downloadExcelWorkbook("filtered-parcel-records", [
        ["Created At", "Vendor Name", "Vendor Code", "Tracking ID", "Bag ID", "Upload Status", "Video Link"],
        ...filteredParcels.map((item) => [item.createdAt, item.vendorName, item.vendorCode, item.trackingId, item.bagId, item.uploadStatus, item.videoUrl]),
      ]);
      return;
    }
    if (view === "claims") {
      downloadExcelWorkbook("filtered-return-claims", [
        ["Claim Date & Time", "Tracking ID", "Vendor Name", "Vendor Code", "Portal", "Return Type", "Issue", "Note", "Saved Amount", "Video Link", "Upload Status", "Claim Status"],
        ...filteredClaims.map((item) => [item.createdAt, item.trackingId, item.vendorName, item.vendorCode, item.portal, item.returnType, item.issueType, item.note, item.savedAmount, item.videoUrl, item.uploadStatus, item.status]),
      ]);
      return;
    }
    if (view === "followUps") {
      downloadExcelWorkbook("filtered-follow-ups", [
        ["Created At", "Updated At", "Vendor Name", "Vendor Code", "Tracking ID", "Person", "Contact Number", "Reason", "Status", "Sheet Synced"],
        ...filteredFollowUps.map((item) => [item.createdAt, item.updatedAt, item.vendorName, item.vendorCode, item.trackingId, item.personName, item.contactNumber, item.reason, item.status, item.sheetSynced ? "Yes" : "No"]),
      ]);
      return;
    }
    if (view === "reports") {
      downloadExcelWorkbook("filtered-report-requests", [
        ["Requested At", "Vendor Name", "Vendor Code", "Report Type", "From Date", "To Date", "Vendor Note", "Status", "Master Reply", "Report Download Link"],
        ...filteredReports.map((item) => [item.createdAt, item.vendorName, item.vendorCode, item.reportType, item.dateFrom, item.dateTo, item.note, item.status, item.masterNote, item.reportUrl]),
      ]);
    }
  }

  const activeCount = useMemo(() => vendors.filter((vendor) => vendor.status === "active").length, [vendors]);
  const parcelCount = masterStats.totalParcels;

  async function addVendor(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json() as { error?: string; warning?: string; drivePending?: boolean; approvalRequired?: boolean };
    setBusy(false);
    if (data.approvalRequired) {
      setForm(emptyForm);
      setShowForm(false);
      setMessage("⚠ Ye number Deleted Vendors mein mila. Approval Pending ban gaya—neeche Approve & Restore dabane ke baad hi vendor kaam karega.");
      await loadVendors();
      return;
    }
    if (!response.ok) return setMessage(data.error || "Vendor add nahi hua");
    setForm(emptyForm);
    setShowForm(false);
    setMessage(data.drivePending
      ? `✓ Vendor account ban gaya. ${data.warning || "Google Drive folder connection pending hai."}`
      : "✓ Vendor successfully add ho gaya");
    await loadVendors();
  }

  async function toggleVendor(vendor: Vendor) {
    setMessage("");
    const nextStatus = vendor.status === "active" ? "blocked" : "active";
    const response = await fetch("/api/vendors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: vendor.id, status: nextStatus }),
    });
    if (!response.ok) return setMessage("Vendor status update nahi hua");
    await loadVendors();
  }

  async function saveAccessPolicy(event: FormEvent) {
    event.preventDefault();
    if (!accessVendor) return;
    const userLimit = Math.max(1, Math.min(100, Number(accessUserLimit || 1)));
    const extraUserRate = Math.max(0, Number(accessUserRate || 0));
    setBusy(true);
    const response = await fetch("/api/vendors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: accessVendor.id, action: "access_policy", userLimit, extraUserRate }),
    });
    const data = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) return setMessage(data.error || "User limit save nahi hui");
    setAccessVendor(null);
    setMessage(`✓ ${accessVendor.businessName}: ${userLimit} users aur ₹${extraUserRate}/extra user rate save ho gaya`);
    await loadVendors();
  }

  async function resetVendorIp(vendor: Vendor) {
    const confirmed = window.confirm(`${vendor.businessName} ka IP/device history reset karna hai?\n\nSaare current logins band honge. Agle login se 5 IP-change allowance dobara shuru hoga.`);
    if (!confirmed) return;
    const response = await fetch("/api/vendors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: vendor.id, action: "reset_ip_policy" }),
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) return setMessage(data.error || "IP Reset nahi hua");
    setMessage(`✓ ${vendor.businessName} ka IP/device history reset ho gaya; user ko dobara login karna hoga`);
    await loadVendors();
  }

  async function deleteVendor(vendor: Vendor) {
    const confirmed = window.confirm(`${vendor.businessName} ko delete karna hai?\n\nLogin turant band hoga aur vendor Deleted Vendors archive mein save rahega.`);
    if (!confirmed) return;
    setMessage("");
    const response = await fetch("/api/vendors", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: vendor.id }),
    });
    const data = await response.json() as { error?: string; sheetSynced?: boolean };
    if (!response.ok) return setMessage(data.error || "Vendor delete nahi hua");
    setMessage(data.sheetSynced
      ? "✓ Vendor delete ho gaya aur Deleted Vendors sheet mein save ho gaya"
      : "✓ Vendor delete ho gaya aur Deleted Vendors archive mein safe hai; Google Sheet sync pending hai");
    await loadVendors();
  }

  async function reviewReactivation(item: DeletedVendor, approve: boolean) {
    const response = await fetch("/api/vendors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: item.id,
        action: approve ? "approve_reactivation" : "reject_reactivation",
      }),
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) return setMessage(data.error || "Approval update nahi hua");
    setMessage(approve
      ? "✓ Master Approval ho gaya—vendor restore aur active ho gaya"
      : "✓ Reactivation request reject ho gayi; vendor deleted hi rahega");
    await loadVendors();
  }

  function downloadDeletedVendorsSheet() {
    downloadExcelWorkbook("filtered-deleted-vendors", [
      ["Vendor ID", "Business Name", "Owner Name", "Mobile", "Vendor Code", "Parcels", "Original Created", "Deleted At", "Return Approval", "Approval Requested", "Approved At"],
      ...filteredDeletedVendors.map((item) => [
        item.vendorId,
        item.businessName,
        item.contactName,
        item.mobile,
        item.vendorCode,
        item.parcelCount,
        item.originalCreatedAt,
        item.deletedAt,
        item.approvalStatus,
        item.approvalRequestedAt,
        item.approvedAt,
      ]),
    ]);
  }

  async function saveNewPin(event: FormEvent) {
    event.preventDefault();
    if (!resetRequest || !/^\d{4,8}$/.test(newPin)) return setMessage("Naya PIN 4–8 digits ka rakhiye");
    setBusy(true);
    const response = await fetch("/api/vendors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: resetRequest.vendorId, requestId: resetRequest.id, pin: newPin }),
    });
    const data = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) return setMessage(data.error || "PIN reset nahi hua");
    setResetRequest(null);
    setNewPin("");
    setMessage("✓ Vendor ka naya PIN save ho gaya");
    await loadVendors();
  }

  if (authenticated === null) return <main className="admin-login"><div className="login-panel"><div className="lock-art">⌛</div><h1>Security Check</h1><p>Master Panel secure session check ho raha hai…</p></div></main>;

  if (!authenticated) return (
    <main className="admin-login">
      <form className="login-panel" onSubmit={masterLogin}>
        <Link className="brand" href="/"><BrandLogo /><div><strong>My Parcel Delivery</strong><small>MASTER CONTROL</small></div></Link>
        <div className="lock-art">🔐</div>
        <span className="form-kicker">SIRF OWNER KE LIYE</span>
        <h1>Master Admin Login</h1>
        <p>Vendor data aur controls open karne ke liye apna secure Master Passcode enter karo.</p>
        <label>Master Passcode<input autoFocus required type="password" inputMode="numeric" value={masterPasscode} onChange={(e) => setMasterPasscode(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="6–8 digit passcode" /></label>
        <button className="primary" disabled={busy}>{busy ? "Verify ho raha hai…" : "Secure Login Karo"} <span>→</span></button>
        {loginMessage && <div className="form-message">{loginMessage}</div>}
        <Link className="customer-link" href="/customer">← Customer Website par jao</Link>
      </form>
    </main>
  );

  return (
    <main className="admin-shell master-shell">
      <aside className="admin-nav">
        <a className="brand" href="/master"><BrandLogo /><div><strong>My Parcel Delivery</strong><small>MASTER CONTROL</small></div></a>
        <nav>
          <button className={view === "vendors" ? "active" : ""} onClick={() => void openView("vendors")}>▦ Vendor Management</button>
          <button className={view === "buyerLeads" ? "active" : ""} onClick={() => void openView("buyerLeads")}>✦ New Buyer Leads{buyerLeads.filter((item) => item.followUpStatus === "new").length > 0 ? ` (${buyerLeads.filter((item) => item.followUpStatus === "new").length})` : ""}</button>
          <button className={view === "payments" ? "active" : ""} onClick={() => void openView("payments")}>₹ Payment Ledger</button>
          <button className={view === "coupons" ? "active" : ""} onClick={() => void openView("coupons")}>％ Coupons</button>
          <button className={view === "tracking" ? "active" : ""} onClick={() => void openView("tracking")}>⌖ Master Tracking</button>
          <button className={view === "parcels" ? "active" : ""} onClick={() => void openView("parcels")}>▤ Saare Parcel Records</button>
          <button className={view === "claims" ? "active" : ""} onClick={() => void openView("claims")}>✋ Meesho Return Claims</button>
          <button type="button" className={view === "followUps" ? "active" : ""} onClick={() => void openView("followUps")}>☎ Follow Ups</button>
          <button className={view === "customers" ? "active" : ""} onClick={() => void openView("customers")}>♙ Saare Customer Details</button>
          <button className={view === "reports" ? "active" : ""} onClick={() => void openView("reports")}>▧ Report Requests</button>
          <button className={view === "settings" ? "active" : ""} onClick={() => void openView("settings")}>⚙ Master Settings</button>
        </nav>
        <div className="admin-user"><span>MA</span><div><b>{ownerName}</b><small>Master administrator</small></div><button className="logout-mini" onClick={() => void masterLogout()}>Logout</button></div>
      </aside>

      <section className="admin-content master-content">
        <header>
          <div><span className="form-kicker">SIRF OWNER KE LIYE</span><h1>{view === "vendors" ? "Master Admin Panel" : view === "buyerLeads" ? "New Buyer Leads" : view === "payments" ? "Payment Ledger" : view === "coupons" ? "Coupon Management" : view === "tracking" ? "Master Tracking" : view === "parcels" ? "Saare Parcel Records" : view === "claims" ? "Meesho Return Claims Sheet" : view === "followUps" ? "Vendor Follow Ups" : view === "customers" ? "Saare Customer Details" : view === "reports" ? "Vendor Report Requests" : "Master Settings"}</h1></div>
          {view === "vendors" && <button className="add-vendor-button" onClick={() => setShowForm(true)}>＋ Naya Vendor Add Karo</button>}
        </header>

        {view !== "settings" && <section className="master-filter-panel" aria-label="Master search and date filter">
          <div className="master-filter-fields">
            <label className="master-vendor-search">{view === "buyerLeads" ? "Lead / Name / Mobile / Plan Search" : "Vendor Code Search"}
              <input value={vendorSearch} onChange={(event) => setVendorSearch(view === "buyerLeads" ? event.target.value : event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))} placeholder={view === "buyerLeads" ? "Name, mobile, business, plan…" : "Example: KHODAL001"} />
            </label>
            <label>From Date<input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} /></label>
            <label>To Date<input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} /></label>
            {view === "buyerLeads" && <><label>From Time<input type="time" value={timeFrom} max={timeTo || undefined} onChange={(event) => setTimeFrom(event.target.value)} /></label><label>To Time<input type="time" value={timeTo} min={timeFrom || undefined} onChange={(event) => setTimeTo(event.target.value)} /></label></>}
            <div className="master-filter-actions">
              <button type="button" onClick={() => { setDateFrom(todayKey); setDateTo(todayKey); }}>Today</button>
              <button type="button" onClick={() => { setDateFrom(yesterdayKey); setDateTo(yesterdayKey); }}>Yesterday</button>
              <button type="button" className="clear" onClick={() => { setVendorSearch(""); setDateFrom(""); setDateTo(""); setTimeFrom(""); setTimeTo(""); }}>Clear</button>
              {!["payments", "coupons", "customers"].includes(view) && <button type="button" className="download-excel" disabled={!hasActiveFilter} title={hasActiveFilter ? "Filtered data Excel mein download karein" : "Download ke liye pehle Vendor Code ya date filter lagaiye"} onClick={downloadCurrentFilteredData}>↓ Download Excel</button>}
            </div>
          </div>
          {view === "buyerLeads" ? <div className="master-filter-summary buyer-summary">
            <article><span>New Leads</span><strong>{buyerLeadSummary.newLeads}</strong><small>Follow-up pending</small><b>{filteredBuyerLeads.length} total shown</b></article>
            <article><span>Connected</span><strong>{buyerLeadSummary.connected}</strong><small>Connect किया गया</small><b>{filteredBuyerLeads.filter((item) => item.customerDecision === "yes").length} said Yes</b></article>
            <article><span>Follow-up Due</span><strong>{buyerLeadSummary.followUpDue}</strong><small>Scheduled time reached</small><b>{filteredBuyerLeads.filter((item) => item.customerDecision === "no").length} said No</b></article>
          </div> : <div className="master-filter-summary">
            <article><span>Today</span><strong>{activitySummary.todayParcels}</strong><small>New Parcel Videos</small><b>{activitySummary.todayReturns} Returns</b></article>
            <article><span>Yesterday</span><strong>{activitySummary.yesterdayParcels}</strong><small>New Parcel Videos</small><b>{activitySummary.yesterdayReturns} Returns</b></article>
            <article><span>{dateFrom || dateTo ? "Selected Range" : "All Time"}</span><strong>{activitySummary.rangeParcels}</strong><small>New Parcel Videos</small><b>{activitySummary.rangeReturns} Returns</b></article>
          </div>}
          <p className="master-filter-caption">{view === "buyerLeads" ? (normalizedVendorSearch ? `Showing buyer leads matching “${vendorSearch.trim()}”` : "Showing all buyer leads") : (normalizedVendorSearch ? `Showing only Vendor Code containing “${normalizedVendorSearch}”` : "Showing all vendors")} · Date/time range is inclusive · India time</p>
        </section>}

        {view === "vendors" && <>
        <div className="master-stats">
          <article><span>Total Vendors</span><strong>{masterStats.totalVendors}</strong><small>Saare vendor accounts</small></article>
          <article><span>Active Vendors</span><strong>{masterStats.activeVendors || activeCount}</strong><small>Recording ki permission hai</small></article>
          <article><span>Till-Date Packed Parcels</span><strong>{masterStats.totalParcels}</strong><small>Sab vendors ka total</small></article>
          <article><span>Total Returns / RTO</span><strong>{masterStats.totalReturns}</strong><small>Sab vendors ka total</small></article>
          <article><span>Total Claims</span><strong>{masterStats.totalClaims}</strong><small>₹{masterStats.savedAmount.toLocaleString("en-IN")} total savings</small></article>
          <article><span>Verified Customers</span><strong>{masterStats.verifiedCustomers}</strong><small>Sab vendors ka total</small></article>
        </div>

        {message && <div className={message.startsWith("✓") ? "master-message success" : "master-message"}>{message}</div>}
        {resetRequests.length > 0 && <section className="otp-requests"><h2>Forgot PIN Requests</h2><p>Vendor ko verify karke uske liye naya PIN set karo.</p>{resetRequests.map((request) => { const vendor = vendors.find((item) => item.id === request.vendorId); return <article key={request.id}><span><b>{vendor?.businessName || "Vendor"}</b><small>{vendor?.vendorCode}</small></span><button className="vendor-action reset" onClick={() => { setResetRequest(request); setNewPin(""); }}>PIN Reset Karo</button></article>; })}</section>}

        <section className="vendor-table-card">
          <div className="vendor-table-head"><div><h2>Vendor Accounts &amp; User Access</h2><p>Vendor-wise user limit, per-user rate aur IP security yahin control karein.</p></div><span>{filteredVendors.length} vendors</span></div>
          <div className="vendor-table">
            <div className="vendor-row vendor-labels"><span>Vendor / Owner</span><span>Vendor Code</span><span>Users / Rate</span><span>IP Security</span><span>Status</span><span>Action</span></div>
            {filteredVendors.length === 0 && !message && <div className="empty-vendors"><b>Filter mein koi vendor nahi mila</b><small>Vendor Code ya date range change kijiye.</small></div>}
            {filteredVendors.map((vendor) => (
              <div className="vendor-row" key={vendor.id}>
                <span className="vendor-name"><i>{vendor.businessName.slice(0, 2).toUpperCase()}</i><div><b>{vendor.businessName}</b><small>Owner: {vendor.contactName}</small></div></span>
                <code>{vendor.vendorCode}</code>
                <span><b>{vendor.activeUsers} / {vendor.userLimit} users</b><small>Extra: ₹{(vendor.extraUserRatePaise / 100).toLocaleString("en-IN")}/user/month</small></span>
                <span><b>{vendor.maxIpChanges} / 5 changes</b><small>{vendor.lastMaskedIp || "First login pending"}</small></span>
                <span className={`vendor-status ${vendor.ipPolicyBlocked ? "blocked" : vendor.status}`}>● {vendor.ipPolicyBlocked ? "IP Blocked" : vendor.status}</span>
                <span className="vendor-actions">
                  <button className="vendor-action" onClick={() => { setAccessVendor(vendor); setAccessUserLimit(String(vendor.userLimit)); setAccessUserRate(String(vendor.extraUserRatePaise / 100)); }}>Users &amp; Rate</button>
                  <button className="vendor-action reset" onClick={() => void resetVendorIp(vendor)}>IP Reset</button>
                  <button className="vendor-action" onClick={() => void toggleVendor(vendor)}>{vendor.status === "active" ? "Block" : "Activate"}</button>
                  <button className="vendor-action delete" onClick={() => void deleteVendor(vendor)}>Delete</button>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="vendor-table-card deleted-vendor-card">
          <div className="vendor-table-head">
            <div><h2>Deleted Vendors</h2><p>Deleted number dobara aaye to Master Approval ke bina account active nahi hoga.</p></div>
            <div className="deleted-head-actions"><span>{filteredDeletedVendors.length} archived</span><button className="vendor-action" disabled={!hasActiveFilter} title={hasActiveFilter ? "Filtered deleted vendors download karein" : "Download ke liye pehle Vendor Code ya date filter lagaiye"} onClick={() => { if (hasActiveFilter) downloadDeletedVendorsSheet(); }}>↓ Download Excel</button></div>
          </div>
          <div className="vendor-table">
            <div className="deleted-vendor-row vendor-labels"><span>Vendor / Owner</span><span>Vendor Code</span><span>Mobile</span><span>Deleted</span><span>Approval</span><span>Action</span></div>
            {filteredDeletedVendors.length === 0 ? <div className="empty-vendors"><b>Filter mein deleted vendor nahi mila</b><small>Vendor Code ya date range change kijiye.</small></div> : filteredDeletedVendors.map((item) => (
              <div className="deleted-vendor-row" key={item.id}>
                <span className="vendor-name"><i>{item.businessName.slice(0, 2).toUpperCase()}</i><div><b>{item.businessName}</b><small>Owner: {item.contactName}</small></div></span>
                <code>{item.vendorCode}</code>
                <b>{item.mobile}</b>
                <span><b>{new Date(item.deletedAt).toLocaleDateString("en-IN")}</b><small>{item.sheetSynced ? "✓ Sheet synced" : "Archive saved"}</small></span>
                <span className={`approval-state ${item.approvalStatus}`}>{item.approvalStatus === "pending" ? "● Approval Pending" : item.approvalStatus === "approved" ? "✓ Restored Earlier" : item.approvalStatus === "rejected" ? "× Rejected" : "Deleted"}</span>
                <span className="vendor-actions">
                  {item.approvalStatus === "pending" ? <>
                    <button className="vendor-action approve" onClick={() => void reviewReactivation(item, true)}>Approve &amp; Restore</button>
                    <button className="vendor-action delete" onClick={() => void reviewReactivation(item, false)}>Reject</button>
                  </> : <small>Return par approval required</small>}
                </span>
              </div>
            ))}
          </div>
        </section>
        </>}
        {view === "buyerLeads" && <section className="data-card buyer-leads-card">
          <div className="data-head">
            <div><h2>New Buyer Leads</h2><p>Buy Now form se aaye buyers. Interested plan सबसे main lead field है; payment Razorpay link से manually लिया जाएगा.</p></div>
            <button type="button" className="vendor-action" disabled={buyerLeadsLoading} onClick={() => void loadBuyerLeads(true)}>{buyerLeadsLoading ? "↻ Refreshing…" : "↻ Refresh"}</button>
          </div>
          {message && <div className={message.startsWith("✓") ? "master-message success" : "master-message"}>{message}</div>}
          <div className="records-table">
            <div className="buyer-lead-row labels"><span>Date &amp; Time</span><span>Buyer / Business</span><span>Interested Plan</span><span>Contact</span><span>Business Need</span><span>Follow-up</span><span>Decision / Action</span></div>
            {!buyerLeadsLoading && filteredBuyerLeads.length === 0 ? <div className="empty-vendors"><b>Filter में New Buyer Lead नहीं मिली</b><small>Buy Now form submit होते ही यहाँ automatic date/time के साथ दिखाई देगी.</small></div> : filteredBuyerLeads.map((item) => (
              <div className="buyer-lead-row" key={item.id}>
                <span><b>{new Date(item.createdAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</b><small>{new Date(item.createdAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}</small><code>{item.leadCode}</code></span>
                <span><b>{item.contactName}</b><small>{item.businessName}</small><em>{item.purchaseStage}</em></span>
                <span className="buyer-plan-cell"><strong>{item.planName}</strong><small>{item.retentionDays} days · {item.monthlyOrders.toLocaleString("en-IN")} orders/month</small></span>
                <span><a href={`tel:${item.mobile}`}>{item.mobile}</a><a href={`https://wa.me/91${item.whatsapp}`} target="_blank" rel="noreferrer">WhatsApp: {item.whatsapp}</a><small>{item.email || "Email not provided"}</small></span>
                <span><b>{item.marketplace}</b><small>{item.city}, {item.state}</small><small>Call: {item.preferredContactTime}</small>{item.note && <small title={item.note}>Buyer note: {item.note}</small>}</span>
                <span className="lead-connect-actions">
                  <button type="button" className={item.followUpStatus === "connect" ? "connect active" : "connect"} onClick={() => void updateBuyerLead(item, { followUpStatus: "connect" })}>✓ Connect</button>
                  <button type="button" className={item.followUpStatus === "not_connect" ? "not-connect active" : "not-connect"} onClick={() => void updateBuyerLead(item, { followUpStatus: "not_connect" })}>× Not Connect</button>
                  <small>{item.lastContactedAt ? `Last: ${new Date(item.lastContactedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}` : "Abhi follow-up नहीं हुआ"}</small>
                </span>
                <span className="lead-decision-actions">
                  <select aria-label={`Customer decision for ${item.contactName}`} value={item.customerDecision} onChange={(event) => void updateBuyerLead(item, { customerDecision: event.target.value as BuyerLead["customerDecision"] })}><option value="pending">Response Pending</option><option value="yes">Yes — Work Karega</option><option value="no">No — Not Interested</option></select>
                  <button type="button" className="vendor-action" onClick={() => openBuyerLeadFollowUp(item)}>Next Follow-up / Note</button>
                  <small>{item.nextFollowUpAt ? `Next: ${new Date(item.nextFollowUpAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}` : "Next follow-up not set"}</small>
                </span>
              </div>
            ))}
          </div>
        </section>}
        {view === "payments" && <PaymentLedger vendorSearch={vendorSearch} dateFrom={dateFrom} dateTo={dateTo} />}
        {view === "coupons" && <CouponManager search={vendorSearch} dateFrom={dateFrom} dateTo={dateTo} />}
        {view === "tracking" && <section className="data-card"><div className="data-head"><div><h2>All Vendor Shipping Labels</h2><p>PDF/Excel integration se aaye customer, Tracking ID, Bag ID, delivery partner, address aur pincode ka combined master record.</p></div><button className="vendor-action" disabled={refreshingView !== null} onClick={() => void refreshData("tracking")}>{refreshingView === "tracking" ? "↻ Refreshing…" : "↻ Refresh"}</button></div>{refreshMessage && <div className={refreshMessage.startsWith("✓") ? "refresh-message success" : "refresh-message"}>{refreshMessage}</div>}<div className="records-table"><div className="master-tracking-row labels"><span>Vendor / Portal</span><span>Tracking / Order</span><span>Partner</span><span>Bag ID</span><span>Customer</span><span>Address</span><span>PIN</span><span>Packing</span></div>{filteredTrackingOrders.length === 0 ? <div className="empty-vendors"><b>Filter mein shipping-label record nahi mila</b><small>Vendor Code ya date range change kijiye.</small></div> : filteredTrackingOrders.map((item) => <div className="master-tracking-row" key={item.id}><span><b>{item.vendorName}</b><small>{item.vendorCode} · {item.marketplace}</small></span><span><b>{item.trackingId}</b><small>{item.orderId || "Order ID pending"}</small></span><b>{item.deliveryPartner || "Pending"}</b><code>{item.bagId || "Packing pending"}</code><b>{item.customerName || "Name pending"}</b><span title={item.customerAddress}>{item.customerAddress || "Address pending"}</span><code>{item.customerPincode}</code><span className={`packing-state ${item.packingStatus}`}>● {item.packingStatus}</span></div>)}</div></section>}
        {view === "parcels" && <section className="data-card"><div className="data-head"><div><h2>Sab Vendors Ke Parcels</h2><p>Har completed packing ka live master record.</p></div><button className="vendor-action" disabled={refreshingView !== null} onClick={() => void refreshData("parcels")}>{refreshingView === "parcels" ? "↻ Refreshing…" : "↻ Refresh"}</button></div>{refreshMessage && <div className={refreshMessage.startsWith("✓") ? "refresh-message success" : "refresh-message"}>{refreshMessage}</div>}<div className="records-table"><div className="master-record-row labels"><span>Vendor</span><span>Tracking ID</span><span>Bag ID</span><span>Date</span><span>Video</span><span>Action</span></div>{filteredParcels.length === 0 ? <div className="empty-vendors"><b>Filter mein parcel record nahi mila</b></div> : filteredParcels.map((item) => <div className="master-record-row" key={item.id}><span><b>{item.vendorName}</b><small>{item.vendorCode}</small></span><b>{item.trackingId}</b><code>{item.bagId}</code><span>{new Date(item.createdAt).toLocaleDateString("en-IN")}</span><span className={`upload-state ${item.uploadStatus}`}>● {item.uploadStatus}</span><span>{item.videoUrl ? <a className="vendor-action link-action" href={item.videoUrl} target="_blank" rel="noreferrer">Video Dekho</a> : <small>Pending</small>}</span></div>)}</div></section>}
        {view === "claims" && <section className="data-card claim-sheet-card"><div className="data-head"><div><h2>Meesho Return Claims</h2><p>Vendor claim, proof aur recovered payment amount yahan update hoga.</p></div><button className="vendor-action" disabled={refreshingView !== null} onClick={() => void refreshData("claims")}>{refreshingView === "claims" ? "↻ Refreshing…" : "↻ Refresh"}</button></div>{refreshMessage && <div className={refreshMessage.startsWith("✓") ? "refresh-message success" : "refresh-message"}>{refreshMessage}</div>}<div className="records-table"><div className="claim-row labels"><span>Date &amp; Time</span><span>Vendor</span><span>Tracking ID</span><span>Issue</span><span>Settlement</span><span>Proof</span></div>{filteredClaims.length === 0 ? <div className="empty-vendors"><b>Filter mein return claim nahi mila</b><small>Vendor Code ya date range change kijiye.</small></div> : filteredClaims.map((item) => <div className="claim-row raised" key={item.id}><span>{new Date(item.createdAt).toLocaleString("en-IN")}</span><span><b>{item.vendorName}</b><small>{item.vendorCode}</small></span><b>{item.trackingId}</b><span><b>{item.issueType}</b><small>{item.note || (item.returnType === "rto" ? "RTO" : "Customer Return")}</small></span><span><b>₹{item.savedAmount.toLocaleString("en-IN")}</b><small>{item.status}</small><button className="vendor-action" onClick={() => { setEditingClaim(item); setClaimSavedAmount(String(item.savedAmount || "")); setClaimStatus(item.status); }}>Update</button></span><span>{item.videoUrl ? <a className="raise-claim-button link-action" href={item.videoUrl} target="_blank" rel="noreferrer">Video Proof</a> : <small className={`upload-state ${item.uploadStatus}`}>● {item.uploadStatus}</small>}</span></div>)}</div></section>}
        {view === "followUps" && <section className="data-card"><div className="data-head"><div><h2>Claim Follow Ups</h2><p>Person, contact number aur connect reason yahan aur Google Sheet mein save hota hai.</p></div><button type="button" className="vendor-action" disabled={followUpsLoading} onClick={() => void loadFollowUps(true)}>{followUpsLoading ? "↻ Refreshing…" : "↻ Refresh"}</button></div>{message && <div className={message.startsWith("✓") ? "master-message success" : "master-message"}>{message}</div>}<div className="records-table"><div className="follow-up-row labels"><span>Vendor / Tracking</span><span>Person</span><span>Contact</span><span>Reason</span><span>Sheet</span><span>Status</span></div>{!followUpsLoading && filteredFollowUps.length === 0 ? <div className="empty-vendors"><b>Filter mein Follow Up नहीं मिला</b></div> : filteredFollowUps.map((item) => <div className="follow-up-row" key={item.id}><span><b>{item.vendorName}</b><small>{item.vendorCode} · {item.trackingId}</small></span><b>{item.personName}</b><a href={`tel:${item.contactNumber}`}>{item.contactNumber}</a><span>{item.reason}</span><span className={item.sheetSynced ? "sheet-sync synced" : "sheet-sync pending"}>{item.sheetSynced ? "✓ Synced" : "Pending"}</span><select value={item.status} onChange={(event) => void updateFollowUpStatus(item, event.target.value as FollowUp["status"])}><option value="open">Open</option><option value="contacted">Contacted</option><option value="closed">Closed</option></select></div>)}</div></section>}
        {view === "customers" && <section className="data-card"><div className="data-head"><div><h2>Saare Customer Details</h2><p>Verified customer data vendor ke saath.</p></div><button className="vendor-action" disabled={refreshingView !== null} onClick={() => void refreshData("customers")}>{refreshingView === "customers" ? "↻ Refreshing…" : "↻ Refresh"}</button></div>{refreshMessage && <div className={refreshMessage.startsWith("✓") ? "refresh-message success" : "refresh-message"}>{refreshMessage}</div>}<div className="records-table"><div className="master-customer-row labels"><span>Vendor</span><span>Tracking ID</span><span>Name</span><span>Mobile</span><span>PIN</span><span>Partner</span></div>{filteredParcels.filter((item) => item.customerMobile).length === 0 ? <div className="empty-vendors"><b>Filter mein customer data nahi मिला</b></div> : filteredParcels.filter((item) => item.customerMobile).map((item) => <div className="master-customer-row" key={item.id}><span><b>{item.vendorName}</b><small>{item.vendorCode}</small></span><b>{item.trackingId}</b><span>{item.customerName}</span><span>{item.customerMobile}</span><span>{item.pincode}</span><span>{item.deliveryPartner}</span></div>)}</div></section>}
        {view === "reports" && <section className="data-card"><div className="data-head"><div><h2>Vendor Ko Ye Data Chahiye</h2><p>Vendor ID, report type aur date range check karke report taiyar aur send karo.</p></div><button className="vendor-action" onClick={() => void loadReportRequests(true)}>↻ Refresh</button></div>{message && <div className={message.startsWith("✓") ? "master-message success" : "master-message"}>{message}</div>}<div className="records-table"><div className="master-report-row labels"><span>Vendor</span><span>Report</span><span>Date Range</span><span>Vendor Note</span><span>Status</span><span>Action</span></div>{filteredReports.length === 0 ? <div className="empty-vendors"><b>Filter mein report request नहीं मिली</b></div> : filteredReports.map((item) => <div className="master-report-row" key={item.id}><span><b>{item.vendorName}</b><small>{item.vendorCode}</small></span><b>{item.reportType.toUpperCase()}</b><span>{item.dateFrom}<small>to {item.dateTo}</small></span><span>{item.note || "—"}</span><span className={`request-status ${item.status}`}>{item.status}</span><button className="vendor-action" onClick={() => { setEditingReport(item); setReportStatus(item.status); setReportMasterNote(item.masterNote); setReportUrl(item.reportUrl); }}>Open Request</button></div>)}</div></section>}
        {view === "settings" && <section className="data-card settings-card"><h2>Master Account</h2><p>Ye panel Master Passcode aur secure session se protected hai.</p><div className="setting-line"><span>Master Admin</span><strong>{ownerName}</strong></div><div className="setting-line"><span>Vendor Accounts</span><strong>{vendors.length}</strong></div><div className="setting-line"><span>Total Parcels</span><strong>{parcelCount}</strong></div><button className="primary compact-primary" onClick={() => void openView("vendors")}>Vendor Management Kholiye</button></section>}
      </section>

      {showForm && (
        <div className="vendor-modal" role="dialog" aria-modal="true" aria-label="Add new vendor">
          <form className="vendor-form" onSubmit={addVendor}>
            <button type="button" className="modal-close" onClick={() => setShowForm(false)}>×</button>
            <span className="form-kicker">NEW VENDOR ACCOUNT</span>
            <h2>Naya Vendor Add Karo</h2>
            <p>Vendor ko ye Code aur PIN packing panel login ke liye dena hoga.</p>
            <div className="vendor-fields">
              <label>Business Name<input required value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} placeholder="Example: Siya Fashion" /></label>
              <label>
                Owner Name
                <input required autoComplete="name" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} placeholder="Business owner ka full name" />
                <small className="field-help">Google Sheet ke Contact Name mein yahi save hoga.</small>
              </label>
              <label>Mobile Number<input required inputMode="numeric" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })} placeholder="10-digit mobile" /></label>
              <label>Vendor Code<input required value={form.vendorCode} onChange={(e) => setForm({ ...form, vendorCode: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "") })} placeholder="Example: SIYA001" /></label>
              <label className="wide">Vendor Login PIN<input required type="password" inputMode="numeric" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 8) })} placeholder="4–8 digit PIN" /></label>
              <label>User Limit<input required type="number" min="1" max="100" value={form.userLimit} onChange={(e) => setForm({ ...form, userLimit: e.target.value.replace(/\D/g, "").slice(0, 3) })} /><small className="field-help">Example: 5 means 6th device/user login reject hoga.</small></label>
              <label>Extra User Rate (₹/month)<input required type="number" min="0" value={form.extraUserRate} onChange={(e) => setForm({ ...form, extraUserRate: e.target.value.replace(/\D/g, "").slice(0, 6) })} /><small className="field-help">Plan base price ke upar per additional user.</small></label>
            </div>
            <div className="vendor-form-actions"><button type="button" onClick={() => setShowForm(false)}>Cancel</button><button className="primary" disabled={busy}>{busy ? "Add ho raha hai…" : "Vendor Account Banao"}</button></div>
          </form>
        </div>
      )}
      {resetRequest && (
        <div className="vendor-modal" role="dialog" aria-modal="true" aria-label="Reset vendor PIN">
          <form className="vendor-form reset-pin-form" onSubmit={saveNewPin}>
            <button className="modal-close" type="button" onClick={() => setResetRequest(null)}>×</button>
            <span className="form-kicker">MASTER PIN RESET</span>
            <h2>Naya Vendor PIN Set Karo</h2>
            <p>{vendors.find((vendor) => vendor.id === resetRequest.vendorId)?.businessName} ke liye naya login PIN set karo.</p>
            <label>New Login PIN<input autoFocus required type="password" inputMode="numeric" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="4–8 digit new PIN" /></label>
            <div className="vendor-form-actions"><button type="button" onClick={() => setResetRequest(null)}>Cancel</button><button className="primary" disabled={busy}>{busy ? "Save ho raha hai…" : "Naya PIN Save Karo"}</button></div>
          </form>
        </div>
      )}
      {accessVendor && (
        <div className="vendor-modal" role="dialog" aria-modal="true" aria-label="Vendor user and IP policy">
          <form className="vendor-form access-policy-form" onSubmit={saveAccessPolicy}>
            <button className="modal-close" type="button" onClick={() => setAccessVendor(null)}>×</button>
            <span className="form-kicker">VENDOR USER CONTROL</span>
            <h2>{accessVendor.businessName}</h2>
            <p>{accessVendor.vendorCode} · अभी {accessVendor.activeUsers} active users · IP changes {accessVendor.maxIpChanges}/5</p>
            <div className="vendor-fields">
              <label>Maximum Users<input autoFocus required type="number" min="1" max="100" value={accessUserLimit} onChange={(e) => setAccessUserLimit(e.target.value.replace(/\D/g, "").slice(0, 3))} /><small className="field-help">Limit full होने पर अगला नया device login नहीं होगा.</small></label>
              <label>Extra User Rate (₹/month)<input required type="number" min="0" value={accessUserRate} onChange={(e) => setAccessUserRate(e.target.value.replace(/\D/g, "").slice(0, 6))} /><small className="field-help">1 user plan में included; बाकी users पर यह rate लगेगा.</small></label>
            </div>
            <div className="ip-rule-note"><b>IP Rule</b><span>Login वाली IP से session बंधा रहेगा. IP बदलने पर फिर login होगा. 5 बदलाव allowed; 6वीं बार security block.</span></div>
            <div className="vendor-form-actions"><button type="button" onClick={() => setAccessVendor(null)}>Cancel</button><button className="primary" disabled={busy}>{busy ? "Save ho raha hai…" : "Users & Rate Save Karo"}</button></div>
          </form>
        </div>
      )}
      {editingReport && <div className="vendor-modal" role="dialog" aria-modal="true"><div className="vendor-form"><button className="modal-close" onClick={() => setEditingReport(null)}>×</button><span className="form-kicker">REPORT REQUEST #{editingReport.id}</span><h2>{editingReport.vendorName}</h2><p>{editingReport.vendorCode} · {editingReport.reportType.toUpperCase()} · {editingReport.dateFrom} to {editingReport.dateTo}</p><label>Status<select value={reportStatus} onChange={(e) => setReportStatus(e.target.value)}><option value="requested">Requested</option><option value="preparing">Preparing</option><option value="ready">Ready</option><option value="sent">Sent</option><option value="rejected">Rejected</option></select></label><label>Master Reply<textarea value={reportMasterNote} onChange={(e) => setReportMasterNote(e.target.value)} placeholder="Vendor ko status ya instruction likho" /></label><label>Report Download Link (Optional)<input value={reportUrl} onChange={(e) => setReportUrl(e.target.value)} placeholder="Secure report link paste karo" /></label><div className="vendor-form-actions"><button onClick={() => setEditingReport(null)}>Cancel</button><button className="primary" onClick={() => void updateReportRequest()}>Save &amp; Send Update</button></div></div></div>}
      {editingClaim && <div className="vendor-modal" role="dialog" aria-modal="true"><div className="vendor-form"><button className="modal-close" onClick={() => setEditingClaim(null)}>×</button><span className="form-kicker">CLAIM SETTLEMENT #{editingClaim.id}</span><h2>{editingClaim.vendorName}</h2><p>{editingClaim.trackingId} · {editingClaim.issueType}</p><label>Saved Payment Amount (₹)<input inputMode="numeric" value={claimSavedAmount} onChange={(e) => setClaimSavedAmount(e.target.value.replace(/\D/g, ""))} placeholder="Example: 1250" /></label><label>Claim Status<select value={claimStatus} onChange={(e) => setClaimStatus(e.target.value)}><option value="raised">Raised</option><option value="submitted">Submitted</option><option value="resolved">Resolved</option></select></label><div className="vendor-form-actions"><button onClick={() => setEditingClaim(null)}>Cancel</button><button className="primary" onClick={() => void updateClaimSettlement()}>Settlement Save Karo</button></div></div></div>}
      {editingBuyerLead && <div className="vendor-modal" role="dialog" aria-modal="true" aria-label="Buyer lead follow-up details">
        <form className="vendor-form buyer-follow-up-form" onSubmit={saveBuyerLeadFollowUp}>
          <button type="button" className="modal-close" onClick={() => setEditingBuyerLead(null)}>×</button>
          <span className="form-kicker">NEW BUYER LEAD · {editingBuyerLead.leadCode}</span>
          <h2>{editingBuyerLead.contactName}</h2>
          <p><strong>{editingBuyerLead.planName} Plan</strong> · {editingBuyerLead.businessName} · {editingBuyerLead.mobile}</p>
          <div className="lead-modal-summary"><span>Purchase Stage <b>{editingBuyerLead.purchaseStage}</b></span><span>Connect Status <b>{editingBuyerLead.followUpStatus.replace("_", " ")}</b></span><span>Customer Response <b>{editingBuyerLead.customerDecision}</b></span></div>
          <label>Next Follow-up Date &amp; Time<input type="datetime-local" value={leadNextFollowUpAt} onChange={(event) => setLeadNextFollowUpAt(event.target.value)} /></label>
          <label>Master Follow-up Note<textarea value={leadMasterNote} onChange={(event) => setLeadMasterNote(event.target.value)} placeholder="Call में क्या बात हुई, Razorpay link भेजा या onboarding में क्या pending है…" /></label>
          <div className="vendor-form-actions"><button type="button" onClick={() => setEditingBuyerLead(null)}>Cancel</button><button className="primary" disabled={busy}>{busy ? "Save ho raha hai…" : "Follow-up Save Karo"}</button></div>
        </form>
      </div>}
    </main>
  );
}
