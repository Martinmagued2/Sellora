"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ShieldCheck, CheckCircle2 } from "lucide-react";
import "../components/landing/landing.css";

export default function Page() {
  return (
    <div style={{ background: "#08080a", color: "#fff", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <header style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(8,8,10,0.8)", backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div className="landing-container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "72px" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: "18px" }}>
            <Image src="/logo.png" alt="Sellora" width={32} height={32} style={{ width: 32, height: 32, borderRadius: 8 }} />
            <span>Sellora</span>
          </Link>
          <Link href="/" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
            <ArrowLeft size={16} /> Back to Home
          </Link>
        </div>
      </header>

      <main className="landing-container" style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: "860px", margin: "0 auto" }}>
          <span className="designer-badge" style={{ marginBottom: "16px" }}>
            <span className="dot" /> MERCHANT OPERATING SYSTEM LICENSE
          </span>
          <h1 style={{ fontSize: "38px", fontWeight: 900, margin: "0 0 24px", color: "#fff" }}>
            Terms & Conditions of Service
          </h1>
          <div className="designer-card" style={{ padding: "44px", fontSize: "15px", color: "#cbd5e1", lineHeight: 1.8, whiteSpace: "pre-line", display: "flex", flexDirection: "column", gap: "20px" }}>
            {"Welcome to Sellora (\"The Operating System for Social Commerce\"). These Terms and Conditions constitute a legally binding agreement between your business (\"Merchant\", \"Store Owner\", or \"You\") and Sellora governing your access to and use of our web application, automated workflows, AI copilot, and cloud integrations.\n\n### 1. Acceptance of Terms & Operating System License\nBy creating a Sellora account, connecting your sales channels (Instagram DMs, Facebook Messenger, WhatsApp, Telegram, Email), or utilizing our automated order processing, you explicitly agree to these Terms. Sellora grants you a revocable, non-exclusive, non-transferable, limited enterprise license to use our platform to operate and automate your social e-commerce store.\n\n### 2. Merchant Account Registration & 2FA Security\nTo access Sellora Mission Control, you must register with valid business credentials. You agree to:\n- Provide accurate store information, official email addresses, and verified contact numbers.\n- Maintain the confidentiality of your login passwords and enable server-side Two-Factor Authentication (2FA).\n- Assume full responsibility for all activities, order confirmations, and customer communications executed under your account or by your assigned team members.\n\n### 3. Multi-Channel Social Commerce Rules (IG, Messenger, WhatsApp)\nSellora empowers you to centralize customer conversations across Instagram, Facebook Messenger, WhatsApp, Telegram, and Email. You agree to adhere strictly to the respective terms of service of each underlying platform:\n- **Meta Commerce & Messaging Policies:** You agree not to use Sellora for spamming, sending unsolicited promotional broadcasts without opt-in consent, or selling prohibited goods.\n- **Channel Responsibilities:** While Sellora provides sub-second automated replying and intent recognition, you remain solely responsible for the legality, pricing accuracy, and fulfillment of products advertised through your social channels.\n\n### 4. E-Commerce Platform & Payment Gateway Routing\nSellora acts as an intelligent routing bridge connecting your social inbox to your storefront catalog and banking gateways:\n- **Shopify Synchronization:** You authorize Sellora to read product catalogs, lock inventory counts, and create confirmed orders within your connected Shopify store.\n- **Payment Processing (Paymob, InstaPay, Fawry, Vodafone Cash):** Sellora generates secure checkout links and listens for payment verification webhooks. Sellora is not a bank or money transmitter; all financial settlements occur directly between your merchant bank account and your payment processor (Paymob/InstaPay). We are not liable for bank gateway outages or third-party processing delays.\n\n### 5. Artificial Intelligence & Autonomous Workflows\nSellora features an autonomous reasoning engine and AI Copilot engineered to assist your store 24/7:\n- **Autonomous Operations:** When active, Sellora AI answers customer inquiries in native dialect, calculates shipping zones, and generates invoices while you are offline.\n- **Merchant Supervision:** You acknowledge that while our NLP engine achieves 96%+ accuracy, you are responsible for establishing correct store policies, shipping fees, and inventory safety stock limits within your workspace settings.\n\n### 6. Subscriptions, Billing, Free Trial & Cancellation\nSellora is offered under transparent SaaS subscription tiers:\n- **14-Day Free Trial:** Every new store receives a full-featured 14-day free trial with zero credit card required. At the end of the trial, you may choose to upgrade to Starter, Professional, or Business.\n- **Billing Cycles:** Subscriptions are billed monthly or annually (with a 20% annual discount) via Paymob, Fawry, InstaPay, or Stripe.\n- **Instant Cancellation & Proration:** You may cancel your subscription or downgrade your tier at any time with a single click from your billing settings. There are zero cancellation penalties or lock-in contracts. Prorated credits are automatically applied upon tier changes.\n\n### 7. Service Level Agreement (SLA) & Uptime Guarantee\nWe recognize that your online store never sleeps. We commit to:\n- **99.99% Operational Target:** Maintaining continuous cloud availability across our routing infrastructure, database webhooks, and dashboard interface.\n- **Sub-Second Latency:** Ensuring that automated dialect replies and inventory reservations execute in under 1 second under normal network conditions.\n\n### 8. Intellectual Property & Brand Guidelines\n- **Sellora IP:** All software architecture, Next.js code, UI designs, AI prompt chains, trademarks, and the Sellora logo (`/public/logo.png`) remain the exclusive intellectual property of Sellora.\n- **Merchant IP:** You retain 100% ownership of your brand name, product photos, customer lists, and proprietary catalog data. You grant Sellora a limited license to host and process this data solely for providing our service to you.\n\n### 9. Limitation of Liability & Indemnification\nTo the maximum extent permitted by applicable law, Sellora and its founding engineers shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, lost sales due to third-party social network outages (e.g., Meta Instagram or WhatsApp API downtime), or courier delivery failures (e.g., Bosta or Mylerz transit delays). Our total liability shall not exceed the subscription fees paid by you to Sellora in the three (3) months preceding the event.\n\n### 10. Governing Law & Dispute Resolution\nThese Terms and Conditions shall be governed by, construed, and enforced in accordance with the laws of the Arab Republic of Egypt, without regard to conflict of law principles. Any dispute arising from or relating to the use of Sellora shall be subject to the exclusive jurisdiction of the competent courts located in Cairo, Egypt.\n\n### 11. Modifications to Terms\nWe Reserve the right to update or modify these Terms as our operating system expands. We will notify all active store owners via email and dashboard notifications at least 14 days prior to any material policy changes. Continued use of Sellora constitutes acceptance of the revised Terms."}
          </div>
          <div style={{ marginTop: "40px", textAlign: "center", display: "flex", justifyContent: "center", gap: "16px", flexWrap: "wrap" }}>
            <Link href="/signup" className="btn-designer-primary" style={{ textDecoration: "none" }}>
              Start 14-Day Free Trial →
            </Link>
            <Link href="/" className="btn-designer-secondary" style={{ textDecoration: "none" }}>
              Return to Homepage
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
