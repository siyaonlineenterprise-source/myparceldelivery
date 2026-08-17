"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import BrandLogo from "./components/BrandLogo";

const workflows = [
  {
    number: "01",
    icon: "⌁",
    title: "Open Order, AWB & Bag Scan",
    text: "Marketplace ka original AWB/label as-is rehta hai. Operator Tracking ID aur Bag ID scan karke proof ko sahi order se link karta hai.",
  },
  {
    number: "02",
    icon: "●",
    title: "Packaging Video",
    text: "Packing ke waqt product, label, quantity aur sealed parcel ka video record hota hai—manual file naming ki zaroorat nahi.",
  },
  {
    number: "03",
    icon: "☁",
    title: "Secure Storage",
    text: "Video account-wise private cloud record mein save hoti hai. Har seller ko sirf apne business ka data aur proof dikhta hai.",
  },
  {
    number: "04",
    icon: "↺",
    title: "Return / RTO Proof",
    text: "Return parcel kholte waqt naya proof record karo aur original dispatch video ke saath mismatch check karo.",
  },
  {
    number: "05",
    icon: "✓",
    title: "Claim & Follow-up",
    text: "Problem mile to same Tracking ID se claim raise karo, proof download karo aur follow-up status track karo.",
  },
];

const workflowStageLabels = ["SCAN", "PACK", "STORE", "RTO", "CLAIM"] as const;

const useCases = [
  ["Fashion & Apparel", "Wrong colour, used garment, missing piece aur damaged return ka proof."],
  ["Footwear & Accessories", "Pair mismatch, size issue aur box replacement ko clearly record karo."],
  ["Electronics", "Serial number, accessories, seal aur working-condition packing evidence."],
  ["Beauty & Cosmetics", "Seal, batch, quantity aur leakage-free dispatch ka visual record."],
  ["Jewellery & High Value", "Item count, design, weight slip aur tamper-proof packing evidence."],
  ["D2C & Marketplace", "Meesho, Amazon, Flipkart, Myntra ya website orders—Tracking ID based proof."],
];

const marketplaceBrands = [
  { name: "Meesho", logo: "/brands/meesho.png" },
  { name: "Amazon", logo: "/brands/amazon.svg" },
  { name: "Flipkart", logo: "/brands/flipkart.svg" },
  { name: "Myntra", logo: "/brands/myntra.svg" },
  { name: "WooCommerce", logo: "/brands/woocommerce.svg" },
];

const vmsHighlights = [
  {
    eyebrow: "PACKING PROOF",
    title: "हर parcel की अपनी video identity.",
    text: "Tracking ID और Bag ID scan होते ही recording उसी order से जुड़ती है. Hours की CCTV footage नहीं—एक search, exact proof.",
    accent: "blue",
  },
  {
    eyebrow: "RETURN / RTO",
    title: "Dispatch और return. Side by side.",
    text: "Original packing proof और return opening video एक ही timeline में compare करें. Wrong, used, missing और damaged item साफ़ दिखता है.",
    accent: "orange",
  },
  {
    eyebrow: "CLAIM READY",
    title: "Evidence खोजो नहीं. खोलो.",
    text: "Video, Tracking ID, customer verification और follow-up status एक secure record में—marketplace dispute के लिए ready.",
    accent: "green",
  },
];

type SellerPlan = {
  name: "Trial" | "Nano" | "Starter" | "Growth";
  orders: string;
  monthlyVideos: number;
  rate: number;
  fit: string;
  features: string[];
  basePrice?: number;
  durationLabel?: string;
  advisorDailyOrders?: number;
  featured?: boolean;
  trial?: boolean;
};

const plans: SellerPlan[] = [
  {
    name: "Trial",
    orders: "5 orders / day",
    monthlyVideos: 35,
    rate: 0,
    basePrice: 99,
    durationLabel: "7 days",
    advisorDailyOrders: 5,
    fit: "First-time vendor trial",
    features: ["35 video credits", "1 user included", "Extra user ₹99/month", "Sirf ek baar per vendor"],
    trial: true,
  },
  {
    name: "Nano",
    orders: "5 orders / day",
    monthlyVideos: 150,
    rate: 1.25,
    fit: "New seller / testing",
    features: ["150 video credits / month", "1 user included", "Extra user ₹99/month", "Customer QR verification"],
  },
  {
    name: "Starter",
    orders: "50 orders / day",
    monthlyVideos: 1500,
    rate: 1,
    fit: "Regular marketplace seller",
    features: ["1,500 video credits / month", "1 user included", "Extra user ₹99/month", "Vendor-private dashboard"],
    featured: true,
  },
  {
    name: "Growth",
    orders: "100 orders / day",
    monthlyVideos: 3000,
    rate: .85,
    fit: "Growing seller team",
    features: ["3,000 video credits / month", "1 user included", "Extra user ₹99/month", "Reports & proof download"],
  },
];

