"use client";

import React, { useState, useRef } from "react";
import { AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import "./landing.css";

const DICT = {
  en: {
    beforeBadge: "Without Sellora • The Manual Chaos",
    beforeTime: "2:14 AM — Still Replying to DMs",
    beforeAlert: "⚠️ 18 Unread Orders Pending",
    tabsBefore: ["WhatsApp (14)", "Instagram DMs (28)", "Facebook Comments", "Excel Order Spreadsheet.xlsx", "Vodafone Cash Screenshot.jpg"],
    q1Title: "❌ Unanswered Instagram Comments",
    q1: "\"I've been asking for the price for 5 hours and no one replied! Cancel my order!\"",
    q2: "\"Sent InstaPay screenshot morning, still waiting for confirmation.\"",
    wastedTitle: "4+ Hours Daily Wasted",
    wastedDesc: "Copy-pasting prices, checking bank app screenshots manually, and losing customer sales to faster competitors.",
    afterBadge: "With Sellora • 24/7 AI Auto-Pilot",
    afterTime: "● All Channels Auto-Synchronized",
    replySpeed: "⚡ Avg Reply: 0.8 Seconds",
    tabsAfter: ["✅ WhatsApp VIP (Active)", "✅ Instagram Auto-DM", "✅ Shopify Live Catalog Sync", "✅ Paymob & InstaPay Verified"],
    liveTitle: "✨ Live AI Conversions (Today)",
    liveRate: "+100% Response Rate",
    o1Title: "Order #1084 • Omar Khaled",
    o1Sub: "InstaPay Payment Verified Automatically",
    o2Title: "Order #1085 • Sara Ahmed",
    o2Sub: "Shopify Size 38 Auto-Reserved • Paymob Link Sent",
    closedTitle: "Closed Today (Zero Human Intervention)",
    currency: "EGP",
    savedWeek: "🚀 +28 Hours Saved This Week",
    footerTip: "💡 Interactive Scrubber: Drag the divider back and forth to see the difference Sellora makes.",
  },
  ar: {
    beforeBadge: "بدون Sellora • الفوضى اليدوية",
    beforeTime: "2:14 صباحاً — لسه بترد على الرسايل",
    beforeAlert: "⚠️ 18 أوردر معلق بدون رد",
    tabsBefore: ["واتساب (14)", "رسائل إنستجرام (28)", "تعليقات فيسبوك", "شيت إكسيل الأوردرات.xlsx", "سكرين شوت فودافون كاش.jpg"],
    q1Title: "❌ تعليقات إنستجرام بدون رد",
    q1: "\"بقالي 5 ساعات بسأل على السعر ومحدش بيرد! ألغوا الأوردر خلاص!\"",
    q2: "\"بعت سكرين شوت إنستاباي ومحدش أكدلي الحجز من الصبح.\"",
    wastedTitle: "4+ ساعات يومياً ضائعة",
    wastedDesc: "نسخ ولصق الأسعار، ومراجعة سكرين شوت البنوك يدوياً، وخسارة العملاء للمنافسين الأسرع.",
    afterBadge: "مع Sellora • طيار آلي 24/7",
    afterTime: "● جميع القنوات متزامنة لحظياً",
    replySpeed: "⚡ سرعة الرد: 0.8 ثانية",
    tabsAfter: ["✅ واتساب VIP (نشط)", "✅ إنستجرام Auto-DM", "✅ كتالوج شوبيفاي متزامن", "✅ Paymob و InstaPay موثق"],
    liveTitle: "✨ مبيعات الذكاء الاصطناعي (اليوم)",
    liveRate: "نسبة رد +100%",
    o1Title: "أوردر #1084 • عمر خالد",
    o1Sub: "تم تأكيد دفع InstaPay أوتوماتيكياً",
    o2Title: "أوردر #1085 • سارة أحمد",
    o2Sub: "حجز مقاس 38 من شوبيفاي • إرسال رابط Paymob",
    closedTitle: "مبيعات اليوم (بدون أي تدخل بشري)",
    currency: "ج.م",
    savedWeek: "🚀 +28 ساعة توفير هذا الأسبوع",
    footerTip: "💡 المحاكي التفاعلي: اسحب الخط الفاصل يميناً ويساراً لترى الفرق الذي يصنعه Sellora.",
  },
  fr: {
    beforeBadge: "Sans Sellora • Le Chaos Manuel",
    beforeTime: "02h14 — Encore à répondre aux MP",
    beforeAlert: "⚠️ 18 Commandes En Attente",
    tabsBefore: ["WhatsApp (14)", "MP Instagram (28)", "Commentaires FB", "Tableau Excel Commandes.xlsx", "Capture Vodafone Cash.jpg"],
    q1Title: "❌ Commentaires Instagram Sans Réponse",
    q1: "\"Ça fait 5h que je demande le prix sans réponse ! Annulez ma commande !\"",
    q2: "\"J'ai envoyé la capture InstaPay ce matin, j'attends toujours.\"",
    wastedTitle: "4+ Heures Perdues / Jour",
    wastedDesc: "Copier-coller les prix, vérifier les captures bancaires manuellement et perdre des clients face à des concurrents plus rapides.",
    afterBadge: "Avec Sellora • Pilote Auto 24/7",
    afterTime: "● Canaux Synchronisés en Direct",
    replySpeed: "⚡ Réponse en 0,8 Seconde",
    tabsAfter: ["✅ WhatsApp VIP (Actif)", "✅ Auto-DM Instagram", "✅ Catalogue Shopify Synchro", "✅ Paymob & InstaPay Vérifié"],
    liveTitle: "✨ Conversions IA en Direct (Aujourd'hui)",
    liveRate: "+100% Taux de Réponse",
    o1Title: "Commande #1084 • Omar Khaled",
    o1Sub: "Paiement InstaPay vérifié automatiquement",
    o2Title: "Commande #1085 • Sara Ahmed",
    o2Sub: "Taille 38 Shopify réservée • Lien Paymob envoyé",
    closedTitle: "Conclu Aujourd'hui (Zéro Intervention Humaine)",
    currency: "EGP",
    savedWeek: "🚀 +28h Gagnées Cette Semaine",
    footerTip: "💡 Comparateur Interactif : Glissez le curseur pour voir la différence de productivité avec Sellora.",
  },
};

export default function BeforeAfterScrubber() {
  const [sliderPos, setSliderPos] = useState(50); // percentage 0 to 100
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  const { lang, dir } = useLanguage();
  const d = DICT[lang] || DICT.en;

  const handleMove = (clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pos = Math.max(5, Math.min(95, (x / rect.width) * 100));
    setSliderPos(pos);
  };

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  };

  const handleTouchMove = (e) => {
    if (e.touches && e.touches[0]) {
      handleMove(e.touches[0].clientX);
    }
  };

  return (
    <div className="scrubber-wrapper" style={{ maxWidth: "1000px", margin: "0 auto", direction: dir }}>
      <div
        ref={containerRef}
        className="scrubber-container"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchMove={handleTouchMove}
        style={{ height: "460px", cursor: isDragging ? "ew-resize" : "default" }}
      >
        {/* ================= LEFT PANEL (BEFORE: MANUAL CHAOS) ================= */}
        <div className="scrubber-panel before" style={{ width: "100%", padding: "32px", textAlign: dir === "rtl" ? "right" : "left" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              <span style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", padding: "6px 14px", borderRadius: "8px", fontWeight: 700, fontSize: "12px", border: "1px solid rgba(239, 68, 68, 0.3)", display: "flex", alignItems: "center", gap: "6px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                <AlertTriangle size={14} /> {d.beforeBadge}
              </span>
              <span style={{ color: "#64748b", fontSize: "12px" }}>{d.beforeTime}</span>
            </div>
            <span style={{ color: "#ef4444", fontWeight: 700, fontSize: "14px" }}>{d.beforeAlert}</span>
          </div>

          {/* Messy tabs simulation */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", overflowX: "hidden", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
            {d.tabsBefore.map((tab, i) => (
              <div key={i} style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(239, 68, 68, 0.2)", padding: "6px 12px", borderRadius: "6px", fontSize: "11px", color: "#fca5a5", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "6px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                <XCircle size={10} /> {tab}
              </div>
            ))}
          </div>

          {/* Chaos Chat / Spreadsheet */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", flex: 1 }}>
            <div style={{ background: "rgba(0, 0, 0, 0.5)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ fontSize: "11px", color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "8px" }}>{d.q1Title}</div>
              <div style={{ fontSize: "12px", color: "#f87171", background: "rgba(239, 68, 68, 0.1)", padding: "10px", borderRadius: "8px", direction: dir }}>
                {d.q1}
              </div>
              <div style={{ fontSize: "12px", color: "#f87171", background: "rgba(239, 68, 68, 0.1)", padding: "10px", borderRadius: "8px", direction: dir }}>
                {d.q2}
              </div>
            </div>

            <div style={{ background: "rgba(0, 0, 0, 0.5)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "12px" }}>
                <Clock size={24} />
              </div>
              <h4 style={{ color: "#fff", fontSize: "15px", marginBottom: "6px" }}>{d.wastedTitle}</h4>
              <p style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.5 }}>
                {d.wastedDesc}
              </p>
            </div>
          </div>
        </div>

        {/* ================= RIGHT PANEL (AFTER: SELLORA AUTO-PILOT) ================= */}
        <div
          className="scrubber-panel after"
          style={{
            width: `${sliderPos}%`,
            padding: "32px",
            borderRight: dir === "rtl" ? "none" : "1px solid rgba(99, 102, 241, 0.4)",
            borderLeft: dir === "rtl" ? "1px solid rgba(99, 102, 241, 0.4)" : "none",
            textAlign: dir === "rtl" ? "right" : "left",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", width: "936px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              <span style={{ background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", padding: "6px 14px", borderRadius: "8px", fontWeight: 700, fontSize: "12px", display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                <CheckCircle size={14} /> {d.afterBadge}
              </span>
              <span style={{ color: "#34d399", fontSize: "12px", fontWeight: 600 }}>{d.afterTime}</span>
            </div>
            <span style={{ background: "rgba(99, 102, 241, 0.2)", color: "#818cf8", padding: "6px 14px", borderRadius: "20px", fontWeight: 700, fontSize: "12px", border: "1px solid rgba(99, 102, 241, 0.4)" }}>
              {d.replySpeed}
            </span>
          </div>

          {/* Clean Unified Tabs */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "16px", width: "936px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
            {d.tabsAfter.map((tab, i) => (
              <div key={i} style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "6px 14px", borderRadius: "6px", fontSize: "11.5px", color: "#34d399", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                {tab}
              </div>
            ))}
          </div>

          {/* Pristine Automated Dashboard */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", flex: 1, width: "936px" }}>
            <div style={{ background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(99, 102, 241, 0.25)", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px", boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                <span style={{ fontSize: "11px", color: "#818cf8", fontWeight: 600 }}>{d.liveTitle}</span>
                <span style={{ fontSize: "11px", color: "#34d399", fontWeight: 700 }}>{d.liveRate}</span>
              </div>
              <div style={{ fontSize: "12px", color: "#e2e8f0", background: "rgba(99, 102, 241, 0.1)", padding: "10px", borderRadius: "8px", borderLeft: dir === "rtl" ? "none" : "3px solid #6366f1", borderRight: dir === "rtl" ? "3px solid #6366f1" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                <div>
                  <strong style={{ color: "#fff", display: "block" }}>{d.o1Title}</strong>
                  <span style={{ fontSize: "11px", color: "#94a3b8" }}>{d.o1Sub}</span>
                </div>
                <span style={{ background: "#10b981", color: "#fff", padding: "4px 8px", borderRadius: "6px", fontWeight: 700, fontSize: "11px" }}>+650 {d.currency}</span>
              </div>
              <div style={{ fontSize: "12px", color: "#e2e8f0", background: "rgba(99, 102, 241, 0.1)", padding: "10px", borderRadius: "8px", borderLeft: dir === "rtl" ? "none" : "3px solid #6366f1", borderRight: dir === "rtl" ? "3px solid #6366f1" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                <div>
                  <strong style={{ color: "#fff", display: "block" }}>{d.o2Title}</strong>
                  <span style={{ fontSize: "11px", color: "#94a3b8" }}>{d.o2Sub}</span>
                </div>
                <span style={{ background: "#10b981", color: "#fff", padding: "4px 8px", borderRadius: "6px", fontWeight: 700, fontSize: "11px" }}>+1,200 {d.currency}</span>
              </div>
            </div>

            <div style={{ background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(16, 185, 129, 0.1) 100%)", border: "1px solid rgba(99, 102, 241, 0.3)", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
              <div style={{ fontSize: "13px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                {d.closedTitle}
              </div>
              <div style={{ fontSize: "36px", fontWeight: 900, color: "#fff", textShadow: "0 0 20px rgba(99, 102, 241, 0.5)", marginBottom: "8px" }}>
                42,500 <span style={{ fontSize: "18px", color: "#818cf8" }}>{d.currency}</span>
              </div>
              <div style={{ fontSize: "12px", color: "#34d399", background: "rgba(16, 185, 129, 0.2)", padding: "6px 14px", borderRadius: "20px", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                {d.savedWeek}
              </div>
            </div>
          </div>
        </div>

        {/* ================= DRAG HANDLE ================= */}
        <div
          className="scrubber-handle"
          style={{ left: `${sliderPos}%` }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
        >
          <div className="scrubber-button">
            ↔
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: "14px", fontSize: "12px", color: "#64748b" }}>
        {d.footerTip}
      </div>
    </div>
  );
}
