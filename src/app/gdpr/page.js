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
            <span className="dot" /> EUROPEAN & REGIONAL COMPLIANCE
          </span>
          <h1 style={{ fontSize: "38px", fontWeight: 900, margin: "0 0 24px", color: "#fff" }}>
            GDPR & MENA Data Protection
          </h1>
          <div className="designer-card" style={{ padding: "44px", fontSize: "15px", color: "#cbd5e1", lineHeight: 1.8, whiteSpace: "pre-line", display: "flex", flexDirection: "column", gap: "20px" }}>
            {"Sellora is built from the ground up to comply with global data protection regulations, including the European General Data Protection Regulation (GDPR) and local MENA privacy legislation such as Egypt's Data Protection Law No. 151 of 2020.\n\n### 1. Right to Access & Data Portability\nAs a merchant using Sellora, you have total visibility into your operational records. You can export your complete customer CRM, order logs, inventory history, and social conversation analytics in open CSV or JSON formats at any time from your settings.\n\n### 2. Right to Erasure (The \"Right to be Forgotten\")\nYou can request the immediate, permanent deletion of your store account, team seats, and associated customer CRM data. Upon confirmed request, all records are cryptographically wiped from our active Supabase databases and encrypted backups within 30 days.\n\n### 3. Strict Data Processor Standards\nWe partner exclusively with SOC2 Type II and ISO-27001 certified enterprise cloud infrastructure providers (Vercel, Supabase, Meta Cloud API, Paymob) to process social e-commerce workloads, ensuring end-to-end encryption and compliance."}
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
