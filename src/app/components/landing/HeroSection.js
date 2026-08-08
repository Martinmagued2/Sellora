"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Play, CheckCircle2 } from "lucide-react";
import Image from "next/image";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import HeroDashboardMockup from "./HeroDashboardMockup";
import "./landing.css";

const DICT = {
  en: {
    badge: "Live: Paymob & Shopify Auto-Pilot v2.4 is active",
    title1: "Your Business.",
    title2: "Running Itself.",
    subtitle: "One workspace for orders, customers, payments, inventory, and conversations across WhatsApp, Instagram, and Shopify. Powered quietly by AI.",
    cta1: "Start 14-Day Free Trial",
    cta2: "Watch Demo",
    trust1: "No credit card required",
    trust2: "10-Minute Setup",
    trust3: "Enterprise-Grade Security",
  },
  ar: {
    badge: "مباشر: طيار Paymob و Shopify الآلي v2.4 يعمل الآن",
    title1: "تجمارتك الإلكترونية.",
    title2: "تدير نفسها بنفسها.",
    subtitle: "مساحة عمل واحدة لإدارة الأوردرات، والعملاء، والمدفوعات، والمخزون، والمحادثات عبر واتساب وإنستجرام وشوبيفاي. تعمل بهدوء وذكاء ذاتي.",
    cta1: "ابدأ تجربة مجانية 14 يوم",
    cta2: "شاهد مساحة العمل",
    trust1: "بدون بطاقة ائتمانية",
    trust2: "إعداد في 10 دقائق",
    trust3: "أمان بمواصفات البنوك",
  },
  fr: {
    badge: "Direct : Pilote Auto Paymob & Shopify v2.4 actif",
    title1: "Votre Commerce.",
    title2: "100% Autonome.",
    subtitle: "Un seul espace de travail pour vos commandes, clients, paiements, stocks et conversations sur WhatsApp, Instagram et Shopify. Piloté discrètement par l'IA.",
    cta1: "Essai gratuit de 14 jours",
    cta2: "Découvrir la Démo",
    trust1: "Aucune carte requise",
    trust2: "Configuration en 10 min",
    trust3: "Sécurité Niveau Bancaire",
  },
};

export default function HeroSection() {
  const { lang, dir } = useLanguage();
  const d = DICT[lang] || DICT.en;

  return (
    <section className="hero-designer-bg" style={{ paddingTop: "100px", paddingBottom: "60px", direction: dir, width: "100%", overflow: "hidden" }}>
      <div className="hero-grid-pattern" />

      <div className="landing-container" style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
        
        {/* 2-Column Desktop Grid */}
        <div className="hero-split-grid">
          
          {/* Left Column: Copy & CTAs */}
          <div style={{ textAlign: dir === "rtl" ? "right" : "left" }}>
            {/* Top Live Badge */}
            <div style={{ marginBottom: "24px" }}>
              <span className="designer-badge" style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                <Image src="/logo.png" alt="Sellora" width={20} height={20} style={{ borderRadius: 6 }} />
                <span>{d.badge}</span>
              </span>
            </div>

            {/* Headline */}
            <h1 className="designer-title" style={{ margin: "0 0 20px" }}>
              {d.title1} <br />
              <span style={{
                background: "linear-gradient(135deg, #ffffff 0%, #a5b4fc 40%, #6366f1 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
                {d.title2}
              </span>
            </h1>
            
            <p className="designer-subtitle" style={{ margin: "0 0 32px", maxWidth: "540px", lineHeight: 1.6 }}>
              {d.subtitle}
            </p>

            {/* CTA Buttons */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginBottom: "36px", justifyContent: dir === "rtl" ? "flex-end" : "flex-start" }}>
              <Link href="/signup" className="btn-designer-primary">
                {d.cta1} <ArrowRight size={18} style={{ transform: dir === "rtl" ? "rotate(180deg)" : "none" }} />
              </Link>
              <a href="#interactive-sandbox" className="btn-designer-secondary">
                <Play size={16} fill="currentColor" /> {d.cta2}
              </a>
            </div>

            {/* Trust points row */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", fontSize: "13px", color: "#94a3b8", justifyContent: dir === "rtl" ? "flex-end" : "flex-start" }}>
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

          {/* Right Column: Full Business Operating System Dashboard Mockup */}
          <div style={{ width: "100%" }}>
            <HeroDashboardMockup />
          </div>

        </div>

      </div>
    </section>
  );
}
