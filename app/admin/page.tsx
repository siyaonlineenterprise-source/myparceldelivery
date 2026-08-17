"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import BrandLogo from "../components/BrandLogo";

type Stage = "scan" | "recording" | "error";
type AdminView = "home" | "studio" | "returns" | "returnRecords" | "parcels" | "integration" | "reports" | "settings";
type Parcel = { id: number; trackingId: string; bagId: string; uploadStatus: string; videoUrl: string; createdAt: string };
type ReturnProof = { id: number; trackingId: string; returnType: "return" | "rto"; uploadStatus: string; videoUrl: string; createdAt: string; claimId: number | null };
type ReportRequest = { id: number; reportType: string; dateFrom: string; dateTo: string; note: string; status: string; masterNote: string; reportUrl: string; createdAt: string };
type PendingOrder = { id: number; marketplace: string; orderId: string; trackingId: string };
type ReconciliationRow = {
  orderId: string;
  trackingId: string;
  orderDate: string;
  paymentMode: string;
  marketplaceStatus: string;
  packingStatus: string;
  grossAmountPaise: number;
  deductionsPaise: number;
  netPaidPaise: number;
  differencePaise: number;
  paymentStatus: "pending" | "paid" | "partial" | "held" | "returned";
  paymentDate: string;
  utr: string;
  matched: boolean;
};
type ReconciliationStats = {
  totalOrders: number;
  paidOrders: number;
  attentionOrders: number;
  returnedOrders: number;
  unmatchedOrders: number;
  grossAmountPaise: number;
  deductionsPaise: number;
  netPaidPaise: number;
};
type ShippingLabelOrder = {
  id: number;
  orderId: string;
  trackingId: string;
  deliveryPartner: string;
  labelAvailable: boolean;
};
type PurchasePlanName = "Trial" | "Nano" | "Starter" | "Growth";
type RazorpaySuccess = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayCheckout = { open: () => void; on: (event: string, handler: (response: { error?: { description?: string } }) => void) => void };
type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayCheckout;
type VendorStats = {
  accountActive: boolean;
  savedAmount: number;
  protectedClaims: number;
  customerViews: number;
  todayOrders: number;
  packedOrders: number;
  pendingOrders: number;
  pendingOrderList: PendingOrder[];
};
type VendorIdentity = {
  businessName: string;
  contactName: string;
  vendorCode: string;
  userLimit: number;
  extraUserRatePaise: number;
};
const purchasePlans: Record<PurchasePlanName, { videos: number; basePaise: number; gstPaise: number; totalPaise: number }> = {
  Trial: { videos: 35, basePaise: 9_900, gstPaise: 1_782, totalPaise: 11_682 },
  Nano: { videos: 150, basePaise: 18_800, gstPaise: 3_384, totalPaise: 22_184 },
  Starter: { videos: 1500, basePaise: 150_000, gstPaise: 27_000, totalPaise: 177_000 },
  Growth: { videos: 3000, basePaise: 255_000, gstPaise: 45_900, totalPaise: 300_900 },
};
const emptyVendorStats: VendorStats = {
  accountActive: false,
  savedAmount: 0,
  protectedClaims: 0,
  customerViews: 0,
  todayOrders: 0,
  packedOrders: 0,
  pendingOrders: 0,
  pendingOrderList: [],
};
const emptyReconciliationStats: ReconciliationStats = {
  totalOrders: 0,
  paidOrders: 0,
  attentionOrders: 0,
  returnedOrders: 0,
  unmatchedOrders: 0,
  grossAmountPaise: 0,
  deductionsPaise: 0,
  netPaidPaise: 0,
};
const deliveryPartners = ["Auto", "Ekart", "Shadowfax", "Delhivery", "Valmo", "XpressBees", "Ecom Express", "Amazon Shipping", "Blue Dart", "DTDC", "Other"] as const;

function normalizedDeliveryPartner(value: string, fallback = "Pending") {
  const cleaned = value.trim();
  const key = cleaned.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!key) return fallback;
  if (key.includes("ekart")) return "Ekart";
  if (key.includes("shadowfax")) return "Shadowfax";
  if (key.includes("delhivery")) return "Delhivery";
  if (key.includes("valmo")) return "Valmo";
  if (key.includes("xpressbees")) return "XpressBees";
  if (key.includes("ecomexpress")) return "Ecom Express";
  if (key.includes("amazonshipping") || key === "amazon") return "Amazon Shipping";
  if (key.includes("bluedart")) return "Blue Dart";
  if (key.includes("dtdc")) return "DTDC";
  return cleaned.slice(0, 60) || fallback;
}

