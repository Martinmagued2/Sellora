"use client";

import React from "react";
import { MessageSquare, Sparkles, Package, CreditCard, CheckCircle2, Truck, Check, ArrowRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import "./landing.css";

const WORKFLOW_DICT = {
  en: {
    title1: "From Message",
    title2: "to Delivered.",
    title3: "Automatically.",
    s1: "Message Received",
    s2: "AI Understands & Identifies",
    s3: "Inventory Reserved",
    s4: "Payment Link Generated",
    s5: "Payment Completed",
    s6: "Courier Booked",
    s7: "Order Delivered",
  },
  ar: {
    title1: "من أول رسالة",
    title2: "حتى التسليم.",
    title3: "أوتوماتيكياً بالكامل.",
    s1: "استلام الرسالة",
    s2: "تحليل الذكاء وتحديد القصد",
    s3: "حجز المخزون أوتوماتيكياً",
    s4: "إصدار رابط الدفع",
    s5: "تأكيد الدفع لحظياً",
    s6: "حجز مندوب الشحن",
    s7: "تسليم الأوردر للعميل",
  },
  fr: {
    title1: "Du Message",
    title2: "à la Livraison.",
    title3: "100% Automatisé.",
    s1: "Message Reçu",
    s2: "Analyse & Identification IA",
    s3: "Stock Réservé",
    s4: "Lien Paiement Généré",
    s5: "Paiement Validé",
    s6: "Livreur Réservé",
    s7: "Commande Livrée",
  },
};

export default function HeroWorkflowBanner() {
  const { lang, dir } = useLanguage();
  const d = WORKFLOW_DICT[lang] || WORKFLOW_DICT.en;

  const steps = [
    { icon: <MessageSquare size={20} color="#25D366" />, label: d.s1, bg: "rgba(37, 211, 102, 0.15)" },
    { icon: <Sparkles size={20} color="#6366f1" />, label: d.s2, bg: "rgba(99, 102, 241, 0.15)" },
    { icon: <Package size={20} color="#f59e0b" />, label: d.s3, bg: "rgba(245, 158, 11, 0.15)" },
    { icon: <CreditCard size={20} color="#00d2ff" />, label: d.s4, bg: "rgba(0, 210, 255, 0.15)" },
    { icon: <CheckCircle2 size={20} color="#8b5cf6" />, label: d.s5, bg: "rgba(139, 92, 246, 0.15)" },
    { icon: <Truck size={20} color="#10b981" />, label: d.s6, bg: "rgba(16, 185, 129, 0.15)" },
    { icon: <Check size={20} color="#10b981" />, label: d.s7, bg: "rgba(16, 185, 129, 0.15)" },
  ];

  return (
    <div
      className="hero-workflow-banner"
      style={{
        width: "100%",
        background: "#ffffff",
        color: "#0f172a",
        borderRadius: "24px",
        padding: "32px 36px",
        marginTop: "48px",
        boxShadow: "0 25px 60px rgba(0, 0, 0, 0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "28px",
        direction: dir,
        textAlign: dir === "rtl" ? "right" : "left",
        flexWrap: "wrap",
      }}
    >
      {/* Left Title Copy */}
      <div style={{ minWidth: "180px", flexShrink: 0 }}>
        <h3 style={{ fontSize: "22px", fontWeight: 900, lineHeight: 1.2, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>
          {d.title1} <br />
          {d.title2} <br />
          <span style={{ color: "#6366f1" }}>{d.title3}</span>
        </h3>
      </div>

      {/* 7 Horizontal Workflow Steps */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1, gap: "12px", overflowX: "auto", paddingBottom: "4px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
        {steps.map((s, idx) => (
          <React.Fragment key={idx}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "10px", minWidth: "90px", flex: 1 }}>
              <div style={{ width: "46px", height: "46px", borderRadius: "14px", background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {s.icon}
              </div>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#334155", lineHeight: 1.3 }}>
                {s.label}
              </span>
            </div>

            {idx < steps.length - 1 && (
              <div style={{ color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <ArrowRight size={18} style={{ transform: dir === "rtl" ? "rotate(180deg)" : "none" }} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
