"use client";

import { useEffect, useMemo, useState } from "react";
import { downloadExcelWorkbook } from "./excel";

type Payment = {
  id: number;
  vendorName: string;
  vendorCode: string;
  mobile: string;
  planName: string;
  originalTotalAmountPaise: number;
  discountPercent: number;
  discountAmountPaise: number;
  couponCode: string;
  expectedAmountPaise: number;
  receivedAmountPaise: number;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  providerStatus: string;
  status: string;
  createdAt: string;
  paidAt: string;
};

function money(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function downloadPaymentsExcel(payments: Payment[]) {
  const rows = [
    ["Created At", "Paid At", "Vendor", "Vendor Code", "Mobile", "Plan", "Coupon", "Discount %", "Original Total", "Razorpay Amount", "Received Amount", "Razorpay Order ID", "Razorpay Payment ID", "Razorpay Status", "Order Status"],
    ...payments.map((item) => [
      item.createdAt, item.paidAt, item.vendorName, item.vendorCode, item.mobile, item.planName, item.couponCode, item.discountPercent,
      item.originalTotalAmountPaise / 100, item.expectedAmountPaise / 100, item.receivedAmountPaise / 100,
      item.razorpayOrderId, item.razorpayPaymentId, item.providerStatus, item.status,
    ]),
  ];
  downloadExcelWorkbook("payment-ledger", rows);
}

function dateKey(value: string) {
  if (!value) return "";
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date);
}

export default function PaymentLedger({ vendorSearch, dateFrom, dateTo }: { vendorSearch: string; dateFrom: string; dateTo: string }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [message, setMessage] = useState("Payments load ho rahe hain…");
  const [refreshing, setRefreshing] = useState(false);
  const hasActiveFilter = Boolean(vendorSearch.trim() || dateFrom || dateTo);

  const filteredPayments = useMemo(() => {
    const search = vendorSearch.trim().toUpperCase();
    return payments.filter((item) => {
      const key = dateKey(item.createdAt);
      return item.razorpayOrderId.startsWith("order_")
        && (!search || item.vendorCode.toUpperCase().includes(search))
        && (!dateFrom || key >= dateFrom)
        && (!dateTo || key <= dateTo);
    });
  }, [payments, vendorSearch, dateFrom, dateTo]);

  async function loadPayments(showConfirmation = false) {
    setRefreshing(showConfirmation);
    try {
      const response = await fetch(`/api/master-payments?refresh=${Date.now()}`, { cache: "no-store" });
      const data = await response.json() as { payments?: Payment[]; error?: string };
      if (!response.ok) return setMessage(data.error || "Payments load nahi hue");
      setPayments(data.payments || []);
      setMessage(showConfirmation ? `✓ Payments refresh ho gaye · ${new Date().toLocaleTimeString("en-IN")}` : "");
    } catch {
      setMessage("Payments refresh nahi hue. Internet check karke dobara try kijiye.");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPayments(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section className="data-card payment-ledger-card">
        <div className="data-head">
          <div><h2>Razorpay Website Payments</h2><p>Sirf myparceldelivery.in ke Razorpay checkout se bane online transactions. Manual party payment yahan add ya edit nahi ho sakta.</p></div>
          <div className="claim-head-actions"><button className="vendor-action" disabled={refreshing} onClick={() => void loadPayments(true)}>{refreshing ? "↻ Refreshing…" : "↻ Refresh"}</button><button className="add-vendor-button" disabled={!hasActiveFilter} title={hasActiveFilter ? "Filtered Razorpay payments download karein" : "Download ke liye pehle Vendor Code ya date filter lagaiye"} onClick={() => { if (hasActiveFilter) downloadPaymentsExcel(filteredPayments); }}>↓ Download Excel</button></div>
        </div>
        {message && <div className={message.startsWith("✓") ? "master-message success" : "master-message"}>{message}</div>}
        <div className="records-table">
          <div className="payment-ledger-row labels"><span>Vendor / Plan</span><span>Razorpay IDs</span><span>Amount</span><span>Received</span><span>Razorpay Status</span><span>Website Status</span><span>Date &amp; Time</span></div>
          {filteredPayments.length === 0 ? <div className="empty-vendors"><b>Filter mein Razorpay website payment nahi मिला</b><small>Manual ya 100% free-coupon entry yahan नहीं दिखाई जाएगी.</small></div> : filteredPayments.map((item) => (
            <div className="payment-ledger-row" key={item.id}>
              <span><b>{item.vendorName}</b><small>{item.vendorCode} · {item.mobile} · {item.planName}</small>{item.couponCode && <small>Coupon: {item.couponCode} ({item.discountPercent}%)</small>}</span>
              <span><code>{item.razorpayOrderId}</code><small>{item.razorpayPaymentId || "Payment ID pending"}</small></span>
              <strong>{money(item.expectedAmountPaise)}</strong>
              <strong className={item.receivedAmountPaise > 0 ? "money-match" : ""}>{item.receivedAmountPaise > 0 ? money(item.receivedAmountPaise) : "Awaiting"}</strong>
              <span className={`payment-reco-status ${item.providerStatus}`}>{item.providerStatus}</span>
              <span className={`payment-reco-status ${item.status}`}>{item.status}</span>
              <span><b>{new Date(item.createdAt).toLocaleString("en-IN")}</b><small>{item.paidAt ? `Paid: ${new Date(item.paidAt).toLocaleString("en-IN")}` : "Payment pending"}</small></span>
            </div>
          ))}
        </div>
      </section>
  );
}
