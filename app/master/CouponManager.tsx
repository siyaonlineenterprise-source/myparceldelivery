"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { downloadExcelWorkbook } from "./excel";

type Coupon = {
  id: number;
  code: string;
  mobile: string;
  discountPercent: number;
  startAt: string;
  expiresAt: string;
  status: "active" | "paused" | "reserved" | "used";
  usedAt: string;
  createdAt: string;
  createdBy: string;
};

type DeletedCoupon = {
  id: number;
  couponId: number;
  code: string;
  mobile: string;
  discountPercent: number;
  startAt: string;
  expiresAt: string;
  finalStatus: string;
  usedAt: string;
  deletedAt: string;
  deletedBy: string;
  deleteReason: string;
};

const emptyForm = {
  code: "",
  mobile: "",
  discountPercent: "",
  startAt: "",
  expiresAt: "",
};

function displayDate(value: string) {
  return value ? new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—";
}

function dateKey(value: string) {
  if (!value) return "";
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date);
}

export default function CouponManager({ search, dateFrom, dateTo }: { search: string; dateFrom: string; dateTo: string }) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [deletedCoupons, setDeletedCoupons] = useState<DeletedCoupon[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("Coupons load ho rahe hain…");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function loadCoupons(showConfirmation = false) {
    setRefreshing(showConfirmation);
    try {
      const response = await fetch(`/api/master-coupons?refresh=${Date.now()}`, { cache: "no-store" });
      const data = await response.json() as { coupons?: Coupon[]; deletedCoupons?: DeletedCoupon[]; error?: string };
      if (!response.ok) return setMessage(data.error || "Coupons load nahi hue");
      setCoupons(data.coupons || []);
      setDeletedCoupons(data.deletedCoupons || []);
      setMessage(showConfirmation ? `✓ Coupons refresh ho gaye · ${new Date().toLocaleTimeString("en-IN")}` : "");
    } catch {
      setMessage("Coupons refresh nahi hue. Internet check karke dobara try kijiye.");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCoupons(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function createCoupon(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/master-coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        discountPercent: Number(form.discountPercent),
        startAt: new Date(form.startAt).toISOString(),
        expiresAt: new Date(form.expiresAt).toISOString(),
      }),
    });
    const data = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) return setMessage(data.error || "Coupon create nahi hua");
    setForm(emptyForm);
    setMessage("✓ Coupon create ho gaya—sirf selected mobile par chalega");
    await loadCoupons();
  }

  async function changeStatus(coupon: Coupon) {
    const action = coupon.status === "paused" ? "resume" : "pause";
    const response = await fetch("/api/master-coupons", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: coupon.id, action }),
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) return setMessage(data.error || "Coupon status update nahi hua");
    setMessage(action === "pause" ? "✓ Coupon pause ho gaya" : "✓ Coupon resume ho gaya");
    await loadCoupons();
  }

  async function deleteCoupon(coupon: Coupon) {
    if (!window.confirm(`${coupon.code} coupon delete karke Deleted Coupons archive mein bhejna hai?`)) return;
    const response = await fetch("/api/master-coupons", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: coupon.id }),
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) return setMessage(data.error || "Coupon delete nahi hua");
    setMessage("✓ Coupon delete hua aur Deleted Coupons archive mein save ho gaya");
    await loadCoupons();
  }

  const activeCount = useMemo(() => coupons.filter((coupon) => coupon.status === "active").length, [coupons]);
  const filteredCoupons = useMemo(() => {
    const query = search.trim().toUpperCase();
    return coupons.filter((item) => {
      const key = dateKey(item.createdAt);
      return (!query || item.code.toUpperCase().includes(query) || item.mobile.includes(query))
        && (!dateFrom || key >= dateFrom)
        && (!dateTo || key <= dateTo);
    });
  }, [coupons, search, dateFrom, dateTo]);
  const filteredDeletedCoupons = useMemo(() => {
    const query = search.trim().toUpperCase();
    return deletedCoupons.filter((item) => {
      const key = dateKey(item.deletedAt);
      return (!query || item.code.toUpperCase().includes(query) || item.mobile.includes(query))
        && (!dateFrom || key >= dateFrom)
        && (!dateTo || key <= dateTo);
    });
  }, [deletedCoupons, search, dateFrom, dateTo]);
  const hasActiveFilter = Boolean(search.trim() || dateFrom || dateTo);

  return (
    <div className="coupon-workspace">
      <section className="data-card coupon-create-card">
        <div className="data-head">
          <div>
            <h2>Naya Mobile-Locked Coupon</h2>
            <p>Coupon Code + registered mobile + active date/time match hone par hi discount लगेगा. Har coupon sirf ek successful use ke liye hai.</p>
          </div>
          <b className="coupon-count">{activeCount} Active</b>
        </div>
        <form className="coupon-form" onSubmit={createCoupon}>
          <label>Coupon Code
            <input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32) })} placeholder="Example: FRIEND50" />
          </label>
          <label>Mobile Number
            <input required inputMode="numeric" value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value.replace(/\D/g, "").slice(0, 10) })} placeholder="10-digit number" />
          </label>
          <label>Discount Percentage
            <input required type="number" min="1" max="100" inputMode="numeric" value={form.discountPercent} onChange={(event) => setForm({ ...form, discountPercent: event.target.value })} placeholder="1 to 100" />
          </label>
          <label>Start Date &amp; Time
            <input required type="datetime-local" value={form.startAt} onChange={(event) => setForm({ ...form, startAt: event.target.value })} />
          </label>
          <label>Expiry Date &amp; Time
            <input required type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} />
          </label>
          <button className="primary compact-primary" disabled={busy}>{busy ? "Create ho raha hai…" : "Coupon Create Karo"}</button>
        </form>
        {message && <div className={message.startsWith("✓") ? "master-message success" : "master-message"}>{message}</div>}
      </section>

      <section className="data-card">
        <div className="data-head"><div><h2>Active / Paused Coupons</h2><p>Pause coupon checkout par turant invalid ho jayega. Used coupon dobara activate nahi hoga.</p></div><div className="claim-head-actions"><button className="vendor-action" disabled={refreshing} onClick={() => void loadCoupons(true)}>{refreshing ? "↻ Refreshing…" : "↻ Refresh"}</button><button className="add-vendor-button" onClick={() => { if (!hasActiveFilter) return; downloadExcelWorkbook("filtered-coupons", [
          ["Created At", "Coupon Code", "Mobile", "Discount %", "Start At", "Expiry At", "Status", "Used At", "Created By"],
          ...filteredCoupons.map((item) => [item.createdAt, item.code, item.mobile, item.discountPercent, item.startAt, item.expiresAt, item.status, item.usedAt, item.createdBy]),
        ]); }} disabled={!hasActiveFilter} title={hasActiveFilter ? "Filtered coupons download karein" : "Download ke liye pehle search ya date filter lagaiye"}>↓ Download Excel</button></div></div>
        <div className="records-table">
          <div className="coupon-row labels"><span>Coupon / Mobile</span><span>Discount</span><span>Start</span><span>Expiry</span><span>Status</span><span>Action</span></div>
          {filteredCoupons.length === 0 ? <div className="empty-vendors"><b>Filter mein coupon नहीं मिला</b></div> : filteredCoupons.map((coupon) => {
            const expired = new Date(coupon.expiresAt) < new Date() && coupon.status !== "used";
            return <div className="coupon-row" key={coupon.id}>
              <span><b>{coupon.code}</b><small>{coupon.mobile}</small></span>
              <strong>{coupon.discountPercent}%</strong>
              <span>{displayDate(coupon.startAt)}</span>
              <span>{displayDate(coupon.expiresAt)}</span>
              <span className={`coupon-status ${expired ? "expired" : coupon.status}`}>{expired ? "Expired" : coupon.status}</span>
              <span className="coupon-actions">
                {!expired && coupon.status !== "used" && coupon.status !== "reserved" && <button className="vendor-action" onClick={() => void changeStatus(coupon)}>{coupon.status === "paused" ? "Resume" : "Pause"}</button>}
                <button className="vendor-action danger" onClick={() => void deleteCoupon(coupon)}>Delete</button>
              </span>
            </div>;
          })}
        </div>
      </section>

      <section className="data-card">
        <div className="data-head"><div><h2>Deleted Coupons Archive</h2><p>Delete kiya hua coupon yahan audit date/time aur account ke saath safe rahega.</p></div><button className="add-vendor-button" onClick={() => { if (!hasActiveFilter) return; downloadExcelWorkbook("deleted-coupons", [
          ["Deleted At", "Deleted By", "Coupon ID", "Coupon Code", "Mobile", "Discount %", "Start At", "Expiry At", "Final Status", "Used At", "Reason"],
          ...filteredDeletedCoupons.map((item) => [item.deletedAt, item.deletedBy, item.couponId, item.code, item.mobile, item.discountPercent, item.startAt, item.expiresAt, item.finalStatus, item.usedAt, item.deleteReason]),
        ]); }} disabled={!hasActiveFilter} title={hasActiveFilter ? "Filtered deleted coupons download karein" : "Download ke liye pehle search ya date filter lagaiye"}>↓ Download Excel</button></div>
        <div className="records-table">
          <div className="deleted-coupon-row labels"><span>Deleted At / By</span><span>Coupon</span><span>Mobile</span><span>Discount</span><span>Validity</span><span>Final Status</span></div>
          {filteredDeletedCoupons.length === 0 ? <div className="empty-vendors"><b>Filter mein deleted coupon नहीं मिला</b></div> : filteredDeletedCoupons.map((item) => <div className="deleted-coupon-row" key={item.id}>
            <span><b>{displayDate(item.deletedAt)}</b><small>{item.deletedBy}</small></span>
            <b>{item.code}</b>
            <span>{item.mobile}</span>
            <strong>{item.discountPercent}%</strong>
            <span><small>{displayDate(item.startAt)}</small><small>to {displayDate(item.expiresAt)}</small></span>
            <span className="coupon-status deleted">{item.finalStatus}</span>
          </div>)}
        </div>
      </section>
    </div>
  );
}
