import Link from "next/link";
import type { ReactNode } from "react";
import BrandLogo from "./BrandLogo";

export type LegalSection = { title: string; body: ReactNode };

export default function LegalPage({
  eyebrow,
  title,
  intro,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <main className="legal-page">
      <header className="legal-header">
        <Link className="brand marketing-brand" href="/">
          <BrandLogo />
          <span><strong>My Parcel Delivery</strong><small>VIDEO MANAGEMENT SYSTEM</small></span>
        </Link>
        <nav><Link href="/">Home</Link><Link href="/customer">Customer Verify</Link><Link href="/admin">Seller Login</Link></nav>
      </header>
      <section className="legal-hero">
        <span>{eyebrow}</span><h1>{title}</h1><p>{intro}</p><small>Last updated: 28 July 2026</small>
      </section>
      <div className="legal-layout">
        <aside>
          <b>Policies</b>
          <Link href="/privacy-policy">Privacy Policy</Link>
          <Link href="/terms">Terms &amp; Conditions</Link>
          <Link href="/refund-policy">Refund &amp; Cancellation</Link>
          <Link href="/data-retention">Data &amp; Video Retention</Link>
        </aside>
        <article className="legal-content">
          {sections.map((section) => <section key={section.title}><h2>{section.title}</h2><div>{section.body}</div></section>)}
          <div className="legal-notice"><b>Support or grievance</b><p>Registered sellers apne onboarding/support channel se business name, Vendor Code aur issue details ke saath request submit karein. Password, PIN, OTP ya secret key kabhi share na karein.</p></div>
        </article>
      </div>
      <footer className="legal-footer"><span>© 2026 My Parcel Delivery.</span><div><Link href="/privacy-policy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/refund-policy">Refunds</Link></div></footer>
    </main>
  );
}
