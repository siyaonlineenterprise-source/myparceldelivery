import LegalPage from "../components/LegalPage";

export default function PrivacyPolicyPage() {
  return <LegalPage
    eyebrow="PRIVACY & DATA PROTECTION"
    title="Privacy Policy"
    intro="My Parcel Delivery seller, parcel, customer-verification aur video-proof data ko kaise collect, use, protect aur delete karta hai."
    sections={[
      { title: "1. Data we process", body: <><p>MPD business/contact details, login and session information, Tracking ID, Bag ID, parcel metadata, marketplace/courier reference, packing and return videos, claims, follow-ups, customer verification details, device/browser information and support records process kar sakta hai.</p><p>Payment-card details MPD par store nahi kiye jaate; payment provider ki own policy apply hogi.</p></> },
      { title: "2. Why we use data", body: <ul><li>Parcel ko correct packing/return proof se link karne ke liye.</li><li>Customer QR verification, claims, reports aur support dene ke liye.</li><li>Unauthorized access, fraud, misuse aur technical errors detect karne ke liye.</li><li>Billing, storage limits aur applicable legal obligations manage karne ke liye.</li></ul> },
      { title: "3. Seller responsibility", body: <p>Seller lawful data collection, staff/customer notice aur consent ke liye responsible hai where required. Packing area mein unnecessary faces, private conversations, identity documents, payment details ya unrelated personal information record nahi ki jaani chahiye.</p> },
      { title: "4. Access and sharing", body: <p>Seller ko sirf apne account ka operational data dikhaya jata hai. Authorized Master Admin support aur consolidated reporting ke liye access kar sakta hai. Hosting/storage/security providers ko minimum necessary data mil sakta hai. MPD personal data sell nahi karta.</p> },
      { title: "5. Security and retention", body: <p>Role-based access, secure sessions, restricted video access aur cloud controls use kiye jaate hain, lekin koi online system 100% risk-free nahi hota. Retention plan, dispute/legal hold aur operational need par depend karti hai. Details <a href="/data-retention">Data &amp; Video Retention Policy</a> mein hain.</p> },
      { title: "6. Access, correction and deletion", body: <p>Applicable law ke subject to, verified user access, correction, deletion or grievance request kar sakta hai. Fraud prevention, billing, active claim, legal hold ya statutory requirement ke records turant delete nahi kiye ja sakte.</p> },
      { title: "7. Children and updates", body: <p>MPD seller operations ke liye hai aur knowingly children se data collect karne ke liye designed nahi hai. Material changes revised date ke saath website par publish honge.</p> },
    ]}
  />;
}
