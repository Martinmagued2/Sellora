"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, ShieldCheck, Zap, HeartHandshake, Terminal, Sparkles, CheckCircle2, Layers, MessageSquare, ShoppingBag, CreditCard, Truck, Globe, Cpu } from "lucide-react";
import "../components/landing/landing.css";

export default function AboutPage() {
  return (
    <div style={{ background: "#08080a", color: "#fff", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      {/* Top Header */}
      <header style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(8,8,10,0.8)", backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div className="landing-container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "72px" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: "18px" }}>
            <Image src="/logo.png" alt="Sellora" width={32} height={32} style={{ width: 32, height: 32, borderRadius: 8 }} />
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
        <div style={{ textAlign: "center", maxWidth: "800px", margin: "0 auto 64px" }}>
          <span className="designer-badge" style={{ marginBottom: "16px" }}>
            <span className="dot" /> ABOUT THE FOUNDER &amp; THE PLATFORM
          </span>
          <h1 style={{ fontSize: "42px", fontWeight: 900, lineHeight: 1.2, margin: "0 0 20px" }}>
            Built by an Egyptian Undergrad to <span style={{ color: "#6366f1" }}>Revolutionize Social Commerce.</span>
          </h1>
          <p style={{ fontSize: "16px", color: "#94a3b8", lineHeight: 1.7 }}>
            How a software engineering student in Cairo built the operating system that lets online stores across MENA run themselves autonomously—even while you sleep.
          </p>
        </div>

        {/* Founder Card */}
        <div className="designer-card" style={{ maxWidth: "960px", margin: "0 auto 64px", padding: "52px", background: "linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 27, 75, 0.7) 100%)", border: "1px solid rgba(99, 102, 241, 0.4)", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "32px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
                <div style={{ width: "72px", height: "72px", borderRadius: "20px", background: "linear-gradient(135deg, #6366f1, #10b981)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", fontWeight: 900, color: "#fff", boxShadow: "0 10px 25px rgba(99,102,241,0.4)" }}>
                  MM
                </div>
                <div>
                  <h2 style={{ fontSize: "26px", fontWeight: 800, margin: 0, color: "#fff" }}>Martin Magued</h2>
                  <div style={{ fontSize: "14.5px", color: "#34d399", fontWeight: 600, marginTop: "4px" }}>Founder &amp; Architect of Sellora • Software Engineering Undergrad</div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "18px", fontSize: "15.5px", color: "#e2e8f0", lineHeight: 1.8 }}>
                <p style={{ margin: 0 }}>
                  Hi, I&apos;m Martin Magued — an undergraduate software engineering student in Egypt. I built Sellora after observing a frustrating daily reality for local business owners, boutique managers, and e-commerce sellers across Cairo, Alexandria, and the MENA region: spending hours every single night drowning in unread Instagram DMs, Facebook Messenger comments, and WhatsApp chats, manually copy-pasting product prices until 2 AM, checking bank app screenshots for InstaPay and Vodafone Cash, and losing orders whenever they stepped away from their phones.
                </p>
                <p style={{ margin: 0 }}>
                  I realized that business owners didn&apos;t need another gimmicky chatbot that required constant human supervision. What they needed was a <strong>true operating system</strong>—software that centralizes all social channels, storefront inventories, and payment gateways into one calm command center where automated workflows handle the tedious work silently.
                </p>
                <p style={{ margin: 0, color: "#fff", fontWeight: 600, background: "rgba(99,102,241,0.15)", padding: "20px", borderRadius: "14px", borderLeft: "4px solid #6366f1", fontSize: "16px" }}>
                  &quot;I built Sellora so that while you are offline, sleeping, or in a lecture, the system can finish customer inquiries in native dialect, reserve Shopify inventory, verify banking webhooks, confirm orders, and send you instant summarized updates—giving you your time and freedom back.&quot;
                </p>
              </div>

              <div style={{ marginTop: "36px", display: "flex", flexWrap: "wrap", gap: "16px" }}>
                <a
                  href="https://www.linkedin.com/in/martin-magued"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-designer-primary"
                  style={{ textDecoration: "none", padding: "14px 24px" }}
                >
                  Connect with Martin Magued on LinkedIn →
                </a>
                <Link href="/signup" className="btn-designer-secondary" style={{ textDecoration: "none", padding: "14px 24px" }}>
                  Try Sellora Free for 14 Days
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Core Architecture & Features */}
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#34d399", textTransform: "uppercase", letterSpacing: "0.08em" }}>OPERATING SYSTEM CAPABILITIES</span>
            <h3 style={{ fontSize: "32px", fontWeight: 800, margin: "8px 0 0" }}>
              How Sellora Runs Your Store Autonomously
            </h3>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "24px" }}>
            {[
              { icon: <MessageSquare size={24} color="#E1306C" />, title: "1. Unified Social Inbox (IG, Messenger & WhatsApp)", desc: "Why switch between 15 browser tabs? Sellora consolidates incoming customer inquiries across Instagram DMs, Facebook Messenger, WhatsApp, Telegram, and Email into a single, high-speed command center." },
              { icon: <Cpu size={24} color="#818cf8" />, title: "2. Offline Autonomous Ordering", desc: "Even when your phone is turned off or you are fast asleep, Sellora guides customers from initial product discovery to verified checkout without human delay or intervention." },
              { icon: <CreditCard size={24} color="#10b981" />, title: "3. Direct Banking & Payment Webhooks", desc: "No more squinting at blurry Vodafone Cash screenshots. Sellora integrates directly with Paymob, InstaPay Egypt, Fawry digital invoicing, and mobile wallets to auto-verify checkouts in 1 second." },
              { icon: <Globe size={24} color="#00d2ff" />, title: "4. Native Egyptian Dialect & Gulf NLP Engine", desc: "Engineered from day one in Cairo to understand Egyptian slang ('كام ده؟', 'في شحن لاسكندرية؟'), Gulf Arabic, and formal e-commerce terminology with sub-second precision." },
              { icon: <ShoppingBag size={24} color="#f59e0b" />, title: "5. Live Shopify Catalog & Stock Sync", desc: "Connect your Shopify storefront in two clicks. When an order is placed on Instagram or WhatsApp, Sellora instantly decrements inventory, preventing overselling." },
              { icon: <Truck size={24} color="#34d399" />, title: "6. Automated Courier Dispatch (Bosta & Mylerz)", desc: "When a payment is verified, Sellora automatically schedules courier pickups with Bosta or Mylerz and sends live tracking links to your buyers." },
              { icon: <Layers size={24} color="#8b5cf6" />, title: "7. Sellora Copilot & Custom Automation Rules", desc: "Build custom self-running workflows without writing code—set discount triggers, abandoned cart reminders, and VIP buyer tagging effortlessly." },
              { icon: <ShieldCheck size={24} color="#ef4444" />, title: "8. Enterprise Security & 2FA Enforcement", desc: "Server-side two-factor authentication, Supabase Row-Level Security (RLS), and webhook replay protection keep your store and customer data safe." },
            ].map((item, i) => (
              <div key={i} className="designer-card" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
                    {item.icon}
                  </div>
                  <h4 style={{ fontSize: "17px", fontWeight: 700, margin: 0, color: "#fff" }}>{item.title}</h4>
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
