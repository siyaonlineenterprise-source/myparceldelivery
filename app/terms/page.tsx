import LegalPage from "../components/LegalPage";

export default function TermsPage() {
  return <LegalPage
    eyebrow="SERVICE AGREEMENT"
    title="Terms & Conditions"
    intro="MPD use karne, seller account operate karne, video upload karne aur proof/claim workflow use karne ke rules."
    sections={[
      { title: "1. Service scope", body: <p>MPD ek Video Management System hai jo Tracking ID/Bag ID ko packing, return/RTO, claim aur follow-up records se link karta hai. MPD marketplace, courier, insurer, payment processor ya claims authority nahi hai.</p> },
      { title: "2. Evidence limitation", body: <p>Video proof claim support kar sakta hai, lekin kisi marketplace, courier ya third party se claim approval, payment recovery ya legal outcome ki guarantee nahi hai. Final decision third party ke rules aur evidence review par depend karega.</p> },
      { title: "3. Account and acceptable use", body: <ul><li>Seller correct information dega, PIN/password confidential rakhega aur authorized staff ko hi access dega.</li><li>Illegal, misleading, fabricated, abusive, intimate, malware or unrelated content upload nahi kiya ja sakta.</li><li>Marketplace ka original AWB/label/ID MPD alter nahi karega; original file as received hi print/use hogi.</li><li>Customer and tracking data sirf lawful parcel operations ke liye use hoga.</li></ul> },
      { title: "4. Plans, credits and storage", body: <p>Final price volume, credits, selected retention, taxes, integrations aur onboarding scope par depend kar sakti hai. Plan expiry, non-payment ya storage limit cross hone par upload/access pause ho sakta hai.</p> },
      { title: "5. Marketplace integrations", body: <p>API connection third-party approval, credentials, rate limits and policies par depend karta hai. Seller secure authorized flow ke bahar password/OTP share nahi karega. Third-party outage or policy change MPD ke control se bahar ho sakta hai.</p> },
      { title: "6. Suspension and liability", body: <p>Security risk, misuse, illegal content, non-payment or policy breach par access suspend kiya ja sakta hai. MPD reasonable care se service deta hai, but indirect loss, marketplace claim rejection or third-party action ke liye liability applicable law ke maximum permitted extent tak limited rahegi. Mandatory consumer rights unaffected hain.</p> },
      { title: "7. Governing law", body: <p>Terms India ke applicable laws ke under governed hain. Parties pehle good-faith support/grievance resolution try karenge; mandatory statutory forum rights unaffected rahenge.</p> },
    ]}
  />;
}
