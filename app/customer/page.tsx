"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import BrandLogo from "../components/BrandLogo";

type Step = "lookup" | "pin" | "verified";
type ParcelRecord = {
  trackingId: string;
  bagId: string;
  deliveryPartner?: string;
  videoUrl?: string;
};
type PublicStats = { customerViews: number };

function getVideoPlayerUrls(videoUrl: string) {
  try {
    const url = new URL(videoUrl);
    const host = url.hostname.replace(/^www\./, "");
    let youtubeId = "";

    if (host === "youtu.be") youtubeId = url.pathname.split("/").filter(Boolean)[0] || "";
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      youtubeId = url.searchParams.get("v")
        || url.pathname.match(/^\/(?:embed|shorts)\/([^/?]+)/)?.[1]
        || "";
    }

    if (/^[A-Za-z0-9_-]{6,}$/.test(youtubeId)) {
      return {
        embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&playsinline=1`,
        watchUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
        isYouTube: true,
      };
    }
  } catch {
    // Non-URL values fall back to the original source below.
  }

  return { embedUrl: videoUrl, watchUrl: videoUrl, isYouTube: false };
}

export default function CustomerTracking() {
  const [step, setStep] = useState<Step>("lookup");
  const [parcelId, setParcelId] = useState("");
  const [pincode, setPincode] = useState("");
  const [message, setMessage] = useState("");
  const [parcel, setParcel] = useState<ParcelRecord | null>(null);
  const [searching, setSearching] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMessage, setScannerMessage] = useState("");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [publicStats, setPublicStats] = useState<PublicStats>({ customerViews: 0 });
  const [refreshingParcel, setRefreshingParcel] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const scanLockedRef = useRef(false);
  const torchTrackRef = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get("trackingId") || params.get("parcelId") || params.get("id");
    if (sharedId) {
      window.setTimeout(() => setParcelId(sharedId.trim().toUpperCase()), 0);
    }
  }, []);

  function createTrackingCodeReader() {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.ITF,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.DATA_MATRIX,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    return new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 80 });
  }

  async function findParcel(scannedId?: string) {
    const idToFind = scannedId ?? parcelId;
    if (!idToFind.trim()) return setMessage("Tracking ID ya Bag ID enter kijiye");
    const normalizedId = idToFind.trim().toUpperCase();
    setParcelId(normalizedId);
    setSearching(true);
    setMessage("Parcel record check ho raha hai…");
    try {
      const response = await fetch(`/api/customer-track?parcelId=${encodeURIComponent(normalizedId)}&refresh=${Date.now()}`, { cache: "no-store" });
      const data = await response.json() as { parcel?: ParcelRecord; error?: string };
      if (!response.ok || !data.parcel) {
        setParcel(null);
        return setMessage(data.error || "Tracking ID ya Bag ID record mein nahi mila");
      }
      setParcel(data.parcel);
      setMessage("");
      setStep("pin");
    } catch {
      setParcel(null);
      setMessage("Record check nahi ho paaya. Internet check karke dobara try kijiye.");
    } finally {
      setSearching(false);
    }
  }

  function closeScanner() {
    if (torchTrackRef.current && torchOn) {
      void torchTrackRef.current.applyConstraints({ advanced: [{ torch: false } as MediaTrackConstraintSet] });
    }
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    torchTrackRef.current = null;
    scanLockedRef.current = false;
    setTorchSupported(false);
    setTorchOn(false);
    setScannerOpen(false);
    setScannerMessage("");
  }

  async function changeTorch(turnOn: boolean, automatic = false) {
    const track = torchTrackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: turnOn } as MediaTrackConstraintSet] });
      setTorchOn(turnOn);
      setScannerMessage(turnOn
        ? (automatic ? "Andhera detect hua — Flash Light automatic ON ho gayi" : "Flash Light ON hai")
        : "Flash Light OFF hai");
    } catch {
      setTorchSupported(false);
      setScannerMessage("Is phone mein browser se Flash Light control support nahi hota.");
    }
  }

  function getTrackingIdFromQr(rawValue: string) {
    const cleanValue = rawValue.trim();
    // Meesho labels use a 16-digit tracking ID. Some scanners return the same
    // decoded value more than once in a single payload, so take only the first
    // complete ID instead of putting the repeated string in the input.
    const meeshoTrackingId = cleanValue.match(/(?:^|\D)(\d{16})(?=\D|$|\d)/);
    if (meeshoTrackingId?.[1]) return meeshoTrackingId[1];
    try {
      const qrUrl = new URL(cleanValue);
      const fromQuery = qrUrl.searchParams.get("trackingId")
        || qrUrl.searchParams.get("parcelId")
        || qrUrl.searchParams.get("id");
      if (fromQuery) {
        const queryMeeshoId = fromQuery.match(/\d{16}/)?.[0];
        return queryMeeshoId || fromQuery.trim();
      }
      const lastPath = qrUrl.pathname.split("/").filter(Boolean).pop();
      if (lastPath && /^[A-Za-z0-9_-]{5,}$/.test(lastPath)) return lastPath;
    } catch {
      // Plain tracking-ID QR codes are handled below.
    }
    const labelledId = cleanValue.match(/(?:tracking|parcel|bag)(?:\s*id)?\s*[:=-]\s*([A-Za-z0-9_-]{5,})/i);
    return labelledId?.[1] || cleanValue;
  }

  async function openScanner() {
    if (!navigator.mediaDevices?.getUserMedia) {
      return setMessage("Is phone/browser mein camera scan available nahi hai. ID manually enter kijiye.");
    }
    scanLockedRef.current = false;
    setScannerOpen(true);
    setScannerMessage("Camera start ho raha hai…");
  }

  useEffect(() => {
    if (!scannerOpen || !videoRef.current) return;
    let cancelled = false;
    const reader = createTrackingCodeReader();
    void reader.decodeFromConstraints(
      { video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
      videoRef.current,
      (result) => {
        if (!result || cancelled || scanLockedRef.current) return;
        scanLockedRef.current = true;
        const scannedId = getTrackingIdFromQr(result.getText());
        if (!scannedId) {
          scanLockedRef.current = false;
          setScannerMessage("Valid Tracking ID nahi mili. QR ko box ke beech mein rakho.");
          return;
        }
        closeScanner();
        setMessage("QR scan ho gaya. Parcel record check ho raha hai…");
        void findParcel(scannedId);
      },
    ).then((controls) => {
      if (cancelled) controls.stop();
      else {
        scannerControlsRef.current = controls;
        const stream = videoRef.current?.srcObject as MediaStream | null;
        streamRef.current = stream;
        const track = stream?.getVideoTracks()[0] || null;
        torchTrackRef.current = track;
        const capabilities = track?.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
        const supportsTorch = capabilities?.torch === true;
        setTorchSupported(supportsTorch);
        setScannerMessage(supportsTorch
          ? "Barcode/QR ko line ke beech rakho — andhera hua to Flash Light automatic ON hogi"
          : "Barcode/QR ko seedha rakho aur camera se 10–20 cm door rakho");
      }
    }).catch(() => {
      closeScanner();
      setMessage("Camera permission Allow kijiye, phir QR Scan dobara dabaiye.");
    });
    return () => {
      cancelled = true;
      scannerControlsRef.current?.stop();
      scannerControlsRef.current = null;
    };
  }, [scannerOpen]);

  useEffect(() => {
    if (!scannerOpen || !torchSupported || torchOn || !videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    let darkChecks = 0;
    const timer = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      context.drawImage(video, 0, 0, 32, 32);
      const pixels = context.getImageData(0, 0, 32, 32).data;
      let brightness = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        brightness += (pixels[index] * 0.299) + (pixels[index + 1] * 0.587) + (pixels[index + 2] * 0.114);
      }
      const average = brightness / (pixels.length / 4);
      darkChecks = average < 48 ? darkChecks + 1 : 0;
      if (darkChecks >= 2) {
        window.clearInterval(timer);
        void changeTorch(true, true);
      }
    }, 900);
    return () => window.clearInterval(timer);
  }, [scannerOpen, torchSupported, torchOn]);

  async function scanQrImage(file?: File) {
    if (!file) return;
    setScannerMessage("QR image check ho rahi hai…");
    const objectUrl = URL.createObjectURL(file);
    try {
      const result = await createTrackingCodeReader().decodeFromImageUrl(objectUrl);
      const scannedId = getTrackingIdFromQr(result.getText());
      closeScanner();
      setMessage("QR image scan ho gayi. Parcel record check ho raha hai…");
      await findParcel(scannedId);
    } catch {
      setScannerMessage("Is image mein barcode/QR clear nahi mila. Saaf aur paas se photo try karo.");
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);
  useEffect(() => {
    fetch("/api/public-stats", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data: PublicStats | null) => data && setPublicStats(data))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (step !== "verified" || parcel?.videoUrl || !parcelId || !pincode) return;
    let cancelled = false;
    const refreshVideo = async () => {
      try {
        const response = await fetch("/api/customer-track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ parcelId: parcelId.trim().toUpperCase(), pincode }),
        });
        const data = await response.json() as { parcel?: ParcelRecord };
        if (!cancelled && response.ok && data.parcel?.videoUrl) setParcel(data.parcel);
      } catch {
        // Keep the verified screen open and retry while the upload is finishing.
      }
    };
    const timer = window.setInterval(() => void refreshVideo(), 2000);
    void refreshVideo();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [step, parcel?.videoUrl, parcelId, pincode]);

  async function verifyPin() {
    if (!/^\d{6}$/.test(pincode)) return setMessage("Sahi 6-digit PIN code enter kijiye");
    if (!parcel) return setMessage("Parcel record dobara check kijiye");
    try {
      setMessage("PIN verify ho raha hai…");
      const response = await fetch("/api/customer-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parcelId: parcelId.trim().toUpperCase(),
          pincode,
        }),
      });
      const data = await response.json() as { parcel?: ParcelRecord; error?: string };
      if (!response.ok || !data.parcel) {
        return setMessage(data.error || "PIN verify nahi hua. Video locked hai.");
      }
      setParcel(data.parcel);
      setMessage("");
      setStep("verified");
    } catch {
      setMessage("PIN verify nahi ho paaya. Internet check karke dobara try kijiye.");
    }
  }

  async function refreshVerifiedParcel() {
    if (!parcelId || !pincode || refreshingParcel) return;
    setRefreshingParcel(true);
    setMessage("Latest parcel status refresh ho raha hai…");
    try {
      const response = await fetch(`/api/customer-track?refresh=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ parcelId: parcelId.trim().toUpperCase(), pincode }),
      });
      const data = await response.json() as { parcel?: ParcelRecord; error?: string };
      if (!response.ok || !data.parcel) return setMessage(data.error || "Parcel refresh nahi hua");
      setParcel(data.parcel);
      setMessage(`✓ Latest status refresh ho gaya · ${new Date().toLocaleTimeString("en-IN")}`);
    } catch {
      setMessage("Parcel refresh nahi hua. Internet check karke dobara try kijiye.");
    } finally {
      setRefreshingParcel(false);
    }
  }

  return (
    <main className="customer-page">
      <header className="public-header">
        <Link className="brand" href="/">
          <BrandLogo />
          <div><strong>My Parcel Delivery</strong><small>PARCEL PROOF &amp; TRACKING</small></div>
        </Link>
          <span className="secure-chip">● Secure Verification</span>
      </header>

      <section className="track-hero">
        <div className="hero-copy">
          <span className="eyebrow">PACKING KA PROOF, DELIVERY KA TRUST</span>
          <h1>Apne parcel ki<br /><em>packing khud dekho.</em></h1>
          <p>Tracking ID scan karo, shipping label par likha pincode verify karo aur apni original packing video dekho.</p>
          <div className="trust-row"><span>✓ Label Pincode Verification</span><span>✓ Original Packing Video</span></div>
          <div className="customer-trust-count"><strong>{publicStats.customerViews.toLocaleString("en-IN")}+</strong><span>customers ne ab tak verified packing proof dekha</span></div>
        </div>

        <div className="verify-card">
          <div className="step-track">
            {["Tracking ID", "Label PIN", "Video"].map((label, index) => {
              const active = ["lookup", "pin", "verified"].indexOf(step) >= index;
              return <span key={label} className={active ? "active" : ""}><i>{index + 1}</i>{label}</span>;
            })}
          </div>

          {step === "lookup" && <>
            <span className="form-kicker">APNA PARCEL DHUNDO</span>
            <h2>Tracking ID ya Bag ID</h2>
            <p>Dono mein se koi bhi ek ID enter karo.</p>
            <label>Parcel ID<input value={parcelId} onChange={(e) => setParcelId(e.target.value)} placeholder="Jaise: MPD123456" onKeyDown={(e) => e.key === "Enter" && void findParcel()} /></label>
            <button className="qr-button" onClick={() => void openScanner()}><span aria-hidden="true">▦</span> Barcode / QR Scan Karke ID Bharo</button>
            <div className="or-divider"><span>YA</span></div>
            <button className="primary" disabled={searching} onClick={() => void findParcel()}>{searching ? "Record Check Ho Raha Hai…" : "Mera Parcel Dhundo"} <span>→</span></button>
          </>}

          {step === "pin" && <>
            <span className="form-kicker">SHIPPING LABEL VERIFICATION</span>
            <h2>Label ka pincode dalo</h2>
            <p>Aapke parcel ke shipping label par jo 6-digit pincode likha hai, wahi enter karo.</p>
            <label>Shipping Label Pincode<input value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="Label par likha 6-digit pincode" onKeyDown={(e) => e.key === "Enter" && void verifyPin()} /></label>
            <button className="primary" onClick={() => void verifyPin()}>Pincode Verify Karo <span>→</span></button>
          </>}

          {step === "verified" && <>
            <div className="verified-mark">✓</div>
            <span className="form-kicker">VERIFICATION SUCCESSFUL</span>
            <h2>Parcel verify ho gaya</h2>
            <div className="parcel-summary"><span>Delivery Partner</span><strong>{parcel?.deliveryPartner}</strong></div>
            <button className="customer-refresh-button" disabled={refreshingParcel} onClick={() => void refreshVerifiedParcel()}>{refreshingParcel ? "↻ Refreshing…" : "↻ Latest Status Refresh Karo"}</button>
            {parcel?.videoUrl ? (() => {
              const player = getVideoPlayerUrls(parcel.videoUrl);
              return <div className="packing-video-wrap">
                {player.isYouTube ? <iframe
                    className="packing-video"
                    src={player.embedUrl}
                    title="Parcel packing video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  /> : <video className="packing-video" src={player.embedUrl} controls playsInline preload="metadata" />}
                {player.isYouTube && <a className="youtube-fallback" href={player.watchUrl} target="_blank" rel="noopener noreferrer">
                  Video nahi chale to YouTube par dekho ↗
                </a>}
              </div>;
            })() : (
              <div className="video-placeholder"><span>▶</span><b>Aapki Packing Video</b><small>Upload chal rahi hai—video complete hote hi yahin automatically aa jayegi</small></div>
            )}
          </>}

          {message && <div className="form-message">{message}</div>}
          {step !== "lookup" && step !== "verified" && <button className="text-button" onClick={() => { setStep("lookup"); setParcel(null); setPincode(""); setMessage(""); }}>← Parcel ID Badlo</button>}
        </div>
      </section>
      {scannerOpen && (
        <div className="qr-modal" role="dialog" aria-modal="true" aria-label="Tracking barcode aur QR scanner">
          <div className="qr-scanner-card">
            <button className="qr-close" onClick={closeScanner} aria-label="Scanner band karein">×</button>
            <span className="form-kicker">CUSTOMER CODE SCAN</span>
            <h2>Meesho Barcode / QR Scan Karo</h2>
            <p>Label ka 16-digit barcode ya QR blue line ke beech rakho. Tracking ID automatically fill ho jayegi.</p>
            <div className="qr-camera">
              <video ref={videoRef} playsInline muted />
              <i /><i /><i /><i />
              <div className="scan-line" />
            </div>
            <div className="scanner-message">{scannerMessage}</div>
            {torchSupported && (
              <button className={`torch-button${torchOn ? " on" : ""}`} onClick={() => void changeTorch(!torchOn)}>
                <span aria-hidden="true">{torchOn ? "🔦" : "💡"}</span>
                Flash Light {torchOn ? "OFF Karo" : "ON Karo"}
              </button>
            )}
            <label className="qr-gallery-button">
              Gallery Se Label Photo Chuno
              <input type="file" accept="image/*" capture="environment" onChange={(event) => void scanQrImage(event.target.files?.[0])} />
            </label>
            <button className="text-button" onClick={closeScanner}>Camera Band Karo</button>
          </div>
        </div>
      )}
      <footer className="public-footer"><span>© 2026 My Parcel Delivery</span><span>Aapka data sirf verification ke liye use hota hai.</span></footer>
    </main>
  );
}
