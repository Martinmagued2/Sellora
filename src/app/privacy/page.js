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
            <span className="dot" /> MENA & GLOBAL E-COMMERCE PRIVACY STANDARDS
          </span>
          <h1 style={{ fontSize: "38px", fontWeight: 900, margin: "0 0 24px", color: "#fff" }}>
            Privacy Policy & Data Protection
          </h1>
          <div className="designer-card" style={{ padding: "44px", fontSize: "15px", color: "#cbd5e1", lineHeight: 1.8, whiteSpace: "pre-line", display: "flex", flexDirection: "column", gap: "20px" }}>
            {"At Sellora (\"The Operating System for Social Commerce\"), safeguarding your store's operational data and your customers' personal information is our absolute highest priority. This Privacy Policy details how we collect, process, encrypt, and isolate information across our multi-channel platform.\n\n### 1. Introduction & Scope\nThis policy applies to all merchants, store owners, team members, and buyers interacting with Sellora across Egypt, the Middle East and North Africa (MENA), the European Union, and globally. By connecting your social sales channels (Instagram DMs, Facebook Messenger, WhatsApp, Telegram, or Email) and e-commerce storefronts (Shopify), you entrust us with critical business data. We honor that trust through total transparency and bank-grade architecture.\n\n### 2. Information We Collect\nWe collect only the precise data points required to run your social commerce operations autonomously:\n- **Merchant Account Data:** Store name, owner email, phone number, business registration details, and team member role assignments.\n- **Connected Channel Logs:** Incoming message text from Instagram DMs, Facebook Messenger, WhatsApp, Telegram, and Email for natural language intent recognition, dialect processing, and automated replying.\n- **E-Commerce Transaction Data:** Product catalogs, SKUs, inventory counts, order values, customer names, delivery addresses, and shipping statuses.\n- **Payment Verification Metadata:** Webhook transaction tokens from Paymob, InstaPay Egypt, Fawry digital invoicing, and mobile wallets (Vodafone Cash). **We never collect or store raw credit card numbers or bank account PINs.**\n\n### 3. How We Use Your Information\nYour data is utilized exclusively to power your autonomous store workflows:\n- Generating instant, dialect-accurate AI replies to customer inquiries across Instagram, Messenger, and WhatsApp.\n- Automatically reserving Shopify inventory when a customer requests a specific product size or color.\n- Issuing unique, encrypted payment checkouts via Paymob and verifying InstaPay/Fawry receipts without manual human review.\n- Dispatching shipment orders to courier partners (Bosta and Mylerz) and sending real-time tracking updates to buyers.\n- Generating aggregated, anonymized revenue and conversion analytics for your command center dashboard.\n\n### 4. Row-Level Security (RLS) & Strict Data Isolation\nA core architectural pillar of Sellora is absolute tenant isolation. We utilize Supabase Server-Side Row-Level Security (RLS) policies. Every database query, order record, customer profile, and chat thread is cryptographically tagged with your unique `store_id`. It is technically impossible for another merchant or unauthorized team member to view, access, or query your store's customer data or message history.\n\n### 5. Third-Party Integrations & Gateways\nTo provide an end-to-end operating system, Sellora securely transmits necessary operational payloads to verified cloud partners:\n- **Meta Cloud APIs (Instagram, Messenger, WhatsApp):** Message routing adheres to Meta's strict enterprise encryption and privacy protocols.\n- **Shopify Cloud:** Catalog sync and order creation via secure OAuth 2.0 token exchange.\n- **Paymob & Banking Gateways:** Signed webhook listeners verify transaction completion.\n- **Bosta & Mylerz Shipping Gateways:** Delivery address and recipient contact transmission for courier dispatch.\n\n### 6. Data Retention & Permanent Deletion\nYou maintain complete ownership and control over your data lifecycle:\n- Depending on your subscription plan (Starter, Professional, or Business), conversation history and transaction logs are retained for 30 days, 6 months, or indefinitely.\n- **Right to Erasure:** Under the Egyptian Data Protection Law (Law No. 151 of 2020) and European GDPR, you may request the immediate and permanent deletion of your merchant account, store catalog, and customer CRM. Upon cancellation and request, all data is purged from active databases and encrypted backups within 30 days.\n\n### 7. Bank-Level Encryption Standards\nAll data managed by Sellora is protected by industry-leading cryptographic standards:\n- **Encryption at Rest:** All databases, message archives, and customer files are encrypted using AES-256 bit encryption.\n- **Encryption in Transit:** All API traffic, webhook transmissions, and dashboard communications enforce TLS 1.3 encryption.\n- **Two-Factor Authentication (2FA):** Server-side TOTP 2FA enforcement prevents unauthorized administrative account access.\n\n### 8. Cookies & Local Storage\nSellora uses minimal, essential cookies and browser local storage strictly for operational functionality:\n- Maintaining secure, encrypted authentication sessions and preventing Cross-Site Request Forgery (CSRF).\n- Storing interface preferences such as language selection (`en`, `ar`, or `fr`) and theme toggle (`light` or `dark` mode).\n- We do not use third-party tracking or advertising pixel cookies on our merchant dashboard.\n\n### 9. Your Rights & Data Portability\nAs the rightful owner of your business data, you have the right to:\n- **Export Your Data:** Download your complete customer CRM, order logs, product performance metrics, and conversation history in standard CSV or JSON formats at any time.\n- **Revoke API Access:** Disconnect any social channel (Instagram, Facebook Messenger, WhatsApp) or e-commerce storefront (Shopify) with a single click, instantly terminating data synchronization.\n- **Audit Logs:** Review detailed security logs tracking team member logins, RBAC role modifications, and inventory adjustments.\n\n### 10. Contacting Our Data Protection Office\nIf you have any questions regarding data encryption, RLS policies, or privacy compliance, please contact our founding engineering team and Data Protection Officer directly at:\n- **Email:** support@sellora.app\n- **Location:** Cairo, Arab Republic of Egypt"}
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
