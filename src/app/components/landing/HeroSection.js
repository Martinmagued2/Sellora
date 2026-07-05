"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Play, Sparkles, ShieldCheck, Zap, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import LiveProductHero3D from "./LiveProductHero3D";
import "./landing.css";

const DICT = {
  en: {
    badge: "New: Paymob & Shopify Real-Time AI Auto-Pilot v2.4 Active",
    title1: "Sell on Social.",
    title2: "On Total Auto-Pilot.",
    subtitle: "Turn WhatsApp chats, Instagram DMs, and Facebook comments into automated Shopify orders and instant InstaPay & Paymob payments—24/7, with zero human intervention.",
    cta1: "Start 14-Day Free Trial",
    cta2: "Test Live Simulator ↓",
    trust1: "No credit card required",
    trust2: "10-Minute Setup",
    trust3: "Official Meta & Paymob Partner",
    m1Title: "0.8s Avg Reply Speed",
    m1Sub: "Zero customer waiting time",
    m2Title: "+$450k MENA Volume",
    m2Sub: "Closed automatically every month",
    m3Title: "100% Verified Payments",
    m3Sub: "InstaPay, Paymob, Fawry & Vodafone Cash",
  },
  ar: {
    badge: "جديد: ربط مباشر بالذكاء الاصطناعي مع Paymob و Shopify v2.4",
    title1: "بيع على الميديا.",
    title2: "بذكاء اصطناعي ذاتي.",
    subtitle: "حول محادثات الواتساب، ورسائل إنستجرام، وتعليقات فيسبوك إلى أوردرات شوبيفاي ودفع فوري عبر InstaPay و Paymob—على مدار 24 ساعة بدون أي تدخل بشري وبالعامية المصرية الدقيقة.",
    cta1: "ابدأ تجربة مجانية 14 يوم",
    cta2: "جرب المحاكي الحي ↓",
    trust1: "بدون بطاقة ائتمانية",
    trust2: "إعداد في 10 دقائق",
    trust3: "شريك معتمد من Meta و Paymob",
    m1Title: "0.8 ثانية سرعة الرد",
    m1Sub: "صفر وقت انتظار للعميل",
    m2Title: "+450 ألف دولار مبيعات",
    m2Sub: "تغلق أوتوماتيكياً كل شهر في المنطقة",
    m3Title: "دفع مؤكد 100%",
    m3Sub: "InstaPay و Paymob وفوري وفودافون كاش",
  },
  fr: {
    badge: "Nouveau : Pilote auto IA en temps réel avec Paymob & Shopify v2.4",
    title1: "Vendez sur les réseaux.",
    title2: "En pilotage 100% auto.",
    subtitle: "Transformez les chats WhatsApp, messages Instagram et commentaires Facebook en commandes Shopify et paiements instantanés InstaPay & Paymob — 24h/24 sans intervention humaine.",
    cta1: "Essai gratuit de 14 jours",
    cta2: "Tester le simulateur ↓",
    trust1: "Aucune carte requise",
    trust2: "Configuration en 10 minutes",
    trust3: "Partenaire officiel Meta & Paymob",
    m1Title: "0,8s Temps de réponse",
    m1Sub: "Zéro attente pour le client",
    m2Title: "+450k$ de volume MENA",
    m2Sub: "Conclu automatiquement chaque mois",
    m3Title: "Paiements 100% vérifiés",
    m3Sub: "InstaPay, Paymob, Fawry & Vodafone Cash",
  },
};

export default function HeroSection() {
  const { lang, dir } = useLanguage();
  const d = DICT[lang] || DICT.en;

  return (
    <section className="hero-designer-bg" style={{ paddingTop: "120px", paddingBottom: "80px", direction: dir }}>
      <div className="hero-grid-pattern" />

      <div className="landing-container" style={{ position: "relative", zIndex: 2 }}>
        {/* Top Announcement Badge */}
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <span className="designer-badge">
            <span className="dot" />
            <span>{d.badge}</span>
            <span style={{ color: "#818cf8", fontWeight: 700 }}>{dir === "rtl" ? "←" : "→"}</span>
          </span>
        </div>

        {/* Editorial Headline */}
        <div style={{ textAlign: "center", maxWidth: "900px", margin: "0 auto" }}>
          <h1 className="designer-title">
            {d.title1} <br />
            <span style={{
              background: "linear-gradient(135deg, #ffffff 0%, #a5b4fc 40%, #6366f1 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              {d.title2}
            </span>
          </h1>
          <p className="designer-subtitle">
            {d.subtitle}
          </p>

          {/* CTA Buttons */}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "16px", marginBottom: "36px" }}>
            <Link href="/signup" className="btn-designer-primary">
              {d.cta1} <ArrowRight size={18} style={{ transform: dir === "rtl" ? "rotate(180deg)" : "none" }} />
            </Link>
            <a href="#interactive-sandbox" className="btn-designer-secondary">
              <Play size={16} fill="currentColor" /> {d.cta2}
            </a>
          </div>

          {/* Trust points row */}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "24px", fontSize: "13px", color: "#94a3b8", marginBottom: "48px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <CheckCircle2 size={16} color="#10b981" /> {d.trust1}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <CheckCircle2 size={16} color="#10b981" /> {d.trust2}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <CheckCircle2 size={16} color="#10b981" /> {d.trust3}
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
              <strong>{d.m1Title}</strong>
              <div style={{ fontSize: "11.5px", color: "#64748b" }}>{d.m1Sub}</div>
            </div>
          </div>

          <div className="trust-metric">
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(16, 185, 129, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#34d399" }}>
              <Sparkles size={18} />
            </div>
            <div>
              <strong>{d.m2Title}</strong>
              <div style={{ fontSize: "11.5px", color: "#64748b" }}>{d.m2Sub}</div>
            </div>
          </div>

          <div className="trust-metric">
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(245, 158, 11, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b" }}>
              <ShieldCheck size={18} />
            </div>
            <div>
              <strong>{d.m3Title}</strong>
              <div style={{ fontSize: "11.5px", color: "#64748b" }}>{d.m3Sub}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
