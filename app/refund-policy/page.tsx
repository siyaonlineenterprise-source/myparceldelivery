import LegalPage from "../components/LegalPage";

export default function RefundPolicyPage() {
  return <LegalPage
    eyebrow="BILLING CLARITY"
    title="Refund & Cancellation Policy"
    intro="Plan activation, setup work, credits, renewal aur duplicate payment ke clear refund rules."
    sections={[
      { title: "1. Before activation", body: <p>Paid plan activate ya onboarding/custom setup start hone se pehle cancellation request payment ke 48 hours ke andar ki ja sakti hai. Approved refund original payment method par payment-gateway deductions ke baad process hoga.</p> },
      { title: "2. After activation or usage", body: <p>Credits allocate hone, account activate hone, custom work start hone, ya video upload/storage use hone ke baad fee ordinarily non-refundable hai. Verified MPD failure se purchased service materially deliver na ho aur reasonable fix available na ho, to unused portion ka credit, extension or proportionate refund case-by-case diya ja sakta hai.</p> },
      { title: "3. Duplicate or failed payment", body: <p>Duplicate debit ya successful payment ke baad activation failure report karne par transaction verify hoga. Duplicate confirmed hone par extra amount refund hoga. Bank/payment gateway processing normally 5–10 business days le sakti hai.</p> },
      { title: "4. Renewal cancellation", body: <p>Future renewal cancel karne se current paid period immediately terminate nahi hota. Current period end tak access retention policy and remaining credits ke subject to available rahega.</p> },
      { title: "5. Non-refundable items", body: <ul><li>Completed onboarding, migration, custom development or integration work.</li><li>Consumed credits, used storage and taxes already remitted.</li><li>Third-party gateway, marketplace, messaging or cloud charges.</li><li>Policy breach or seller-controlled credentials/integration failure ke कारण suspension.</li></ul> },
      { title: "6. Refund request", body: <p>Registered support channel par business name, Vendor Code, payment date, amount and transaction reference submit karein. Refund tabhi valid hoga jab Master Admin request verify aur approve kare.</p> },
    ]}
  />;
}
