"use client";

import React, { useState, useEffect } from "react";
import { MessageSquare, Bot, PackageCheck, CreditCard, CheckCircle2, Truck, Check, Sparkles, ArrowRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import "./landing.css";

const TIMELINE_DICT = {
  en: {
    badge: "The E-Commerce Lifecycle Journey",
    title1: "From First DM to Delivered Order.",
    title2: "In Under 3 Minutes.",
    subtitle: "Watch how Sellora connects your social channels, storefront inventory, payment gateways, and courier partners into one seamless, self-running pipeline.",
    step1Title: "10:21 AM • Instagram DM",
    step1Desc: "\"Hi, do you have size 42 in blue?\"",
    step2Title: "10:21 AM • AI Intent Detection",
    step2Desc: "NLP identifies size & color request",
    step3Title: "10:21 AM • Inventory Reserved",
    step3Desc: "Shopify stock locked automatically",
    step4Title: "10:22 AM • Paymob Link Sent",
    step4Desc: "Secure InstaPay checkout generated",
    step5Title: "10:23 AM • Payment Verified",
    step5Desc: "Bank receipt verified instantly",
    step6Title: "10:24 AM • Bosta Scheduled",
    step6Desc: "Courier pickup booked for 2 PM",
    step7Title: "10:24 AM • Order Shipped",
    step7Desc: "Live WhatsApp tracking sent",
    statusLoop: "● Autonomous Pipeline • 100% Automated Workflow",
    tip: "💡 Interactive Lifecycle: Click any step to see backend automation details.",
  },
  ar: {
    badge: "دورة حياة الأوردر المتكاملة",
    title1: "من أول رسالة حتى تسليم الشحنة.",
    title2: "في أقل من 3 دقائق.",
    subtitle: "شاهد كيف يربط نظام Sellora حساباتك على الميديا، ومخزون متجرك، وبوابات الدفع، وشركات الشحن في مسار أوتوماتيكي ذاتي التشغيل.",
    step1Title: "10:21 ص • رسالة إنستجرام",
    step1Desc: "\"مساء الخير، هل متاح مقاس 42 لون أزرق؟\"",
    step2Title: "10:21 ص • تحليل القصد باللهجة",
    step2Desc: "التعرف على طلب المقاس واللون دقيقة",
    step3Title: "10:21 ص • حجز المخزون",
    step3Desc: "حجز القطعة أوتوماتيكياً في شوبيفاي",
    step4Title: "10:22 ص • إرسال رابط Paymob",
    step4Desc: "إصدار رابط دفع InstaPay آمن",
    step5Title: "10:23 ص • تأكيد الدفع",
    step5Desc: "توثيق إيصال الدفع البنكي في ثانية",
    step6Title: "10:24 ص • حجز مندوب بوسطة",
    step6Desc: "تحديد موعد استلام المندوب الساعة 2",
    step7Title: "10:24 ص • شحن الأوردر",
    step7Desc: "إرسال تتبع الشحنة المباشر واتساب",
    statusLoop: "● مسار ذاتي التشغيل • أتمتة كاملة بنسبة 100%",
    tip: "💡 المسار التفاعلي: اضغط على أي خطوة لرؤية تفاصيل التنفيذ في الخلفية.",
  },
  fr: {
    badge: "Le Cycle de Vie E-Commerce",
    title1: "Du Premier MP à la Livraison.",
    title2: "En Moins de 3 Minutes.",
    subtitle: "Découvrez comment Sellora connecte vos réseaux sociaux, votre stock Shopify, vos paiements et vos livreurs dans un flux 100% autonome.",
    step1Title: "10h21 • MP Instagram",
    step1Desc: "\"Bonjour, avez-vous le bleu en taille 42 ?\"",
    step2Title: "10h21 • Détection IA",
    step2Desc: "Analyse NLP de la demande taille/couleur",
    step3Title: "10h21 • Stock Réservé",
    step3Desc: "Stock Shopify bloqué instantanément",
    step4Title: "10h22 • Lien Paymob Envoyé",
    step4Desc: "Paiement InstaPay sécurisé généré",
    step5Title: "10h23 • Paiement Vérifié",
    step5Desc: "Reçu bancaire validé en 1 seconde",
    step6Title: "10h24 • Livreur Bosta Réservé",
    step6Desc: "Enlèvement programmé à 14h00",
    step7Title: "10h24 • Commande Expédiée",
    step7Desc: "Suivi WhatsApp envoyé au client",
    statusLoop: "● Pipeline Autonome • Workflow 100% Automatisé",
    tip: "💡 Cycle Interactif : Cliquez sur une étape pour voir les détails d'automatisation.",
  },
};

export default function AutomatedLifecycleTimeline() {
  const { lang, dir } = useLanguage();
  const d = TIMELINE_DICT[lang] || TIMELINE_DICT.en;
  const [activeStep, setActiveStep] = useState(0);

  // Auto cycling pulse animation
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 7);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  const steps = [
    { icon: <MessageSquare size={18} />, title: d.step1Title, desc: d.step1Desc, color: "#e1306c" },
    { icon: <Bot size={18} />, title: d.step2Title, desc: d.step2Desc, color: "#818cf8" },
    { icon: <PackageCheck size={18} />, title: d.step3Title, desc: d.step3Desc, color: "#00d2ff" },
    { icon: <CreditCard size={18} />, title: d.step4Title, desc: d.step4Desc, color: "#10b981" },
    { icon: <CheckCircle2 size={18} />, title: d.step5Title, desc: d.step5Desc, color: "#34d399" },
    { icon: <Truck size={18} />, title: d.step6Title, desc: d.step6Desc, color: "#f59e0b" },
    { icon: <Check size={18} />, title: d.step7Title, desc: d.step7Desc, color: "#6366f1" },
  ];

  return (
    <div className="designer-card" style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px", direction: dir }}>
      <div style={{ textAlign: "center", marginBottom: "36px" }}>
        <span className="designer-badge" style={{ marginBottom: "12px" }}>
          <span className="dot" /> {d.badge}
        </span>
        <h3 style={{ fontSize: "32px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>
          {d.title1} <span style={{ color: "#34d399" }}>{d.title2}</span>
        </h3>
        <p style={{ fontSize: "14.5px", color: "#94a3b8", maxWidth: "660px", margin: "0 auto", lineHeight: 1.6 }}>
          {d.subtitle}
        </p>
      </div>

      {/* Timeline Grid */}
      <div style={{ position: "relative", padding: "20px 0" }}>
        {/* Horizontal Connecting Line */}
        <div
          style={{
            position: "absolute",
            top: "52px",
            left: "5%",
            right: "5%",
            height: "3px",
            background: "rgba(255, 255, 255, 0.08)",
            zIndex: 1,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${(activeStep / 6) * 100}%`,
              background: "linear-gradient(90deg, #6366f1, #10b981)",
              boxShadow: "0 0 12px #10b981",
              transition: "width 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </div>

        {/* 7 Step Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "12px", position: "relative", zIndex: 2 }}>
          {steps.map((s, i) => {
            const isActive = i === activeStep;
            const isPassed = i <= activeStep;
            return (
              <div
                key={i}
                onClick={() => setActiveStep(i)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  transform: isActive ? "translateY(-6px)" : "none",
                }}
              >
                {/* Step Circle Node */}
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    background: isPassed ? s.color : "rgba(255, 255, 255, 0.05)",
                    border: isActive ? `3px solid #fff` : `1px solid ${isPassed ? s.color : "rgba(255,255,255,0.1)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: isPassed ? "#fff" : "#64748b",
                    boxShadow: isActive ? `0 0 20px ${s.color}` : "none",
                    marginBottom: "16px",
                    transition: "all 0.3s ease",
                  }}
                >
                  {s.icon}
                </div>

                {/* Step Card Content */}
                <div
                  style={{
                    background: isActive ? "rgba(255, 255, 255, 0.06)" : "rgba(255, 255, 255, 0.02)",
                    border: `1px solid ${isActive ? s.color : "rgba(255, 255, 255, 0.06)"}`,
                    borderRadius: "12px",
                    padding: "12px 8px",
                    width: "100%",
                    minHeight: "110px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    boxShadow: isActive ? "0 10px 25px rgba(0,0,0,0.5)" : "none",
                  }}
                >
                  <div style={{ fontSize: "11px", fontWeight: 700, color: isActive ? "#fff" : "#cbd5e1", marginBottom: "6px", lineHeight: 1.3 }}>
                    {s.title}
                  </div>
                  <div style={{ fontSize: "10.5px", color: "#94a3b8", lineHeight: 1.4 }}>
                    {s.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: "28px", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
        <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#34d399" }}>
          {d.statusLoop}
        </div>
        <div style={{ fontSize: "11.5px", color: "#64748b" }}>
          {d.tip}
        </div>
      </div>
    </div>
  );
}
