"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, CheckCircle2 } from "lucide-react";
import "../components/landing/landing.css";

export default function Page() {
  return (
    <div style={{ background: "#08080a", color: "#fff", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <header style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(8,8,10,0.8)", backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div className="landing-container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "72px" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: "18px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "linear-gradient(135deg, #6366f1, #00d2ff)", display: "flex", alignItems: "center", justifyContent: "center" }}>S</div>
            <span>Sellora</span>
          </Link>
          <Link href="/" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
            <ArrowLeft size={16} /> Back to Home
          </Link>
        </div>
      </header>

      <main className="landing-container" style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <span className="designer-badge" style={{ marginBottom: "16px" }}>
            <span className="dot" /> DATA PROTECTION & PRIVACY
          </span>
          <h1 style={{ fontSize: "38px", fontWeight: 900, margin: "0 0 24px", color: "#fff" }}>
            Privacy Policy
          </h1>
          <div className="designer-card" style={{ padding: "40px", fontSize: "15px", color: "#cbd5e1", lineHeight: 1.8, whiteSpace: "pre-line", display: "flex", flexDirection: "column", gap: "16px" }}>
            {"At Sellora, protecting your store's data and your customers' personal information is our highest priority. We use bank-level encryption (AES-256 at rest and TLS 1.3 in transit) across all cloud infrastructure.\n\n**1. Data Collection & Isolation:** We collect only the data necessary to automate your e-commerce workflows (e.g., incoming chat text for NLP intent recognition, order SKUs, and shipping addresses). Every store's data is isolated using Supabase Server-Side Row-Level Security (RLS).\n\n**2. Zero Third-Party Sharing:** We never sell, rent, or share your customer DMs, WhatsApp conversations, or financial transaction logs with third-party advertisers.\n\n**3. WhatsApp & Meta Cloud API:** Messages routed through the official WhatsApp Business Cloud API follow Meta's strict enterprise encryption and privacy protocols."}
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
