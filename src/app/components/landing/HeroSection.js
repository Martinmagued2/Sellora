"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Play, Sparkles, ShieldCheck, Zap, CheckCircle2 } from "lucide-react";
import LiveProductHero3D from "./LiveProductHero3D";
import "./landing.css";

export default function HeroSection() {
  return (
    <section className="hero-designer-bg" style={{ paddingTop: "120px", paddingBottom: "80px" }}>
      <div className="hero-grid-pattern" />

      <div className="landing-container" style={{ position: "relative", zIndex: 2 }}>
        {/* Top Announcement Badge */}
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <span className="designer-badge">
            <span className="dot" />
            <span>New: Paymob &amp; Shopify Real-Time AI Auto-Pilot v2.4 Active</span>
            <span style={{ color: "#818cf8", fontWeight: 700 }}>→</span>
          </span>
        </div>

        {/* Editorial Headline */}
        <div style={{ textAlign: "center", maxWidth: "900px", margin: "0 auto" }}>
          <h1 className="designer-title">
            Sell on Social. <br />
            <span style={{
              background: "linear-gradient(135deg, #ffffff 0%, #a5b4fc 40%, #6366f1 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              On Total Auto-Pilot.
            </span>
          </h1>
          <p className="designer-subtitle">
            Turn WhatsApp chats, Instagram DMs, and Facebook comments into automated Shopify orders and instant InstaPay &amp; Paymob payments—24/7, in flawless Egyptian Arabic dialect.
          </p>

          {/* CTA Buttons */}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "16px", marginBottom: "36px" }}>
            <Link href="/signup" className="btn-designer-primary">
              Start 14-Day Free Trial <ArrowRight size={18} />
            </Link>
            <a href="#interactive-sandbox" className="btn-designer-secondary">
              <Play size={16} fill="currentColor" /> Test Live Simulator ↓
            </a>
          </div>

          {/* Trust points row */}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "24px", fontSize: "13px", color: "#94a3b8", marginBottom: "48px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <CheckCircle2 size={16} color="#10b981" /> No credit card required
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <CheckCircle2 size={16} color="#10b981" /> 10-Minute Setup
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <CheckCircle2 size={16} color="#10b981" /> Official Meta &amp; Paymob Partner
            </span>
          </div>
        </div>

        {/* ================= 3D GLASS APP CENTERPIECE ================= */}
        <div style={{ marginTop: "20px" }}>
          <LiveProductHero3D />
        </div>

        {/* ================= TRUST METRICS BAR ================= */}
        <div className="trust-metrics-bar">
          <div className="trust-metric">
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(99, 102, 241, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#818cf8" }}>
              <Zap size={18} />
            </div>
            <div>
              <strong>0.8s Avg Reply Speed</strong>
              <div style={{ fontSize: "11.5px", color: "#64748b" }}>Zero customer waiting time</div>
            </div>
          </div>

          <div className="trust-metric">
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(16, 185, 129, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#34d399" }}>
              <Sparkles size={18} />
            </div>
            <div>
              <strong>+$450k MENA Volume</strong>
              <div style={{ fontSize: "11.5px", color: "#64748b" }}>Closed automatically every month</div>
            </div>
          </div>

          <div className="trust-metric">
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(245, 158, 11, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b" }}>
              <ShieldCheck size={18} />
            </div>
            <div>
              <strong>100% Verified Payments</strong>
              <div style={{ fontSize: "11.5px", color: "#64748b" }}>InstaPay, Paymob, Fawry &amp; Vodafone Cash</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