const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export default function AdminPanel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const trackingRef = useRef<HTMLInputElement>(null);
  const bagRef = useRef<HTMLInputElement>(null);
  const orderFileRef = useRef<HTMLInputElement>(null);
  const settlementFileRef = useRef<HTMLInputElement>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [vendorCode, setVendorCode] = useState("");
  const [vendor, setVendor] = useState<VendorIdentity | null>(null);
  const [loginMessage, setLoginMessage] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [loginBusy, setLoginBusy] = useState(true);
  const [pin, setPin] = useState("");
  const [trackingId, setTrackingId] = useState("");
  const [bagId, setBagId] = useState("");
  const [deliveryPartner, setDeliveryPartner] = useState<(typeof deliveryPartners)[number]>("Auto");
  const [importDeliveryPartner, setImportDeliveryPartner] = useState<(typeof deliveryPartners)[number]>("Auto");
  const [stage, setStage] = useState<Stage>("scan");
  const [seconds, setSeconds] = useState(0);
  const [message, setMessage] = useState("Tracking ID scan kijiye");
  const [uploadMessage, setUploadMessage] = useState("");
  const [view, setView] = useState<AdminView>("integration");
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [returnType, setReturnType] = useState<"return" | "rto">("return");
  const [returnProofs, setReturnProofs] = useState<ReturnProof[]>([]);
  const [claimProof, setClaimProof] = useState<ReturnProof | null>(null);
  const [claimIssue, setClaimIssue] = useState("");
  const [claimNote, setClaimNote] = useState("");
  const [claimMessage, setClaimMessage] = useState("");
  const [claimedProofIds, setClaimedProofIds] = useState<number[]>([]);
  const [claimIdsByProof, setClaimIdsByProof] = useState<Record<number, number>>({});
  const [followUpClaim, setFollowUpClaim] = useState<{ claimId: number; trackingId: string } | null>(null);
  const [followUpPerson, setFollowUpPerson] = useState("");
  const [followUpContact, setFollowUpContact] = useState("");
  const [followUpReason, setFollowUpReason] = useState("");
  const [followUpMessage, setFollowUpMessage] = useState("");
  const [refreshingView, setRefreshingView] = useState<"parcels" | "returnRecords" | null>(null);
  const [refreshMessage, setRefreshMessage] = useState("");
  const [reportRequests, setReportRequests] = useState<ReportRequest[]>([]);
  const [reportType, setReportType] = useState("orders");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportNote, setReportNote] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const [reportRefreshing, setReportRefreshing] = useState(false);
  const [reportTrackingId, setReportTrackingId] = useState("");
  const [reportVideoReady, setReportVideoReady] = useState(false);
  const [reportVideoMessage, setReportVideoMessage] = useState("");
  const [vendorStats, setVendorStats] = useState<VendorStats>(emptyVendorStats);
  const [reconciliationStats, setReconciliationStats] = useState<ReconciliationStats>(emptyReconciliationStats);
  const [reconciliationRows, setReconciliationRows] = useState<ReconciliationRow[]>([]);
  const [shippingLabelOrders, setShippingLabelOrders] = useState<ShippingLabelOrder[]>([]);
  const [shippingLabelsOpen, setShippingLabelsOpen] = useState(false);
  const [syncBusy, setSyncBusy] = useState<"orders" | "settlements" | "refresh" | null>(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [purchasePlan, setPurchasePlan] = useState<PurchasePlanName | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const modeRef = useRef<"packing" | "return">("packing");
  const purchaseQuote = purchasePlan ? (() => {
    const base = purchasePlans[purchasePlan];
    const userChargePaise = Math.max(0, (vendor?.userLimit || 1) - 1) * (vendor?.extraUserRatePaise || 9900);
    const basePaise = base.basePaise + userChargePaise;
    const gstPaise = Math.round(basePaise * .18);
    return { ...base, basePaise, gstPaise, totalPaise: basePaise + gstPaise, userChargePaise };
  })() : null;

  function resetVendorWorkspace() {
    setView("integration");
    setParcels([]);
    setReturnProofs([]);
    setReportRequests([]);
    setClaimProof(null);
    setClaimedProofIds([]);
    setClaimIdsByProof({});
    setFollowUpClaim(null);
    setFollowUpPerson("");
    setFollowUpContact("");
    setFollowUpReason("");
    setFollowUpMessage("");
    setClaimIssue("");
    setClaimNote("");
    setClaimMessage("");
    setReportMessage("");
    setReportTrackingId("");
    setReportVideoReady(false);
    setReportVideoMessage("");
    setRefreshMessage("");
    setVendorStats(emptyVendorStats);
    setReconciliationStats(emptyReconciliationStats);
    setReconciliationRows([]);
    setShippingLabelOrders([]);
    setShippingLabelsOpen(false);
    setSyncBusy(null);
    setSyncMessage("");
    setTrackingId("");
    setBagId("");
    setStage("scan");
    setSeconds(0);
  }

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const plan = params.get("plan");
    if (params.get("action") === "buy" && (plan === "Trial" || plan === "Nano" || plan === "Starter" || plan === "Growth")) {
      window.setTimeout(() => setPurchasePlan(plan), 0);
    }
  }, []);

  function closePayment() {
    if (paymentBusy) return;
    setPurchasePlan(null);
    setCouponCode("");
    setPaymentMessage("");
    window.history.replaceState({}, "", "/admin");
  }

  async function loadRazorpayCheckout() {
    const razorpayWindow = window as Window & { Razorpay?: RazorpayConstructor };
    if (razorpayWindow.Razorpay) return razorpayWindow.Razorpay;
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Razorpay Checkout load nahi hua"));
      document.head.appendChild(script);
    });
    if (!razorpayWindow.Razorpay) throw new Error("Razorpay Checkout load nahi hua");
    return razorpayWindow.Razorpay;
  }

  async function startPayment() {
    if (!purchasePlan || !vendor) return;
    setPaymentBusy(true);
    setPaymentMessage("Secure checkout taiyar ho raha hai…");
    try {
      const response = await fetch("/api/payments/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: purchasePlan, couponCode }),
      });
      const data = await response.json() as {
        error?: string;
        message?: string;
        freeActivation?: boolean;
        keyId?: string;
        orderId?: string;
        totalAmountPaise?: number;
        currency?: string;
        businessName?: string;
        contactName?: string;
        mobile?: string;
      };
      if (response.ok && data.freeActivation) {
        setPaymentMessage(`✓ ${data.message || "Coupon verified aur plan activate ho gaya"}`);
        setPaymentBusy(false);
        await loadVendorStats();
        window.setTimeout(() => {
          setPurchasePlan(null);
          setCouponCode("");
          setPaymentMessage("");
          window.history.replaceState({}, "", "/admin");
        }, 1800);
        return;
      }
      if (!response.ok || !data.keyId || !data.orderId || !data.totalAmountPaise) {
        throw new Error(data.error || "Payment start nahi hua");
      }
      const Razorpay = await loadRazorpayCheckout();
      const checkout = new Razorpay({
        key: data.keyId,
        amount: data.totalAmountPaise,
        currency: data.currency || "INR",
        name: "My Parcel Delivery",
        description: `${purchasePlan} Plan · ${purchasePlan === "Trial" ? "7 days" : "30 days"}`,
        order_id: data.orderId,
        prefill: {
          name: data.contactName || data.businessName || "",
          contact: data.mobile || "",
        },
        notes: {
          vendor: data.businessName || vendor.businessName,
          plan: purchasePlan,
          gst: "18%",
        },
        theme: { color: "#1769ff" },
        handler: async (payment: RazorpaySuccess) => {
          setPaymentMessage("Payment verify ho raha hai…");
          const verifyResponse = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payment),
          });
          const verifyData = await verifyResponse.json() as { error?: string; message?: string };
          if (!verifyResponse.ok) {
            setPaymentMessage(verifyData.error || "Payment verification pending hai");
            setPaymentBusy(false);
            return;
          }
          setPaymentMessage(`✓ ${verifyData.message || "Payment successful"}`);
          setPaymentBusy(false);
          await loadVendorStats();
          window.setTimeout(() => {
          setPurchasePlan(null);
          setCouponCode("");
          setPaymentMessage("");
            window.history.replaceState({}, "", "/admin");
          }, 1800);
        },
        modal: {
          ondismiss: () => {
            setPaymentBusy(false);
            setPaymentMessage("Payment cancel hua—koi amount charge nahi hua.");
          },
        },
      });
      checkout.on("payment.failed", (failure) => {
        setPaymentBusy(false);
        setPaymentMessage(failure.error?.description || "Payment fail hua. Dobara try kijiye.");
      });
      setPaymentMessage("");
      checkout.open();
    } catch (error) {
      setPaymentBusy(false);
      setPaymentMessage(error instanceof Error ? error.message : "Payment start nahi hua");
    }
  }
  async function loadVendorStats() {
    const response = await fetch("/api/vendor-stats", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as VendorStats;
    setVendorStats(data);
  }

  function money(paise: number) {
    return `₹${(Number(paise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function parseCsv(text: string) {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (character === '"') {
        if (quoted && text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = !quoted;
      } else if (character === "," && !quoted) {
        row.push(cell.trim());
        cell = "";
      } else if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && text[index + 1] === "\n") index += 1;
        row.push(cell.trim());
        if (row.some(Boolean)) rows.push(row);
        row = [];
        cell = "";
      } else cell += character;
    }
    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);
    if (rows.length < 2) return [];
    const headers = rows[0].map((header) => header.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim());
    return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
  }

  function firstValue(row: Record<string, string>, aliases: string[]) {
    for (const alias of aliases) {
      const key = alias.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (row[key]) return row[key].trim();
    }
    return "";
  }

  function dateValue(value: string) {
    const raw = value.trim();
    if (!raw) return "";
    const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    const indian = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (indian) return `${indian[3]}-${indian[2].padStart(2, "0")}-${indian[1].padStart(2, "0")}`;
    return raw.slice(0, 10);
  }

  function paiseValue(value: string) {
    const amount = Number(value.replace(/[₹,\s]/g, "").replace(/[()]/g, "").trim() || 0);
    return Number.isFinite(amount) ? Math.max(0, Math.round(Math.abs(amount) * 100)) : 0;
  }

  async function loadReconciliation() {
    const response = await fetch("/api/reconciliation", { cache: "no-store" });
    const data = await response.json() as { stats?: ReconciliationStats; rows?: ReconciliationRow[]; shippingLabels?: ShippingLabelOrder[]; error?: string };
    if (!response.ok) throw new Error(data.error || "Reconciliation load nahi hui");
    setReconciliationStats(data.stats || emptyReconciliationStats);
    setReconciliationRows(data.rows || []);
    setShippingLabelOrders(data.shippingLabels || []);
  }

  const courierLabelGroups = Object.entries(
    shippingLabelOrders.reduce<Record<string, ShippingLabelOrder[]>>((groups, order) => {
      const partner = normalizedDeliveryPartner(order.deliveryPartner || "Pending");
      (groups[partner] ||= []).push(order);
      return groups;
    }, {}),
  ).sort(([first], [second]) => first.localeCompare(second));

  async function importMeeshoFile(kind: "orders" | "settlements") {
    const input = kind === "orders" ? orderFileRef.current : settlementFileRef.current;
    const file = input?.files?.[0];
    if (!file) return setSyncMessage(`${kind === "orders" ? "Order" : "Settlement"} CSV file select kijiye`);
    setSyncBusy(kind);
    setSyncMessage(`${file.name} read aur match ho rahi hai…`);
    try {
      const parsed = parseCsv(await file.text());
      if (!parsed.length) throw new Error("CSV file mein data rows nahi mili");
      if (kind === "orders") {
        const orders = parsed.map((row) => ({
          marketplace: "Meesho",
          orderId: firstValue(row, ["sub order no", "sub order number", "suborder no", "order id", "order number"]),
          trackingId: firstValue(row, ["tracking id", "tracking number", "awb", "awb number"]),
          deliveryPartner: normalizedDeliveryPartner(
            firstValue(row, ["delivery partner", "courier partner", "courier", "logistics partner", "shipping partner"]),
            importDeliveryPartner === "Auto" ? "Pending" : importDeliveryPartner,
          ),
          customerName: firstValue(row, ["customer name", "buyer name", "name"]),
          customerAddress: firstValue(row, ["customer address", "shipping address", "delivery address", "address"]),
          customerPincode: firstValue(row, ["customer pincode", "shipping pincode", "delivery pincode", "pin code", "pincode"]).replace(/\D/g, "").slice(-6),
          orderDate: dateValue(firstValue(row, ["order date", "order placed date", "created date"])),
          paymentMode: firstValue(row, ["payment mode", "payment type", "cod prepaid", "payment method"]),
          orderAmountPaise: paiseValue(firstValue(row, ["order amount", "total order value", "product price", "supplier listed price", "selling price"])),
          marketplaceStatus: firstValue(row, ["order status", "status", "shipment status"]),
          labelUrl: firstValue(row, ["shipping label url", "label url", "shipping label", "label link", "download label url"]),
        })).filter((row) => row.orderId && row.trackingId && /^\d{6}$/.test(row.customerPincode));
        if (!orders.length) throw new Error("Tracking ID, Pincode aur Sub Order columns match nahi hue");
        const response = await fetch("/api/marketplace-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orders }),
        });
        const data = await response.json() as { synced?: number; error?: string };
        if (!response.ok) throw new Error(data.error || "Orders import nahi hue");
        setSyncMessage(`✓ ${data.synced || 0} Meesho orders vendor account mein sync ho gaye`);
        await loadVendorStats();
      } else {
        const rows = parsed.map((row) => {
          const statusText = firstValue(row, ["payment status", "settlement status", "status"]).toLowerCase();
          const netPaidPaise = paiseValue(firstValue(row, ["final settlement amount", "settlement amount", "net amount", "paid amount", "net paid"]));
          const paymentStatus: ReconciliationRow["paymentStatus"] =
            /return|rto|cancel/.test(statusText) ? "returned"
              : /hold|blocked/.test(statusText) ? "held"
                : /partial/.test(statusText) ? "partial"
                  : netPaidPaise > 0 || /paid|settled/.test(statusText) ? "paid"
                    : "pending";
          return {
            marketplace: "Meesho",
            orderRef: firstValue(row, ["sub order no", "sub order number", "suborder no", "order id", "order number"]),
            trackingId: firstValue(row, ["tracking id", "tracking number", "awb", "awb number"]),
            grossAmountPaise: paiseValue(firstValue(row, ["gross amount", "order amount", "total order value", "product price", "supplier listed price"])),
            deductionsPaise: paiseValue(firstValue(row, ["total deductions", "deductions", "meesho charges", "marketplace fee", "commission"])),
            netPaidPaise,
            paymentStatus,
            paymentDate: dateValue(firstValue(row, ["payment date", "settlement date", "paid date"])),
            utr: firstValue(row, ["utr", "utr number", "bank reference", "transaction id"]),
          };
        }).filter((row) => row.orderRef);
        if (!rows.length) throw new Error("Sub Order / Order ID column match nahi hua");
        const response = await fetch("/api/reconciliation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceFile: file.name, rows }),
        });
        const data = await response.json() as { synced?: number; error?: string };
        if (!response.ok) throw new Error(data.error || "Settlement import nahi hua");
        setSyncMessage(`✓ ${data.synced || 0} payment rows match ho gayi`);
      }
      await loadReconciliation();
      if (input) input.value = "";
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "File sync nahi hui");
    } finally {
      setSyncBusy(null);
    }
  }

  async function refreshReconciliation() {
    setSyncBusy("refresh");
    setSyncMessage("Latest payment matching refresh ho rahi hai…");
    try {
      await loadReconciliation();
      setSyncMessage(`✓ Reconciliation refresh ho gayi · ${new Date().toLocaleTimeString("en-IN")}`);
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "Refresh nahi hua");
    } finally {
      setSyncBusy(null);
    }
  }

  useEffect(() => {
    fetch("/api/vendor-login", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json() as { vendor: VendorIdentity };
        setVendor(data.vendor);
        setLoggedIn(true);
        await loadVendorStats();
        try {
          await loadReconciliation();
        } catch (error) {
          setSyncMessage(error instanceof Error ? error.message : "Reconciliation load nahi hui");
        }
      })
      .finally(() => setLoginBusy(false));
  }, []);
  useEffect(() => {
    if (stage !== "recording") return;
    const timer = window.setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [stage]);

  async function login() {
    setLoginMessage("");
    if (!vendorCode.trim() || pin.length < 4) return setLoginMessage("Vendor ID aur PIN dono enter kijiye");
    setLoginBusy(true);
    const response = await fetch("/api/vendor-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendorCode, pin }),
    });
    const data = await response.json() as { error?: string; vendor?: VendorIdentity };
    setLoginBusy(false);
    if (!response.ok || !data.vendor) return setLoginMessage(data.error || "Login nahi hua");
    resetVendorWorkspace();
    setVendor(data.vendor);
    setLoggedIn(true);
    await loadVendorStats();
    try {
      await loadReconciliation();
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "Reconciliation load nahi hui");
    }
  }

  async function logout() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    await fetch("/api/vendor-login", { method: "DELETE" });
    resetVendorWorkspace();
    setLoggedIn(false);
    setVendor(null);
    setPin("");
    setVendorCode("");
  }

  async function openView(nextView: AdminView) {
    setView(nextView);
    setRefreshMessage("");
    if (nextView === "home") {
      await loadVendorStats();
      return;
    }
    if (nextView === "studio") {
      window.setTimeout(() => trackingRef.current?.focus(), 0);
      return;
    }
    if (nextView === "parcels") {
      const response = await fetch("/api/parcels", { cache: "no-store" });
      const data = await response.json() as { parcels?: Parcel[]; error?: string };
      if (!response.ok) return setMessage(data.error || "Records load nahi hue");
      setParcels(data.parcels || []);
    }
    if (nextView === "integration") {
      setSyncMessage("");
      try {
        await loadReconciliation();
      } catch (error) {
        setSyncMessage(error instanceof Error ? error.message : "Reconciliation load nahi hui");
      }
    }
    if (nextView === "returnRecords") {
      const proofResponse = await fetch("/api/returns", { cache: "no-store" });
      const data = await proofResponse.json() as { records?: ReturnProof[]; error?: string };
      if (!proofResponse.ok) return setMessage(data.error || "Return records load nahi hue");
      const records = data.records || [];
      setReturnProofs(records);
      setClaimedProofIds(records.filter((record) => record.claimId).map((record) => record.id));
      setClaimIdsByProof(Object.fromEntries(records.filter((record) => record.claimId).map((record) => [record.id, record.claimId!])));
    }
    if (nextView === "reports") await loadReportRequests();
  }

  async function loadReportRequests(showConfirmation = false) {
    setReportRefreshing(showConfirmation);
    try {
      const response = await fetch(`/api/report-requests?refresh=${Date.now()}`, { cache: "no-store" });
      const data = await response.json() as { requests?: ReportRequest[]; error?: string };
      if (!response.ok) return setReportMessage(data.error || "Report requests load nahi hui");
      setReportRequests(data.requests || []);
      if (showConfirmation) setReportMessage(`✓ Requests refresh ho gayi · ${new Date().toLocaleTimeString("en-IN")}`);
    } catch {
      setReportMessage("Requests refresh nahi hui. Internet check karke dobara try kijiye.");
    } finally {
      setReportRefreshing(false);
    }
  }

  async function submitReportRequest() {
    setReportMessage("");
    const response = await fetch("/api/report-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportType, dateFrom: reportFrom, dateTo: reportTo, note: reportNote }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) return setReportMessage(data.error || "Request submit nahi hui");
    setReportMessage("✓ Report request Master Admin ko bhej di gayi");
    setReportNote("");
    await loadReportRequests();
  }

  async function refreshRecords(target: "parcels" | "returnRecords") {
    if (refreshingView) return;
    setRefreshingView(target);
    setRefreshMessage("Data refresh ho raha hai…");
    try {
      const endpoint = target === "parcels" ? "/api/parcels" : "/api/returns";
      const response = await fetch(`${endpoint}?refresh=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await response.json() as {
        parcels?: Parcel[];
        records?: ReturnProof[];
        error?: string;
      };
      if (!response.ok) {
        setRefreshMessage(data.error || "Refresh nahi hua. Dobara try kijiye.");
        return;
      }
      if (target === "parcels") setParcels(data.parcels || []);
      else {
        const records = data.records || [];
        setReturnProofs(records);
        setClaimedProofIds(records.filter((record) => record.claimId).map((record) => record.id));
        setClaimIdsByProof(Object.fromEntries(records.filter((record) => record.claimId).map((record) => [record.id, record.claimId!])));
      }
      setRefreshMessage(`✓ Data refresh ho gaya · ${new Date().toLocaleTimeString("en-IN")}`);
    } catch {
      setRefreshMessage("Internet problem ki wajah se refresh nahi hua.");
    } finally {
      setRefreshingView(null);
    }
  }

  async function requestPinReset() {
    setLoginMessage("");
    const response = await fetch("/api/forgot-pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vendorCode }) });
    const data = await response.json() as { error?: string; message?: string };
    if (!response.ok) return setLoginMessage(data.error || "Request nahi bheji gayi");
    setLoginMessage(data.message || "Request bhej di gayi");
  }

  async function raiseClaim() {
    if (!claimProof) return;
    if (!claimIssue) return setClaimMessage("Please select your reason");
    setClaimMessage("Claim save ho raha hai…");
    const response = await fetch("/api/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnProofId: claimProof.id, issueType: claimIssue, note: claimNote }),
    });
    const data = await response.json() as { error?: string; id?: number };
    if (!response.ok) return setClaimMessage(data.error || "Claim raise nahi hua");
    setClaimedProofIds((ids) => [...ids, claimProof.id]);
    if (data.id) {
      setClaimIdsByProof((current) => ({ ...current, [claimProof.id]: data.id! }));
      setReturnProofs((records) => records.map((record) => record.id === claimProof.id ? { ...record, claimId: data.id! } : record));
    }
    setClaimMessage("✓ Claim Register Ho Gaya Hai");
  }

  async function submitFollowUp() {
    if (!followUpClaim) return;
    setFollowUpMessage("Follow Up save ho raha hai…");
    const response = await fetch("/api/follow-ups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claimId: followUpClaim.claimId,
        personName: followUpPerson,
        contactNumber: followUpContact,
        reason: followUpReason,
      }),
    });
    const data = await response.json() as { error?: string; sheetSynced?: boolean };
    if (!response.ok) return setFollowUpMessage(data.error || "Follow Up save nahi hua");
    setFollowUpMessage(data.sheetSynced
      ? "✓ Follow Up Master Admin aur Google Sheet dono mein save ho gaya"
      : "✓ Follow Up Master Admin mein save ho gaya; Sheet sync pending hai");
    setFollowUpPerson("");
    setFollowUpContact("");
    setFollowUpReason("");
  }

  async function findReportVideo() {
    const id = reportTrackingId.trim().toUpperCase();
    setReportVideoReady(false);
    if (!id) return setReportVideoMessage("Tracking ID enter kijiye");
    setReportVideoMessage("Video check ho rahi hai…");
    const response = await fetch(`/api/video-download?trackingId=${encodeURIComponent(id)}`, { cache: "no-store" });
    const data = await response.json() as { error?: string; available?: boolean };
    if (!response.ok || !data.available) return setReportVideoMessage(data.error || "Video nahi mili");
    setReportTrackingId(id);
    setReportVideoReady(true);
    setReportVideoMessage("✓ Video mil gayi. Download button dabane par hi file download hogi.");
  }

  async function prepareCamera() {
    modeRef.current = "packing";
    if (!trackingId.trim() || !bagId.trim()) return setMessage("Tracking ID aur Bag ID dono scan kijiye");
    if (trackingId.trim().toUpperCase() === bagId.trim().toUpperCase()) {
      setBagId("");
      setStage("scan");
      setMessage("Error: Tracking ID aur Bag ID same nahi ho sakte. Sahi Bag ID scan kijiye.");
      window.setTimeout(() => bagRef.current?.focus(), 0);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true });
      const response = await fetch("/api/parcels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingId, bagId, deliveryPartner }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        stream.getTracks().forEach((track) => track.stop());
        setStage("error");
        setMessage(data.error || "Parcel record live save nahi hua");
        return;
      }
      await loadVendorStats();
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      startRecording(stream);
    } catch {
      setStage("error");
      setMessage("Camera aur microphone permission Allow kijiye");
    }
  }

  async function prepareReturnCamera() {
    const id = trackingId.trim().toUpperCase();
    if (!id) return setMessage("Return parcel ki Tracking ID scan kijiye");
    try {
      modeRef.current = "return";
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: 1280, height: 720 },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      startRecording(stream);
    } catch {
      setStage("error");
      setMessage("Camera aur microphone permission Allow kijiye");
    }
  }

  function startRecording(stream: MediaStream) {
    const recordedTrackingId = trackingId.trim();
    const recordedBagId = bagId.trim();
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob([...chunksRef.current], { type: "video/webm" });
      void uploadRecording(blob, recordedTrackingId, recordedBagId, modeRef.current);
    };
    recorderRef.current = recorder;
    recorder.start(1000);
    setSeconds(0);
    setStage("recording");
    setMessage(modeRef.current === "return" ? "Return opening proof recording chal rahi hai" : "Packing recording chal rahi hai");
  }

  async function stopRecording() {
    if (recorderRef.current?.state === "recording") {
      setUploadMessage(`${trackingId} ki video background mein upload ho rahi hai…`);
      const isReturn = modeRef.current === "return";
      if (isReturn) {
        const response = await fetch("/api/returns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackingId, returnType }),
        });
        const data = await response.json() as { error?: string; id?: number };
        if (!response.ok) {
          setMessage(data.error || "Return proof record save nahi hua");
          setUploadMessage("");
          return;
        }
        (recorderRef.current as MediaRecorder & { returnProofId?: number }).returnProofId = data.id;
      }
      recorderRef.current.stop();
      nextParcel();
      setUploadMessage(`✓ ${trackingId} ${isReturn ? "return proof" : "parcel"} save ho gaya; video background mein upload ho rahi hai…`);
    }
  }

  async function uploadRecording(blob: Blob, recordedTrackingId: string, recordedBagId: string, proofMode: "packing" | "return") {
    const form = new FormData();
    form.append("video", blob, `${recordedTrackingId}-${proofMode}.webm`);
    form.append("trackingId", recordedTrackingId);
    form.append("bagId", recordedBagId);
    form.append("proofMode", proofMode);
    if (proofMode === "return") {
      form.append("returnType", returnType);
      form.append("returnProofId", String((recorderRef.current as MediaRecorder & { returnProofId?: number } | null)?.returnProofId || ""));
    }
    try {
      const response = await fetch("/api/upload", { method: "POST", body: form });
      if (!response.ok) throw new Error();
      setUploadMessage(`✓ ${recordedTrackingId} upload complete`);
    } catch {
      setUploadMessage(`${recordedTrackingId}: Secure upload nahi hua. Video automatic download nahi ki gayi—Internet check karke dobara try kijiye.`);
    }
  }

  function nextParcel() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setTrackingId(""); setBagId(""); setSeconds(0); setStage("scan");
    setMessage(modeRef.current === "return" ? "Next return: Tracking ID scan kijiye" : "Next parcel: Tracking ID scan kijiye");
    window.setTimeout(() => trackingRef.current?.focus(), 0);
  }

  if (!loggedIn) return (
    <main className="admin-login">
      <div className="login-panel">
        <Link className="brand" href="/"><BrandLogo /><div><strong>My Parcel Delivery</strong><small>VENDOR CONTROL</small></div></Link>
        <div className="lock-art">⌁</div>
        <span className="form-kicker">RESTRICTED ACCESS</span>
        <h1>Admin Panel</h1>
        <p>Ye section sirf owner aur authorised packing staff ke liye hai.</p>
        <label>Vendor ID / Code<input value={vendorCode} onChange={(e) => setVendorCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))} placeholder="Example: SIYA001" /></label>
        <label>Login PIN<input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="Enter your PIN" onKeyDown={(e) => e.key === "Enter" && void login()} /></label>
        <button className="forgot-pin-link" type="button" onClick={() => { setForgotOpen(true); setLoginMessage(""); }}>Forgot PIN?</button>
        <button className="primary" disabled={loginBusy} onClick={() => void login()}>{loginBusy ? "Checking…" : "Vendor Login"} <span>→</span></button>
        {loginMessage && <div className="form-message">{loginMessage}</div>}
        <Link className="customer-link" href="/customer">← Customer Tracking Page</Link>
      </div>
      {forgotOpen && <div className="vendor-modal" role="dialog" aria-modal="true"><div className="forgot-pin-card"><button className="modal-close" onClick={() => setForgotOpen(false)}>×</button><span className="form-kicker">SECURE PIN RECOVERY</span><h2>Forgot PIN?</h2><p>PIN screen par nahi dikhaya jayega. Vendor ID se request bhejiye; Master Admin aapke liye naya PIN set karega.</p><label>Vendor ID<input value={vendorCode} onChange={(e) => setVendorCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))} placeholder="Example: SIYA001" /></label><button className="primary" onClick={() => void requestPinReset()}>Send Reset Request <span>→</span></button>{loginMessage && <div className="form-message">{loginMessage}</div>}<button className="text-button" onClick={() => setForgotOpen(false)}>Back to login</button></div></div>}
    </main>
  );

  return (
    <main className="admin-shell">
      <aside className="admin-nav">
        <a className="brand" href="/admin"><BrandLogo /><div><strong>My Parcel Delivery</strong><small>VENDOR PANEL</small></div></a>
        <nav>
          <button className={view === "integration" ? "active" : ""} onClick={() => void openView("integration")}>⌂ Home</button>
          <button className={view === "home" ? "active" : ""} onClick={() => void openView("home")}>⌂ Work Select</button>
          <button className={view === "studio" ? "active" : ""} onClick={() => void openView("studio")}>▣ Packing Studio</button>
          <button className={view === "returns" ? "active" : ""} onClick={() => void openView("returns")}>↩ Return Opening</button>
          <button className={view === "returnRecords" ? "active" : ""} onClick={() => void openView("returnRecords")}>▤ Return Proof Records</button>
          <button className={view === "parcels" ? "active" : ""} onClick={() => void openView("parcels")}>▤ Parcel Records</button>
          <button className={view === "reports" ? "active" : ""} onClick={() => void openView("reports")}>▧ Reports</button>
          <button className={view === "settings" ? "active" : ""} onClick={() => void openView("settings")}>⚙ Settings</button>
        </nav>
        <div className="admin-user"><span>{vendor?.businessName.slice(0, 2).toUpperCase()}</span><div><b>{vendor?.businessName}</b><small>{vendor?.vendorCode} · Vendor</small></div><button className="logout-mini" onClick={() => void logout()}>Logout</button></div>
      </aside>
      <section className="admin-content">
        <header><div><span className="form-kicker">VENDOR WORKSPACE</span><h1>{view === "home" ? "Aaj Ka Kaam Select Karo" : view === "studio" ? "Packing Studio" : view === "returns" ? "Return / RTO Opening" : view === "returnRecords" ? "Return Proof Records" : view === "parcels" ? "Parcel Records" : view === "integration" ? "Meesho Orders & Payment Reconciliation" : view === "reports" ? "Report Request" : "Vendor Settings"}</h1></div><div className={`system-pill ${stage === "recording" ? "live" : ""}`}><i />{stage === "recording" ? "RECORDING" : "SYSTEM READY"}</div></header>
        {view === "home" && <>
          <section className="trust-metrics order-progress-metrics">
            <article><span>Today Orders</span><strong>{vendorStats.todayOrders.toLocaleString("en-IN")}</strong><small>Aaj marketplace se aaye total orders</small></article>
            <article><span>Packed</span><strong>{vendorStats.packedOrders.toLocaleString("en-IN")}</strong><small>Tracking ID match karke pack ho chuke</small></article>
            <article><span>Packing Baaki</span><strong>{vendorStats.pendingOrders.toLocaleString("en-IN")}</strong><small>Abhi scan aur pack karne wale orders</small></article>
          </section>
          {vendorStats.pendingOrderList.length > 0 && (
            <section className="pending-orders-card">
              <div className="pending-orders-head"><div><span className="form-kicker">TODAY&apos;S PENDING QUEUE</span><h2>Abhi Packing Baaki Hai</h2></div><b>{vendorStats.pendingOrders} Pending</b></div>
              <div className="pending-order-list">
                {vendorStats.pendingOrderList.map((order) => (
                  <article key={order.id}><span>{order.marketplace}</span><b>{order.trackingId}</b><small>{order.orderId ? `Order: ${order.orderId}` : "Original marketplace Tracking ID"}</small></article>
                ))}
              </div>
              {vendorStats.pendingOrders > vendorStats.pendingOrderList.length && <small className="pending-more">+{vendorStats.pendingOrders - vendorStats.pendingOrderList.length} aur orders packing baaki</small>}
            </section>
          )}
          <section className="trust-metrics vendor-trust-metrics">
            <article><span>Vendor Status</span><strong>{vendorStats.accountActive ? "ACTIVE" : "—"}</strong><small>Sirf aapke vendor account ka status</small></article>
            <article><span>Wrong Return Savings</span><strong>₹{vendorStats.savedAmount.toLocaleString("en-IN")}</strong><small>{vendorStats.protectedClaims.toLocaleString("en-IN")} claims ke payments protected</small></article>
            <article><span>Verified Customers</span><strong>{vendorStats.customerViews.toLocaleString("en-IN")}</strong><small>Sirf aapka packing proof dekhne wale customers</small></article>
          </section>
          <section className="work-choice"><button onClick={() => void openView("studio")}><span>📦</span><b>New Parcel Packing</b><small>Naya parcel pack karke dispatch proof video banao</small><i>Start Packing →</i></button><button className="return-choice" onClick={() => void openView("returns")}><span>↩</span><b>Return / RTO Opening</b><small>Wapas aaye parcel ko kholte waqt continuous proof video banao</small><i>Record Return →</i></button></section>
        </>}
        {view === "studio" && (
        <div className="admin-grid">
          <section className="scan-panel">
            <h2>Nayi Parcel Recording</h2><p>Scanner se pehle Tracking ID, phir Bag ID scan karo.</p>
            <label>Tracking ID<input ref={trackingRef} autoFocus value={trackingId} onChange={(e) => setTrackingId(e.target.value)} placeholder="Scan Tracking ID" onKeyDown={(e) => e.key === "Enter" && bagRef.current?.focus()} /></label>
            <label>Bag ID<input ref={bagRef} value={bagId} onChange={(e) => { setBagId(e.target.value); if (message.startsWith("Error: Tracking ID")) setMessage("Bag ID scan kijiye"); }} placeholder="Scan Bag ID — recording auto start" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void prepareCamera(); } }} /></label>
            <label>Delivery Partner<select value={deliveryPartner} onChange={(event) => setDeliveryPartner(event.target.value as (typeof deliveryPartners)[number])}>{deliveryPartners.map((partner) => <option key={partner} value={partner}>{partner === "Auto" ? "Auto — imported order se" : partner}</option>)}</select></label>
            {stage === "scan" && <button className="primary" onClick={prepareCamera}>Camera &amp; Recording Start Karo <span>→</span></button>}
            {stage === "error" && <button className="primary" onClick={nextParcel}>Agla Parcel <span>→</span></button>}
            <div className="status-box"><i className={stage} /><div><small>CURRENT STATUS</small><b>{message}</b></div></div>
            {uploadMessage && <div className="background-upload">{uploadMessage}</div>}
          </section>
          <section className="record-panel">
            <div className="record-head"><h2>Live Packing Camera</h2><b className="timer">● {clock(seconds)}</b></div>
            <div className={`camera-frame ${stage === "recording" ? "is-recording" : ""}`}>
              <video ref={videoRef} muted playsInline />
              {!streamRef.current && <div className="camera-empty"><span>◉</span><b>Camera Preview</b><small>Dono IDs scan hote hi camera yahan start hoga</small></div>}
              {stage === "recording" && <div className="rec-badge">● REC</div>}
            </div>
            <div className="record-actions">
              {stage === "recording" && <button className="end-button" onClick={() => void stopRecording()}>■ Video End Karo &amp; Agla Parcel</button>}
              {stage === "scan" && <span>Bag ID scan hote hi recording automatic start ho jayegi</span>}
            </div>
          </section>
        </div>
        )}
        {view === "returns" && (
        <div className="admin-grid return-studio">
          <section className="scan-panel">
            <h2>Return Parcel Entry</h2><p>Pehle type select karo. Tracking ID scan karte hi camera aur recording start hogi.</p>
            <div className="return-type-select">
              <button className={returnType === "return" ? "active" : ""} onClick={() => setReturnType("return")}>Customer Return<small>Customer ne parcel kholkar wapas bheja</small></button>
              <button className={returnType === "rto" ? "active" : ""} onClick={() => setReturnType("rto")}>RTO<small>Customer ne parcel receive/open nahi kiya</small></button>
            </div>
            <label>Tracking ID<input ref={trackingRef} autoFocus value={trackingId} onChange={(e) => setTrackingId(e.target.value)} placeholder="Scan Tracking ID — recording auto start" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void prepareReturnCamera(); } }} /></label>
            {stage === "scan" && <button className="primary" onClick={prepareReturnCamera}>Camera &amp; Proof Recording Start <span>→</span></button>}
            {stage === "error" && <button className="primary" onClick={nextParcel}>Dobara Try Karo <span>→</span></button>}
            <div className="proof-note"><b>⚠ Continuous proof rule</b><span>Recording start hone ke baad parcel, label aur opening pura frame mein rakho. Beech mein video band na karo.</span></div>
            <div className="status-box"><i className={stage} /><div><small>CURRENT STATUS</small><b>{message}</b></div></div>
            {uploadMessage && <div className="background-upload">{uploadMessage}</div>}
          </section>
          <section className="record-panel">
            <div className="record-head"><h2>Live Return Opening Camera</h2><b className="timer">● {clock(seconds)}</b></div>
            <div className={`camera-frame ${stage === "recording" ? "is-recording" : ""}`}>
              <video ref={videoRef} muted playsInline />
              {!streamRef.current && <div className="camera-empty"><span>◉</span><b>Proof Camera Preview</b><small>Tracking ID scan hote hi camera yahan start hoga</small></div>}
              {stage === "recording" && <><div className="rec-badge">● RETURN PROOF REC</div><div className="proof-watermark">{returnType === "rto" ? "RTO" : "CUSTOMER RETURN"} · {trackingId}</div></>}
            </div>
            <div className="record-actions">
              {stage === "recording" && <button className="end-button" onClick={() => void stopRecording()}>■ Stop Recording &amp; Proof Save Karo</button>}
              {stage === "scan" && <span>Scanner Enter signal milte hi recording automatic start hogi</span>}
            </div>
          </section>
        </div>
        )}
        {view === "returnRecords" && <section className="data-card"><div className="data-head"><div><h2>Return / RTO Proof Videos</h2><p>Video secure storage mein safe rahegi. Problem mile to isi record se claim ya follow up karo.</p></div><button className="vendor-action" disabled={refreshingView !== null} onClick={() => void refreshRecords("returnRecords")}>{refreshingView === "returnRecords" ? "↻ Refreshing…" : "↻ Refresh"}</button></div>{refreshMessage && <div className={refreshMessage.startsWith("✓") ? "refresh-message success" : "refresh-message"}>{refreshMessage}</div>}<div className="records-table"><div className="return-record-row labels"><span>Tracking ID</span><span>Type</span><span>Date &amp; Time</span><span>Video Proof</span><span>Claim Action</span></div>{returnProofs.length === 0 ? <div className="empty-vendors"><b>Abhi return proof record nahi hai</b><small>Return / RTO Opening se pehli recording complete karo.</small></div> : returnProofs.map((item) => <div className="return-record-row" key={item.id}><b>{item.trackingId}</b><span className={`return-chip ${item.returnType}`}>{item.returnType === "rto" ? "RTO" : "Customer Return"}</span><span>{new Date(item.createdAt).toLocaleString("en-IN")}</span><span>{item.videoUrl ? <b className="drive-safe">☁ Securely saved</b> : <small className={`upload-state ${item.uploadStatus}`}>● {item.uploadStatus}</small>}</span><span>{claimedProofIds.includes(item.id) || item.claimId ? <span className="claimed-actions"><button className="follow-up-button" onClick={() => { setFollowUpClaim({ claimId: item.claimId || claimIdsByProof[item.id], trackingId: item.trackingId }); setFollowUpMessage(""); }}>☎ Follow Up</button>{item.videoUrl ? <a className="claim-download-button" href={`/api/video-download?trackingId=${encodeURIComponent(item.trackingId)}&download=1`}>↓ Download Video</a> : <button className="claim-download-button pending" disabled>↓ Video Pending</button>}</span> : <button className="raise-claim-button" onClick={() => { setClaimProof(item); setClaimIssue(""); setClaimMessage(""); setClaimNote(""); }}>✋ Raise a Claim</button>}</span></div>)}</div></section>}
        {view === "parcels" && <section className="data-card"><div className="data-head"><div><h2>Aapke Parcel Records</h2><p>Video secure cloud storage mein safe hoti hai; yahan automatic download nahi hoga.</p></div><button className="vendor-action" disabled={refreshingView !== null} onClick={() => void refreshRecords("parcels")}>{refreshingView === "parcels" ? "↻ Refreshing…" : "↻ Refresh"}</button></div>{refreshMessage && <div className={refreshMessage.startsWith("✓") ? "refresh-message success" : "refresh-message"}>{refreshMessage}</div>}<div className="records-table"><div className="record-row labels"><span>Tracking ID</span><span>Bag ID</span><span>Date</span><span>Video</span><span>Storage</span></div>{parcels.length === 0 ? <div className="empty-vendors"><b>Abhi koi parcel record nahi hai</b><small>Packing Studio se pehli recording complete karo.</small></div> : parcels.map((item) => <div className="record-row" key={item.id}><b>{item.trackingId}</b><code>{item.bagId}</code><span>{new Date(item.createdAt).toLocaleDateString("en-IN")}</span><span className={`upload-state ${item.uploadStatus}`}>● {item.uploadStatus}</span><span>{item.videoUrl ? <b className="drive-safe">☁ Securely saved</b> : <small>Upload pending</small>}</span></div>)}</div></section>}
        {view === "integration" && <section className="integration-stack">
          <div className="integration-status">
            <div><span className="form-kicker">MEESHO CONNECTION</span><h2>Orders aur Payments Sync</h2><p>Abhi secure CSV sync ready hai. Direct auto-sync Meesho-approved API access milte hi isi screen par enable hoga.</p></div>
            <span className="connection-chip">● CSV SYNC READY</span>
          </div>
          <div className="sync-cards">
            <article className="sync-card">
              <span className="sync-number">1</span>
              <div><h3>Order Report Import</h3><p>Meesho se order CSV download karke yahan select karo. Tracking ID, customer pincode, delivery partner aur order amount vendor-wise save honge.</p></div>
              <label>Delivery Partner<select value={importDeliveryPartner} onChange={(event) => setImportDeliveryPartner(event.target.value as (typeof deliveryPartners)[number])}>{deliveryPartners.map((partner) => <option key={partner} value={partner}>{partner === "Auto" ? "Auto — CSV/label se" : partner}</option>)}</select></label>
              <input ref={orderFileRef} type="file" accept=".csv,text/csv" aria-label="Meesho order CSV" />
              <button className="primary compact-primary" disabled={syncBusy !== null} onClick={() => void importMeeshoFile("orders")}>{syncBusy === "orders" ? "Orders Sync Ho Rahe Hain…" : "Order CSV Sync Karo"}</button>
            </article>
            <article className="sync-card">
              <span className="sync-number">2</span>
              <div><h3>Payment / Settlement Import</h3><p>Meesho Payments se settlement CSV select karo. Sub Order ID par paid amount, deductions, UTR aur pending difference automatic match hoga.</p></div>
              <input ref={settlementFileRef} type="file" accept=".csv,text/csv" aria-label="Meesho settlement CSV" />
              <button className="primary compact-primary" disabled={syncBusy !== null} onClick={() => void importMeeshoFile("settlements")}>{syncBusy === "settlements" ? "Payments Match Ho Rahe Hain…" : "Settlement CSV Match Karo"}</button>
            </article>
          </div>
          {syncMessage && <div className={syncMessage.startsWith("✓") ? "refresh-message success" : "form-message"}>{syncMessage}</div>}
          <section className="trust-metrics reconciliation-metrics">
            <button className="orders-quantity-card" onClick={() => setShippingLabelsOpen(true)}>
              <span>Total Order Quantity</span><strong>{shippingLabelOrders.length.toLocaleString("en-IN")}</strong><small>Courier-wise labels download / print →</small>
            </button>
            <article><span>Gross Order Value</span><strong>{money(reconciliationStats.grossAmountPaise)}</strong><small>{reconciliationStats.totalOrders} imported orders</small></article>
            <article><span>Meesho Deductions</span><strong>{money(reconciliationStats.deductionsPaise)}</strong><small>Fees, adjustments aur deductions</small></article>
            <article><span>Bank Payment Received</span><strong>{money(reconciliationStats.netPaidPaise)}</strong><small>{reconciliationStats.paidOrders} fully reconciled</small></article>
            <article><span>Check Required</span><strong>{reconciliationStats.attentionOrders}</strong><small>{reconciliationStats.unmatchedOrders} unmatched report rows</small></article>
          </section>
          <section className="data-card">
            <div className="data-head"><div><h2>Order-wise Payment Reconciliation</h2><p>Paid, pending, partial, held aur return adjustment ek hi जगह दिखेंगे.</p></div><button className="vendor-action" disabled={syncBusy !== null} onClick={() => void refreshReconciliation()}>{syncBusy === "refresh" ? "↻ Refreshing…" : "↻ Refresh"}</button></div>
            <div className="records-table"><div className="reconciliation-row labels"><span>Order / Tracking</span><span>Order</span><span>Deductions</span><span>Bank Paid</span><span>Difference</span><span>Status / UTR</span></div>
              {reconciliationRows.length === 0 ? <div className="empty-vendors"><b>Abhi Meesho order ya payment report import nahi hui</b><small>Pehle Order CSV, phir Settlement CSV sync karo.</small></div> : reconciliationRows.map((item, index) => <div className="reconciliation-row" key={`${item.orderId}-${item.trackingId}-${index}`}><span><b>{item.orderId || "Order ID missing"}</b><small>{item.trackingId || "Tracking ID pending"} · {item.orderDate || "Date pending"}</small></span><b>{money(item.grossAmountPaise)}</b><span className="deduction-amount">− {money(item.deductionsPaise)}</span><b className="paid-amount">{money(item.netPaidPaise)}</b><b className={Math.abs(item.differencePaise) <= 100 ? "difference-ok" : "difference-alert"}>{money(item.differencePaise)}</b><span><b className={`recon-status ${item.paymentStatus}`}>{item.paymentStatus}</b><small>{item.utr ? `UTR: ${item.utr}` : item.matched ? "UTR pending" : "Order/settlement match pending"}</small></span></div>)}
            </div>
          </section>
        </section>}
        {view === "reports" && <section className="report-layout">
          <div className="report-side-stack">
          <div className="data-card report-video-card"><div className="data-head"><div><h2>Tracking Video Download</h2><p>Sirf apni Tracking ID enter karo. Button click karne par hi video download hogi.</p></div></div>
            <label>Tracking ID<input value={reportTrackingId} onChange={(e) => { setReportTrackingId(e.target.value.toUpperCase()); setReportVideoReady(false); setReportVideoMessage(""); }} placeholder="Tracking ID enter karo" /></label>
            <button className="primary compact-primary" onClick={() => void findReportVideo()}>Video Check Karo</button>
            {reportVideoMessage && <div className={reportVideoReady ? "refresh-message success" : "form-message"}>{reportVideoMessage}</div>}
            {reportVideoReady && <a className="download-video-button" href={`/api/video-download?trackingId=${encodeURIComponent(reportTrackingId)}&download=1`}>↓ Download Video</a>}
          </div>
          <div className="data-card report-form-card"><div className="data-head"><div><h2>Report Ke Liye Apply Karo</h2><p>Customer data nahi dikhega. Master Admin request check karke report bhejega.</p></div></div>
            <label>Report Type<select value={reportType} onChange={(e) => setReportType(e.target.value)}><option value="orders">Order Report</option><option value="returns">Return / RTO Report</option><option value="claims">Claim Report</option><option value="custom">Custom Report</option></select></label>
            <div className="report-dates"><label>From Date<input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} /></label><label>To Date<input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} /></label></div>
            <label>Details / Note<textarea value={reportNote} onChange={(e) => setReportNote(e.target.value)} placeholder="Aapko exactly kaunsa data chahiye?" /></label>
            <button className="primary compact-primary" disabled={!reportFrom || !reportTo} onClick={() => void submitReportRequest()}>Request Submit Karo</button>
            {reportMessage && <div className={reportMessage.startsWith("✓") ? "master-message success" : "form-message"}>{reportMessage}</div>}
          </div>
          </div>
          <div className="data-card"><div className="data-head"><div><h2>Aapki Requests</h2><p>Status aur Master Admin ka reply yahan dikhega.</p></div><button className="vendor-action" disabled={reportRefreshing} onClick={() => void loadReportRequests(true)}>{reportRefreshing ? "↻ Refreshing…" : "↻ Refresh"}</button></div>
            <div className="records-table"><div className="report-row labels"><span>Report</span><span>Date Range</span><span>Requested</span><span>Status</span><span>Master Reply</span></div>{reportRequests.length === 0 ? <div className="empty-vendors"><b>Abhi koi report request nahi hai</b></div> : reportRequests.map((item) => <div className="report-row" key={item.id}><b>{item.reportType.toUpperCase()}</b><span>{item.dateFrom}<small>to {item.dateTo}</small></span><span>{new Date(item.createdAt).toLocaleDateString("en-IN")}</span><span className={`request-status ${item.status}`}>{item.status}</span><span>{item.reportUrl ? <a className="vendor-action link-action" href={item.reportUrl} target="_blank" rel="noreferrer">Report Download</a> : <small>{item.masterNote || "Master reply pending"}</small>}</span></div>)}</div>
          </div>
        </section>}
        {view === "settings" && <section className="data-card settings-card"><h2>Vendor Account</h2><p>Logged in business aur vendor code check karo ya safely logout karo.</p><div className="setting-line"><span>Business Name</span><strong>{vendor?.businessName}</strong></div><div className="setting-line"><span>Vendor Code</span><strong>{vendor?.vendorCode}</strong></div><button className="end-button compact" onClick={() => void logout()}>Logout Karo</button></section>}
      </section>
      {purchasePlan && purchaseQuote && loggedIn && <div className="vendor-modal payment-modal" role="dialog" aria-modal="true" aria-labelledby="payment-title"><div className="vendor-form payment-card">
        <button className="modal-close" onClick={closePayment} disabled={paymentBusy}>×</button>
        <span className="form-kicker">SECURE RAZORPAY CHECKOUT</span>
        <h2 id="payment-title">{purchasePlan} Plan</h2>
        <p>{purchasePlans[purchasePlan].videos.toLocaleString("en-IN")} video credits · {vendor?.userLimit || 1} users · {purchasePlan === "Trial" ? "7-day access · one time per vendor" : "30-day storage"}</p>
        <div className="payment-breakdown">
          <div><span>Plan price (1 user included)</span><b>₹{((purchaseQuote.basePaise - purchaseQuote.userChargePaise) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</b></div>
          {purchaseQuote.userChargePaise > 0 && <div><span>Additional {Math.max(0, (vendor?.userLimit || 1) - 1)} users</span><b>₹{(purchaseQuote.userChargePaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</b></div>}
          <div><span>GST (18%)</span><b>₹{(purchaseQuote.gstPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</b></div>
          <div className="payment-total"><span>Total payable</span><strong>₹{(purchaseQuote.totalPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></div>
        </div>
        <label className="payment-coupon-label">Coupon Code (Optional)
          <input
            value={couponCode}
            onChange={(event) => setCouponCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32))}
            placeholder="Master se mila coupon code"
            autoComplete="off"
          />
          <small>Coupon sirf registered mobile number aur active date/time match hone par lagega.</small>
        </label>
        <div className="payment-security">🔒 Payment signature server par verify hone ke baad hi plan activate hoga.</div>
        <button className="primary payment-button" disabled={paymentBusy} onClick={() => void startPayment()}>{paymentBusy ? "Coupon & payment verify ho raha hai…" : couponCode ? "Coupon Apply Karke Pay Karo" : `Pay ₹${(purchaseQuote.totalPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} <span>→</span></button>
        {paymentMessage && <div className={paymentMessage.startsWith("✓") ? "master-message success" : "form-message"}>{paymentMessage}</div>}
      </div></div>}
      {shippingLabelsOpen && <div className="vendor-modal" role="dialog" aria-modal="true" aria-labelledby="shipping-label-title"><div className="vendor-form shipping-label-card">
        <button className="modal-close" onClick={() => setShippingLabelsOpen(false)}>×</button>
        <span className="form-kicker">COURIER-WISE PACKING LABELS</span>
        <h2 id="shipping-label-title">Shipping Labels Download &amp; Print</h2>
        <p>Total {shippingLabelOrders.length.toLocaleString("en-IN")} orders courier partner ke hisaab se group hain. Kisi partner ka button dabane par uske saare available labels ek PDF mein sequence se milenge.</p>
        <div className="courier-label-list">
          {courierLabelGroups.length === 0 ? <div className="empty-vendors"><b>Abhi shipping label orders nahi hain</b><small>Meesho order sync hone ke baad courier names yahan aayenge.</small></div> : courierLabelGroups.map(([partner, orders]) => {
            const available = orders.filter((order) => order.labelAvailable).length;
            const missing = orders.length - available;
            return <article key={partner}>
              <div><span className="courier-name">{partner}</span><b>{orders.length} Parcels</b><small>{available} labels ready{missing ? ` · ${missing} label pending` : " · All ready"}</small></div>
              {available > 0 ? <a className="courier-download-button" href={`/api/shipping-labels?partner=${encodeURIComponent(partner)}`} target="_blank" rel="noreferrer">↓ Download &amp; Print</a> : <button className="courier-download-button disabled" disabled>Label Pending</button>}
            </article>;
          })}
        </div>
        <div className="label-print-note"><b>Packing order:</b> PDF mein same courier ke labels ek ke baad ek rahenge—Delhivery alag, Shadowfax alag, XpressBees alag.</div>
      </div></div>}
      {claimProof && <div className="vendor-modal" role="dialog" aria-modal="true"><div className="vendor-form claim-form"><button className="modal-close" onClick={() => setClaimProof(null)}>×</button><span className="form-kicker">MEESHO RETURN CLAIM</span><h2>Raise a Claim</h2><p>Tracking ID: <b>{claimProof.trackingId}</b>. Jo actual problem parcel kholte waqt mili, wahi select karo.</p><label>Problem Type<select value={claimIssue} onChange={(e) => { setClaimIssue(e.target.value); setClaimMessage(""); }}><option value="" disabled>Select Your Reason</option><option>Defective Product</option><option>Missing Product</option><option>Wrong Product</option><option>Used / Damaged Product</option><option>Empty Parcel</option><option>Other</option></select></label><label>Short Note (Optional)<textarea value={claimNote} onChange={(e) => setClaimNote(e.target.value)} placeholder="Parcel mein actual kya problem mili?" /></label><div className="vendor-form-actions"><button onClick={() => setClaimProof(null)}>Cancel</button><button className="primary" disabled={!claimIssue} onClick={() => void raiseClaim()}>✋ Raise Claim</button></div>{claimMessage && <div className={claimMessage.startsWith("✓") ? "master-message success" : "form-message"}>{claimMessage}</div>}</div></div>}
      {followUpClaim && <div className="vendor-modal" role="dialog" aria-modal="true"><div className="vendor-form claim-form"><button className="modal-close" onClick={() => setFollowUpClaim(null)}>×</button><span className="form-kicker">CLAIM FOLLOW UP</span><h2>Humse Connect Karo</h2><p>Tracking ID: <b>{followUpClaim.trackingId}</b></p><label>Person Name<input value={followUpPerson} onChange={(e) => setFollowUpPerson(e.target.value)} placeholder="Kis person se baat karni hai?" /></label><label>Contact Number<input inputMode="numeric" value={followUpContact} onChange={(e) => setFollowUpContact(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit mobile number" /></label><label>Why do you want to connect with us?<textarea value={followUpReason} onChange={(e) => setFollowUpReason(e.target.value)} placeholder="Follow up ka reason detail mein likho" /></label><div className="vendor-form-actions"><button onClick={() => setFollowUpClaim(null)}>Cancel</button><button className="primary" disabled={followUpPerson.trim().length < 2 || followUpContact.length !== 10 || followUpReason.trim().length < 5} onClick={() => void submitFollowUp()}>Follow Up Submit Karo</button></div>{followUpMessage && <div className={followUpMessage.startsWith("✓") ? "master-message success" : "form-message"}>{followUpMessage}</div>}</div></div>}
    </main>
  );
}