const emptyBuyerForm = {
  contactName: "",
  mobile: "",
  whatsapp: "",
  email: "",
  businessName: "",
  city: "",
  state: "",
  marketplace: "Meesho",
  monthlyOrders: "",
  preferredContactTime: "Any time",
  note: "",
  website: "",
};

export default function MarketingHome() {
  const [dailyOrders, setDailyOrders] = useState(50);
  const [retention, setRetention] = useState<30 | 60 | 90>(30);
  const [selectedPlan, setSelectedPlan] = useState("Starter");
  const [menuOpen, setMenuOpen] = useState(false);
  const [buyerModalPlan, setBuyerModalPlan] = useState<SellerPlan | null>(null);
  const [buyerForm, setBuyerForm] = useState(emptyBuyerForm);
  const [buyerSubmitting, setBuyerSubmitting] = useState(false);
  const [buyerError, setBuyerError] = useState("");
  const [buyerSuccess, setBuyerSuccess] = useState<{ leadCode: string; createdAt: string } | null>(null);
  const [activeWorkflowStep, setActiveWorkflowStep] = useState(0);

  useEffect(() => {
    const query = window.location.search;
    const params = new URLSearchParams(query);
    if (params.has("trackingId") || params.has("parcelId") || params.has("id")) {
      window.location.replace(`/customer${query}`);
    }
  }, []);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.querySelectorAll<HTMLElement>("[data-reveal-item]").forEach((item, index) => {
              item.style.setProperty("--reveal-delay", `${Math.min(index * 90, 540)}ms`);
            });
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -48px" },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let frame = 0;
    let maxScroll = 1;
    let heroRange = 520;

    const measurePage = () => {
      maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      heroRange = Math.max(520, window.innerHeight * .8);
    };

    const updateMotion = () => {
      frame = 0;
      const scrollTop = window.scrollY;
      const progress = Math.min(1, Math.max(0, scrollTop / maxScroll));
      const heroProgress = Math.min(1, Math.max(0, scrollTop / heroRange));
      document.documentElement.style.setProperty("--page-progress", progress.toFixed(4));
      if (scrollTop <= heroRange * 1.15) {
        document.documentElement.style.setProperty("--hero-progress", heroProgress.toFixed(4));
      }
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateMotion);
    };
    const onResize = () => {
      measurePage();
      onScroll();
    };
    measurePage();
    updateMotion();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const steps = Array.from(document.querySelectorAll<HTMLElement>(".cinematic-step"));
    if (!(("IntersectionObserver") in window)) {
      steps.forEach((step, index) => step.classList.toggle("is-active", index === 0));
      setActiveWorkflowStep(0);
      return;
    }

    const visibleRatios = new Map<Element, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          visibleRatios.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
        });

        let nextIndex = -1;
        let strongestRatio = 0;
        steps.forEach((step, index) => {
          const ratio = visibleRatios.get(step) ?? 0;
          if (ratio > strongestRatio) {
            strongestRatio = ratio;
            nextIndex = index;
          }
        });

        if (nextIndex >= 0) {
          steps.forEach((step, index) => step.classList.toggle("is-active", index === nextIndex));
          setActiveWorkflowStep(nextIndex);
        }
      },
      { threshold: [0, 0.15, 0.3, 0.45, 0.6, 0.75], rootMargin: "-10% 0px -10%" },
    );

    steps.forEach((step) => observer.observe(step));
    return () => observer.disconnect();
  }, []);

  const recommendation = useMemo(() => {
    const monthly = Math.max(0, dailyOrders) * 30;
    const sixMonthVideos = monthly * 6;
    const baseRate = monthly <= 300 ? 1.25 : monthly <= 1500 ? 1 : monthly <= 3000 ? .85 : monthly <= 10000 ? .7 : .5;
    const retentionFactor = retention === 30 ? 1 : retention === 60 ? 1.25 : 1.5;
    const rate = baseRate * retentionFactor;
    const monthlyPrice = monthly * rate;
    const plan = monthly <= 300 ? "Nano" : monthly <= 1500 ? "Starter" : monthly <= 3000 ? "Growth" : monthly <= 10000 ? "Pro" : "Scale";
    return { plan, monthly, sixMonthVideos, rate, monthlyPrice, sixMonthPrice: monthlyPrice * 6 };
  }, [dailyOrders, retention]);

  function selectPlan(plan: (typeof plans)[number]) {
    setSelectedPlan(plan.name);
    setDailyOrders(plan.advisorDailyOrders ?? plan.monthlyVideos / 30);
    setRetention(30);
  }

  function buyPlan(plan: (typeof plans)[number]) {
    setBuyerModalPlan(plan);
    setBuyerForm({
      ...emptyBuyerForm,
      monthlyOrders: String(plan.monthlyVideos),
    });
    setBuyerError("");
    setBuyerSuccess(null);
  }

  function closeBuyerForm() {
    if (buyerSubmitting) return;
    setBuyerModalPlan(null);
    setBuyerError("");
    setBuyerSuccess(null);
  }

  async function submitBuyerLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!buyerModalPlan) return;
    setBuyerSubmitting(true);
    setBuyerError("");
    try {
      const response = await fetch("/api/buyer-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buyerForm,
          planName: buyerModalPlan.name,
          retentionDays: retention,
        }),
      });
      const data = await response.json() as { error?: string; leadCode?: string; createdAt?: string };
      if (!response.ok) {
        setBuyerError(data.error || "Details save nahi hui. Dobara try kijiye.");
        return;
      }
      setBuyerSuccess({
        leadCode: data.leadCode || "MPD-LEAD",
        createdAt: data.createdAt || new Date().toISOString(),
      });
    } catch {
      setBuyerError("Internet problem hai. Details check karke dobara submit kijiye.");
    } finally {
      setBuyerSubmitting(false);
    }
  }

  return (
    <main className="marketing-page">
      <div className="page-progress" aria-hidden="true" />
      <header className="marketing-header">
        <Link className="brand marketing-brand" href="/">
          <BrandLogo />
          <span><strong>My Parcel Delivery</strong><small>VIDEO MANAGEMENT SYSTEM</small></span>
        </Link>
        <button className="mobile-menu" onClick={() => setMenuOpen((value) => !value)} aria-label="Open navigation">☰</button>
        <nav className={menuOpen ? "marketing-nav open" : "marketing-nav"}>
          <a href="#problem">Why VMS?</a>
          <a href="#workflow">How It Works</a>
          <a href="#use-cases">Use Cases</a>
          <a href="#plans">Plans</a>
          <Link href="/customer">Customer Verify</Link>
          <Link className="nav-login" href="/admin">Seller Login</Link>
        </nav>
      </header>

      <section className="marketing-hero">
        <div className="hero-grid-glow" />
        <div className="marketing-hero-copy hero-motion-copy">
          <span className="hero-badge"><i /> Video Management System for Indian sellers</span>
          <h1>Proof.<br /><em>Parcel by parcel.</em></h1>
          <p>Packing से return तक—हर important moment को Tracking ID से जोड़ने वाला premium VMS. Searchable video evidence, customer verification और claim follow-up एक ही system में.</p>
          <div className="hero-actions">
            <a className="marketing-primary" href="#plans">Plans Dekho <span>→</span></a>
            <a className="marketing-secondary" href="#workflow"><span>▶</span> Kaise Kaam Karta Hai</a>
          </div>
          <div className="hero-assurances">
            <span>Mobile + PC ready</span>
            <span>Private seller workspace</span>
            <span>Tracking + Bag ID search</span>
          </div>
        </div>

        <div className="vms-showcase hero-motion-visual" aria-label="My Parcel Delivery VMS dashboard preview">
          <div className="showcase-top"><span><i /> MPD Live Proof</span><b>● SYSTEM READY</b></div>
          <div className="showcase-body">
            <aside>
              <span className="active">⌁ Packing</span>
              <span>↺ Returns</span>
              <span>✓ Claims</span>
              <span>▤ Reports</span>
            </aside>
            <div className="showcase-main">
              <div className="showcase-heading"><small>LIVE RECORDING</small><strong>Tracking ID linked</strong></div>
              <div className="camera-preview">
                <div className="parcel-box"><i /><b>MPD</b></div>
                <span className="rec-dot">● REC</span>
                <span className="tracking-tag">TRK 3478 2016 5590 42</span>
              </div>
              <div className="proof-line"><span><i>1</i> Tracking scanned</span><span><i>2</i> Video secured</span><span><i>3</i> Claim ready</span></div>
            </div>
          </div>
          <div className="floating-proof"><b>✓ Proof secured</b><small>Private cloud record</small></div>
          <div className="floating-return"><b>RETURN MATCH</b><strong>98%</strong><small>Original proof found</small></div>
        </div>
        <a className="scroll-cue" href="#problem" aria-label="Scroll to see how My Parcel Delivery works"><span>Scroll</span><i /></a>
      </section>

      <section className="market-strip" aria-label="Supported selling channels" data-reveal>
        <span>Made for sellers on</span>
        {marketplaceBrands.map((brand) => (
          <span className="market-brand" tabIndex={0} key={brand.name}>
            <img src={brand.logo} alt="" aria-hidden="true" />
            <b>{brand.name}</b>
          </span>
        ))}
      </section>

      <section className="cinematic-proof" id="workflow" aria-label="VMS scroll experience">
        <div className="cinematic-sticky">
          <div className="cinematic-glow" aria-hidden="true" />
          <div className="workflow-fixed-panel">
            <div className="workflow-fixed-copy">
              <small>ONE CONNECTED VMS WORKFLOW</small>
              <h2>Scan se claim tak—<br /><em>sab ek जगह.</em></h2>
              <p>यह section यहीं रुकेगा. Scroll करते जाएँ और पूरा parcel workflow बाजू में step-by-step देखें.</p>
            </div>
            <div className="workflow-fixed-visual" aria-hidden="true">
              <div className="workflow-parcel"><i /><b>MPD</b><small>ONE PARCEL · ONE PROOF</small></div>
              <div className="workflow-proof-path">
                {workflowStageLabels.map((label, index) => (
                  <span className={activeWorkflowStep === index ? "is-active" : ""} key={label}>{label}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="workflow-stage-panel">
            <article className="cinematic-step scan-step" data-workflow-index="0">
              <div className="cinematic-step-copy">
                <small>01 / ORDER INTAKE</small>
                <h3>Open Order,<br />AWB &amp; Bag Scan.</h3>
                <p>Tracking ID और Bag ID scan होते ही सही order खुलता है और parcel proof उसी record से link हो जाता है.</p>
              </div>
              <div className="scene-portal scan-portal" aria-hidden="true">
                <div className="mpd-orb"><i /><b>MPD</b></div>
                <div className="scan-ticket"><span>ORDER CONFIRMED</span><b>TRK 3478 2016</b><small>AWB + BAG LINKED</small></div>
                <div className="portal-beam" />
              </div>
            </article>

            <article className="cinematic-step packing-step" data-workflow-index="1">
              <div className="cinematic-step-copy">
                <small>02 / RECORD</small>
                <h3>Packaging<br />Video.</h3>
                <p>Product, quantity, label और sealed parcel—सब एक order-linked recording में capture होता है.</p>
              </div>
              <div className="scene-portal camera-portal" aria-hidden="true">
                <header><i /> LIVE PACKING <b>00:18 REC</b></header>
                <div className="portal-box"><i /><b>MPD</b><small>TRK 3478</small></div>
                <span className="camera-focus top-left" /><span className="camera-focus top-right" />
                <span className="camera-focus bottom-left" /><span className="camera-focus bottom-right" />
              </div>
            </article>

            <article className="cinematic-step storage-step" data-workflow-index="2">
              <div className="cinematic-step-copy">
                <small>03 / PROTECT</small>
                <h3>Secure<br />Storage.</h3>
                <p>Selected retention के साथ private video proof सुरक्षित रहता है और Tracking ID से तुरंत searchable है.</p>
              </div>
              <div className="scene-portal cloud-portal" aria-hidden="true">
                <div className="cloud-ring ring-one" /><div className="cloud-ring ring-two" />
                <div className="cloud-lock"><span>☁</span><b>PROOF SECURED</b><small>PRIVATE VMS STORAGE</small></div>
                <i className="data-dot dot-one" /><i className="data-dot dot-two" /><i className="data-dot dot-three" />
              </div>
            </article>

            <article className="cinematic-step return-step" data-workflow-index="3">
              <div className="cinematic-step-copy">
                <small>04 / COMPARE</small>
                <h3>Return &amp;<br />RTO Proof.</h3>
                <p>Dispatch और return opening proof साथ देखें—wrong, used, missing या damaged item साफ़ पहचानें.</p>
              </div>
              <div className="scene-portal compare-portal" aria-hidden="true">
                <div className="compare-card"><span>DISPATCH</span><div className="mini-parcel">MPD</div><small>ORIGINAL PROOF</small></div>
                <div className="compare-pulse">↔</div>
                <div className="compare-card return-card"><span>RETURN / RTO</span><div className="mini-parcel opened">!</div><small>MISMATCH FOUND</small></div>
              </div>
            </article>

            <article className="cinematic-step followup-step" data-workflow-index="4">
              <div className="cinematic-step-copy">
                <small>05 / RESOLVE</small>
                <h3>Claim &amp;<br />Follow-up.</h3>
                <p>Evidence download करें, report भेजें और उसी Tracking ID पर follow-up status track करें.</p>
              </div>
              <div className="scene-portal followup-portal" aria-hidden="true">
                <div className="followup-check">✓</div>
                <b>CLAIM PROOF READY</b>
                <small>TRK 3478 2016 · FOLLOW-UP ACTIVE</small>
                <div className="followup-track"><i /><i /><i /></div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="vms-highlights" id="highlights">
        <div className="highlights-intro section-shell" data-reveal>
          <span className="section-kicker">GET THE HIGHLIGHTS</span>
          <h2>बड़ी protection.<br />Simple workflow.</h2>
        </div>
        <div className="highlight-rail">
          {vmsHighlights.map((item, index) => (
            <article className={`highlight-card ${item.accent}`} key={item.eyebrow} data-reveal>
              <div>
                <span>{item.eyebrow}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
              <div className="highlight-visual" aria-hidden="true">
                <div className="mini-dashboard">
                  <header><i /><b>My Parcel Delivery</b><small>LIVE</small></header>
                  <section>
                    <aside><i /><i /><i /><i /></aside>
                    <div>
                      <span>{index === 0 ? "PACKING VIDEO" : index === 1 ? "RETURN COMPARISON" : "CLAIM EVIDENCE"}</span>
                      <strong>{index === 0 ? "Tracking linked" : index === 1 ? "Original matched" : "Proof ready"}</strong>
                      <div className="mini-video"><b>{index === 1 ? "↔" : index === 2 ? "✓" : "●"}</b></div>
                      <small>TRK 3478 2016 5590</small>
                    </div>
                  </section>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="specs-section section-shell" data-reveal>
        <div className="specs-head">
          <span className="section-kicker">VMS CONFIGURATION</span>
          <h2>हर parcel का proof. तुरंत searchable.</h2>
        </div>
        <div className="specs-grid">
          <article data-reveal-item><strong>Tracking ID</strong><span>Searchable video proof</span></article>
          <article data-reveal-item><strong>Selected Video</strong><span>Exact parcel proof, no long footage</span></article>
          <article data-reveal-item><strong>30–90</strong><span>Days selectable video retention</span></article>
          <article data-reveal-item><strong>₹1.25</strong><span>Starting rate per video</span></article>
        </div>
      </section>

      <section className="problem-section section-shell" id="problem" data-reveal>
        <div className="section-heading">
          <span className="section-kicker">THE SELLER PROBLEM</span>
          <h2>Return आया, लेकिन proof कहाँ है?</h2>
          <p>Normal CCTV mein hours ka footage hota hai. MPD mein har proof ek Tracking ID ke saath ready milta hai.</p>
        </div>
        <div className="problem-grid">
          <article data-reveal-item><span>01</span><div className="problem-icon">↯</div><h3>Wrong / Fake Return</h3><p>Customer ya logistics se different, used, empty ya damaged parcel wapas aa sakta hai.</p></article>
          <article data-reveal-item><span>02</span><div className="problem-icon">⌕</div><h3>Footage Milta Nahi</h3><p>Continuous CCTV mein exact order ka packing proof dhoondhna slow aur difficult hota hai.</p></article>
          <article data-reveal-item><span>03</span><div className="problem-icon">₹</div><h3>Claim Reject</h3><p>Clear evidence ke bina marketplace dispute weak ho jata hai aur seller ka payment atak sakta hai.</p></article>
        </div>
      </section>

      <section className="privacy-section section-shell" data-reveal>
        <div className="privacy-copy" data-reveal-item>
          <span className="section-kicker">ROLE-BASED DATA SECURITY</span>
          <h2>Har business ka workspace private.</h2>
          <p>Seller dashboard par parcel, return, claim, savings aur customer verification records account-wise protected rehte hain. Authorized owner ko consolidated reporting milti hai.</p>
          <ul>
            <li><span>✓</span> Tracking-ID based searchable video</li>
            <li><span>✓</span> Secure packing and return proof</li>
            <li><span>✓</span> Claim follow-up and manual download</li>
            <li><span>✓</span> Role-based reporting access</li>
          </ul>
        </div>
        <div className="privacy-visual" data-reveal-item>
          <div className="master-node">MPD</div>
          <div className="node-bridge" />
          <div className="vendor-nodes"><div>SELLER 01<small>Private workspace</small></div><div>SELLER 02<small>Private workspace</small></div></div>
          <span className="lock-orbit">● ACCESS CONTROLLED</span>
        </div>
      </section>

      <section className="usecase-section" id="use-cases" data-reveal>
        <div className="section-shell">
          <div className="section-heading">
            <span className="section-kicker">WHERE YOU CAN USE MPD</span>
            <h2>Har category. Har packing desk.</h2>
            <p>Jahan order scan hota hai aur parcel pack hota hai, wahan My Parcel Delivery VMS use ho sakta hai.</p>
          </div>
          <div className="usecase-grid">
            {useCases.map(([title, text], index) => (
              <article key={title} data-reveal-item><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p><b>Explore use case →</b></article>
            ))}
          </div>
        </div>
      </section>

      <section className="plans-section section-shell" id="plans" data-reveal>
        <div className="section-heading">
          <span className="section-kicker">SIMPLE SELLER PLANS</span>
          <h2>Jitna use, utna pay.</h2>
          <p>Daily orders aur video retention select karo. Volume badhne par per-video rate automatically kam hota hai—₹1.25 se ₹0.50 per video tak.</p>
        </div>

        <div className="plan-advisor">
          <div><span className="advisor-icon">✦</span><div><b>Quick Plan Advisor</b><small>Daily packing volume enter karke suitable plan dekho.</small></div></div>
          <label>Daily packed orders
            <input type="number" min="0" max="100000" value={dailyOrders} onChange={(event) => setDailyOrders(Number(event.target.value || 0))} />
          </label>
          <div className="retention-picker"><small>Video backup</small><div>{([30, 60, 90] as const).map((days) => <button className={retention === days ? "active" : ""} key={days} onClick={() => setRetention(days)}>{days} days</button>)}</div></div>
          <div className="advisor-result">
            <small>{recommendation.monthly.toLocaleString("en-IN")} videos/month · ₹{recommendation.rate.toFixed(2)}/video</small>
            <b>₹{Math.round(recommendation.monthlyPrice).toLocaleString("en-IN")} / month</b>
            <span>{recommendation.plan} Plan · GST extra</span>
          </div>
        </div>

        <div className="plan-grid" role="radiogroup" aria-label="Seller plans">
          {plans.map((plan) => (
            <article
              className={selectedPlan === plan.name ? "selected" : ""}
              key={plan.name}
              data-reveal-item
              role="radio"
              aria-checked={selectedPlan === plan.name}
              tabIndex={0}
              onClick={() => selectPlan(plan)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  selectPlan(plan);
                }
              }}
            >
              {plan.featured && <span className="popular-tag">MOST POPULAR</span>}
              {plan.trial && <span className="popular-tag trial-tag">ONE-TIME TRIAL</span>}
              <span className="plan-fit">{plan.fit}</span>
              <h3>{plan.name}</h3>
              <strong>{plan.orders}</strong>
              <div className="plan-price"><b>₹{(plan.basePrice ?? Math.round(plan.monthlyVideos * plan.rate)).toLocaleString("en-IN")}</b><span>/{plan.durationLabel ?? "month"}*</span></div>
              <p>{plan.trial ? "First-time vendor ke liye 7-day paid trial. 1 user included; extra user ₹99/month. GST extra." : `${plan.monthlyVideos.toLocaleString("en-IN")} videos × ₹${plan.rate.toFixed(2)} per video. 1 user included; extra users ₹99/user/month. *30-day storage, GST extra.`}</p>
              <ul>{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
              <button
                type="button"
                className={selectedPlan === plan.name ? "buy-now" : ""}
                aria-pressed={selectedPlan === plan.name}
                onClick={(event) => {
                  event.stopPropagation();
                  if (selectedPlan === plan.name) {
                    buyPlan(plan);
                    return;
                  }
                  selectPlan(plan);
                }}
              >
                {selectedPlan === plan.name ? "Buy Now" : "Plan Select Karo"} <span>→</span>
              </button>
            </article>
          ))}
        </div>
        <div className="plan-selection-confirmation" role="status">✓ {selectedPlan} plan selected — ab Buy Now karke setup continue karein.</div>
        <div className="bulk-pricing">
          <div><span>PRO</span><b>3,001–10,000 videos/month</b><strong>₹0.70 / video</strong></div>
          <div><span>SCALE</span><b>10,000+ videos/month</b><strong>₹0.50 / video</strong></div>
          <p>Unused credits active plan mein carry forward kiye ja sakte hain. Storage duration ke hisaab se final credits adjust honge.</p>
        </div>
      </section>

      <section className="start-section" id="start" data-reveal>
        <div>
          <span className="section-kicker">READY TO START?</span>
          <h2>Apne next parcel se proof banana शुरू करो.</h2>
          <p>Seller setup ke liye plan choose karo. Existing customers apne parcel QR se direct verification page khol sakte hain.</p>
        </div>
        <div className="start-actions">
          <Link className="marketing-primary" href="/admin">Seller Login <span>→</span></Link>
          <Link className="marketing-secondary light-button" href="/customer">Customer Parcel Verify</Link>
        </div>
      </section>

      <footer className="marketing-footer" data-reveal>
        <div className="footer-brand"><Link className="brand marketing-brand" href="/"><BrandLogo /><span><strong>My Parcel Delivery</strong><small>VIDEO MANAGEMENT SYSTEM</small></span></Link><p>Order-linked video proof for packing, returns and seller claims.</p></div>
        <div><b>Product</b><a href="#workflow">How It Works</a><a href="#use-cases">Use Cases</a><a href="#plans">Plans &amp; Pricing</a></div>
        <div><b>Access</b><Link href="/customer">Customer Verify</Link><Link href="/admin">Seller Login</Link></div>
        <div><b>Legal &amp; Policies</b><Link href="/privacy-policy">Privacy Policy</Link><Link href="/terms">Terms &amp; Conditions</Link><Link href="/refund-policy">Refund &amp; Cancellation</Link><Link href="/data-retention">Data &amp; Video Retention</Link></div>
        <small className="copyright">© 2026 My Parcel Delivery. All rights reserved. MPD is an independent VMS, not a marketplace or courier.</small>
      </footer>

      {buyerModalPlan && (
        <div className="buyer-lead-modal" role="dialog" aria-modal="true" aria-labelledby="buyer-lead-title">
          <div className="buyer-lead-card">
            <button type="button" className="buyer-lead-close" onClick={closeBuyerForm} aria-label="Close buyer details form">×</button>
            {buyerSuccess ? (
              <div className="buyer-lead-success">
                <span className="success-check">✓</span>
                <span className="form-kicker">DETAILS SAVED</span>
                <h2 id="buyer-lead-title">Thank you! Aapki request mil gayi.</h2>
                <p>Selected plan: <strong>{buyerModalPlan.name}</strong>. Hamari team aapse direct connect karke Razorpay payment link aur onboarding details share karegi.</p>
                <div className="lead-receipt">
                  <span>Lead ID <b>{buyerSuccess.leadCode}</b></span>
                  <span>Submitted <b>{new Date(buyerSuccess.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</b></span>
                  <span>Status <b>Day 1 Purchase</b></span>
                </div>
                <button type="button" className="buyer-submit" onClick={closeBuyerForm}>Done</button>
              </div>
            ) : (
              <form onSubmit={submitBuyerLead}>
                <span className="form-kicker">NEW BUYER DETAILS</span>
                <h2 id="buyer-lead-title">Onboarding ke liye apni details dein</h2>
                <p className="buyer-lead-intro">Payment abhi nahi hoga. Details submit hone ke baad hamari team aapse connect karke Razorpay payment link share karegi.</p>
                <div className="selected-lead-plan">
                  <span>YOU CLICKED BUY NOW ON</span>
                  <strong>{buyerModalPlan.name} Plan</strong>
                  <small>{buyerModalPlan.orders} · {retention}-day video backup</small>
                </div>
                <div className="buyer-lead-fields">
                  <label>Full Name<input required autoComplete="name" value={buyerForm.contactName} onChange={(event) => setBuyerForm({ ...buyerForm, contactName: event.target.value })} placeholder="Your full name" /></label>
                  <label>Business / Shop Name<input required autoComplete="organization" value={buyerForm.businessName} onChange={(event) => setBuyerForm({ ...buyerForm, businessName: event.target.value })} placeholder="Example: Siya Fashion" /></label>
                  <label>Mobile Number<input required inputMode="numeric" autoComplete="tel" value={buyerForm.mobile} onChange={(event) => setBuyerForm({ ...buyerForm, mobile: event.target.value.replace(/\D/g, "").slice(0, 10) })} placeholder="10-digit mobile" /></label>
                  <label>WhatsApp Number<input required inputMode="numeric" autoComplete="tel" value={buyerForm.whatsapp} onChange={(event) => setBuyerForm({ ...buyerForm, whatsapp: event.target.value.replace(/\D/g, "").slice(0, 10) })} placeholder="10-digit WhatsApp" /></label>
                  <label>Email (Optional)<input type="email" autoComplete="email" value={buyerForm.email} onChange={(event) => setBuyerForm({ ...buyerForm, email: event.target.value })} placeholder="name@business.com" /></label>
                  <label>Main Marketplace<select value={buyerForm.marketplace} onChange={(event) => setBuyerForm({ ...buyerForm, marketplace: event.target.value })}><option>Meesho</option><option>Amazon</option><option>Flipkart</option><option>Myntra</option><option>Own Website</option><option>Multiple Marketplaces</option><option>Other</option></select></label>
                  <label>City<input required autoComplete="address-level2" value={buyerForm.city} onChange={(event) => setBuyerForm({ ...buyerForm, city: event.target.value })} placeholder="City" /></label>
                  <label>State<input required autoComplete="address-level1" value={buyerForm.state} onChange={(event) => setBuyerForm({ ...buyerForm, state: event.target.value })} placeholder="State" /></label>
                  <label>Approx. Orders / Month<input required type="number" min="1" max="1000000" value={buyerForm.monthlyOrders} onChange={(event) => setBuyerForm({ ...buyerForm, monthlyOrders: event.target.value })} /></label>
                  <label>Best Time to Call<select value={buyerForm.preferredContactTime} onChange={(event) => setBuyerForm({ ...buyerForm, preferredContactTime: event.target.value })}><option>Any time</option><option>10 AM – 1 PM</option><option>1 PM – 4 PM</option><option>4 PM – 7 PM</option><option>7 PM – 9 PM</option></select></label>
                  <label className="buyer-field-wide">Requirement / Note (Optional)<textarea value={buyerForm.note} onChange={(event) => setBuyerForm({ ...buyerForm, note: event.target.value })} placeholder="Team size, special requirement ya koi question…" /></label>
                  <label className="buyer-honeypot" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={buyerForm.website} onChange={(event) => setBuyerForm({ ...buyerForm, website: event.target.value })} /></label>
                </div>
                {buyerError && <div className="buyer-lead-error" role="alert">{buyerError}</div>}
                <button className="buyer-submit" disabled={buyerSubmitting}>{buyerSubmitting ? "Details save ho rahi hain…" : `Submit ${buyerModalPlan.name} Plan Request`} <span>→</span></button>
                <small className="buyer-consent">Submit karke aap My Parcel Delivery team ko onboarding follow-up ke liye call/WhatsApp karne ki permission dete hain.</small>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
