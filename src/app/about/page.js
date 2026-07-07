"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldCheck, Zap, HeartHandshake, Terminal, Sparkles, CheckCircle2 } from "lucide-react";
import "../components/landing/landing.css";

export default function AboutPage() {
  return (
    <div style={{ background: "#08080a", color: "#fff", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      {/* Top Header */}
      <header style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(8,8,10,0.8)", backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div className="landing-container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "72px" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: "18px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "linear-gradient(135deg, #6366f1, #00d2ff)", display: "flex", alignItems: "center", justifyContent: "center" }}>S</div>
            <span>Sellora</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <Link href="/" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
              <ArrowLeft size={16} /> Back to Home
            </Link>
            <Link href="/signup" className="btn-designer-primary" style={{ padding: "8px 16px", fontSize: "13px" }}>
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="landing-container" style={{ padding: "80px 24px" }}>
        {/* Title */}
        <div style={{ textAlign: "center", maxWidth: "760px", margin: "0 auto 64px" }}>
          <span className="designer-badge" style={{ marginBottom: "16px" }}>
            <span className="dot" /> ABOUT THE FOUNDER &amp; THE APP
          </span>
          <h1 style={{ fontSize: "40px", fontWeight: 900, lineHeight: 1.2, margin: "0 0 20px" }}>
            Built by an Egyptian Undergrad to <span style={{ color: "#6366f1" }}>Revolutionize Social Commerce.</span>
          </h1>
          <p style={{ fontSize: "16px", color: "#94a3b8", lineHeight: 1.7 }}>
            How a software engineering student in Cairo built the operating system that lets e-commerce stores run themselves autonomously.
          </p>
        </div>

        {/* Founder Card */}
        <div className="designer-card" style={{ maxWidth: "900px", margin: "0 auto 64px", padding: "48px", background: "linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 27, 75, 0.7) 100%)", border: "1px solid rgba(99, 102, 241, 0.4)", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "32px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px" }}>
                <div style={{ width: "64px", height: "64px", borderRadius: "20px", background: "linear-gradient(135deg, #6366f1, #10b981)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", fontWeight: 900, color: "#fff", boxShadow: "0 10px 25px rgba(99,102,241,0.4)" }}>
                  MM
                </div>
                <div>
                  <h2 style={{ fontSize: "24px", fontWeight: 800, margin: 0, color: "#fff" }}>Martin Magued</h2>
                  <div style={{ fontSize: "14px", color: "#34d399", fontWeight: 600, marginTop: "4px" }}>Founder &amp; Creator of Sellora • Software Engineer</div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px", fontSize: "15px", color: "#e2e8f0", lineHeight: 1.8 }}>
                <p style={{ margin: 0 }}>
                  Hi, I&apos;m Martin Magued — an undergraduate software engineering student in Egypt. I started Sellora after observing a frustrating daily reality for local business owners, boutique managers, and online sellers: spending hours every single night drowning in WhatsApp DMs, manually copy-pasting product prices until 2 AM, checking bank app screenshots for InstaPay and Vodafone Cash, and losing orders whenever they stepped away from their phones.
                </p>
                <p style={{ margin: 0 }}>
                  I realized that business owners didn&apos;t need another gimmicky chatbot that required constant human supervision. What they needed was a <strong>true operating system</strong>—software that could manage their business in an effortless way where AI silently handles everything.
                </p>
                <p style={{ margin: 0, color: "#fff", fontWeight: 600, background: "rgba(99,102,241,0.15)", padding: "16px", borderRadius: "12px", borderLeft: "4px solid #6366f1" }}>
                  &quot;I built Sellora so that while you are offline, sleeping, or in a lecture, the system can finish inquiries, reserve inventory, verify payment webhooks, confirm orders, and send you instant summarized updates—giving you your time and freedom back.&quot;
                </p>
              </div>

              <div style={{ marginTop: "32px", display: "flex", flexWrap: "wrap", gap: "16px" }}>
                <a
                  href="https://www.linkedin.com/in/martin-magued"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-designer-primary"
                  style={{ textDecoration: "none" }}
                >
                  Connect with Martin Magued on LinkedIn →
                </a>
                <Link href="/signup" className="btn-designer-secondary" style={{ textDecoration: "none" }}>
                  Try Sellora Free for 14 Days
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* About the App */}
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <h3 style={{ fontSize: "28px", fontWeight: 800, textAlign: "center", marginBottom: "40px" }}>
            About the Sellora Platform
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px" }}>
            {[
              { title: "5 Channels, One Workspace", desc: "Consolidates WhatsApp, Instagram, Facebook, Telegram, and Email into a single command center so you never switch browser tabs." },
              { title: "Offline Autonomous Ordering", desc: "Even when your phone is turned off, Sellora guides customers from product discovery to verified checkout without delay." },
              { title: "Direct Egyptian Banking Webhooks", desc: "Integrates directly with Paymob, InstaPay, Fawry, and Vodafone Cash to automatically verify payments in 1 second." },
              { title: "Native Egyptian Dialect NLP", desc: "Engineered specifically to understand Egyptian slang, Gulf Arabic, and formal e-commerce terms with 100% natural accuracy." },
            ].map((item, i) => (
              <div key={i} className="designer-card" style={{ padding: "28px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                  <CheckCircle2 size={20} color="#10b981" />
                  <h4 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "#fff" }}>{item.title}</h4>
                </div>
                <p style={{ fontSize: "14px", color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
