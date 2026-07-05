"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Play, Sparkles, ShieldCheck, Zap, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import LiveProductHero3D from "./LiveProductHero3D";
import "./landing.css";

const DICT = {
  en: {
    badge: "The Operating System for Modern Social Commerce v2.4",
    title1: "Your Business.",
    title2: "Running Itself.",
    subtitle: "One workspace for orders, customers, payments, inventory, and conversations across WhatsApp, Instagram, and Shopify. Powered quietly by AI.",
    cta1: "Start 14-Day Free Trial",
    cta2: "Watch Workspace Demo ↓",
    trust1: "No credit card required",
    trust2: "10-Minute Setup",
    trust3: "2FA Server Enforcement",
    m1Title: "0.8s Response Speed",
    m1Sub: "Zero customer waiting time",
    m2Title: "96% Workflows Automated",
    m2Sub: "Orders, inventory, and billing",
    m3Title: "100% Verified Checkouts",
    m3Sub: "Paymob, InstaPay, Fawry & COD",
  },
  ar: {
    badge: "نظام التشغيل المتكامل للتجارة الإلكترونية الحديثة v2.4",
    title1: "تجمارتك الإلكترونية.",
    title2: "تدير نفسها بنفسها.",
    subtitle: "مساحة عمل واحدة لإدارة الأوردرات، والعملاء، والمدفوعات، والمخزون، والمحادثات عبر واتساب وإنستجرام وشوبيفاي. تعمل بهدوء وذكاء ذاتي.",
    cta1: "ابدأ تجربة مجانية 14 يوم",
    cta2: "شاهد مساحة العمل ↓",
    trust1: "بدون بطاقة ائتمانية",
    trust2: "إعداد في 10 دقائق",
    trust3: "حماية ثنائية 2FA وموثق",
    m1Title: "0.8 ثانية سرعة الرد",
    m1Sub: "صفر وقت انتظار للعميل",
    m2Title: "96% أتمتة كاملة للعمليات",
    m2Sub: "الأوردرات والمخزون والفواتير",
    m3Title: "دفع مؤكد 100%",
    m3Sub: "InstaPay و Paymob وفوري والدفع عند الاستلام",
  },
  fr: {
    badge: "Le Système d'Exploitation pour le Commerce Social v2.4",
    title1: "Votre Commerce.",
    title2: "100% Autonome.",
    subtitle: "Un seul espace de travail pour vos commandes, clients, paiements, stocks et conversations sur WhatsApp, Instagram et Shopify. Piloté discrètement par l'IA.",
    cta1: "Essai gratuit de 14 jours",
    cta2: "Découvrir le Workspace ↓",
    trust1: "Aucune carte requise",
    trust2: "Configuration en 10 minutes",
    trust3: "Sécurité 2FA Active",
    m1Title: "0,8s Temps de réponse",
    m1Sub: "Zéro attente pour vos clients",
    m2Title: "96% Taux d'Automatisation",
    m2Sub: "Commandes, stocks et facturation",
    m3Title: "Paiements 100% Vérifiés",
    m3Sub: "Paymob, InstaPay, Fawry & COD",
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

        {/* ================= 3D MISSION CONTROL WORKSPACE CENTERPIECE ================= */}
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
