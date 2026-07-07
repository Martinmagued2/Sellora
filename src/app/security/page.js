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
            <span className="dot" /> BANK-GRADE PROTECTION & 2FA
          </span>
          <h1 style={{ fontSize: "38px", fontWeight: 900, margin: "0 0 24px", color: "#fff" }}>
            Security & Enterprise Architecture
          </h1>
          <div className="designer-card" style={{ padding: "44px", fontSize: "15px", color: "#cbd5e1", lineHeight: 1.8, whiteSpace: "pre-line", display: "flex", flexDirection: "column", gap: "20px" }}>
            {"Sellora employs a multi-layered, defense-in-depth security architecture to ensure your online store runs autonomously without vulnerability or interruption.\n\n### 1. Mandatory Server-Side 2FA Enforcement\nAll administrative login sessions, team member invitations, and role-based access control (RBAC) modifications are protected by mandatory server-side Two-Factor Authentication (TOTP/2FA), preventing credential stuffing and unauthorized account takeover.\n\n### 2. Cryptographic Webhook Replay Protection\nIncoming financial webhooks and payment confirmations from Paymob, InstaPay Egypt, Fawry, and Shopify are rigorously validated using HMAC SHA-256 cryptographic signatures combined with timestamp replay protection to prevent spoofing or fraudulent order confirmations.\n\n### 3. Immutable Security Audit Logging\nEvery critical workspace action—including price adjustments, inventory overrides, manual order creations, and team member permission changes—is permanently recorded in an immutable security audit log available for your inspection."}
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
