import LegalPage from "../components/LegalPage";

export default function DataRetentionPage() {
  return <LegalPage
    eyebrow="STORAGE & DELETION"
    title="Data & Video Retention Policy"
    intro="Packing proof kitne din available rahega, expiry ke baad kya hoga, aur claim/legal hold par deletion kab ruk sakti hai."
    sections={[
      { title: "1. Retention by plan", body: <p>Packing and return/RTO videos selected plan ke according normally 30, 60 or 90 days accessible rehti hain, upload date se counted unless written order says otherwise.</p> },
      { title: "2. Expiry and deletion", body: <p>Retention expire hone par video access disable ho sakta hai aur file active storage se delete/overwrite ki ja sakti hai. Expired video recovery guaranteed nahi hai. Technical backup limited additional period tak routine cycle mein exist kar sakta hai.</p> },
      { title: "3. Operational records", body: <p>Tracking metadata, billing, claims, follow-ups, customer verification logs and security records video se longer retain ho sakte hain where needed for service, fraud prevention, accounting, audit or dispute.</p> },
      { title: "4. Claims and legal hold", body: <p>Open claim, payment dispute, complaint, investigation or authority/court request mein relevant data normal expiry ke baad bhi issue close hone aur required preservation period tak retain ho sakta hai.</p> },
      { title: "5. Account closure", body: <p>Seller ko closure se pehle required proof download/export karna chahiye. Verified closure request ke baad active access remove hoga; legally or operationally required records limited access mein retain ho sakte hain.</p> },
      { title: "6. Seller responsibility", body: <p>MPD sole archival or legal-record system nahi hai. Marketplace claim deadline, accounting, warranty or litigation need ke liye seller ko required copies timely preserve karni hongi.</p> },
    ]}
  />;
}
