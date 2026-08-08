"use client";

import React, { useState, useRef, useEffect } from "react";
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
  const [mobileView, setMobileView] = useState("before"); // 'before' | 'after'
  const [windowWidth, setWindowWidth] = useState(1024);
  const containerRef = useRef(null);
  const { lang, dir } = useLanguage();
  const d = DICT[lang] || DICT.en;

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = windowWidth < 768;

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
    <div className="scrubber-wrapper" style={{ maxWidth: "1000px", margin: "0 auto", direction: dir, padding: isMobile ? "0 16px" : "0" }}>
      
      {/* Mobile Tab Switcher */}
      {isMobile && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, borderRadius: 12, background: "rgba(255,255,255,0.04)", padding: 4, border: "1px solid rgba(255,255,255,0.08)" }}>
          <button
            onClick={() => setMobileView("before")}
            style={{ flex: 1, padding: "10px", borderRadius: 9, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", background: mobileView === "before" ? "rgba(239,68,68,0.2)" : "transparent", color: mobileView === "before" ? "#f87171" : "#64748b", transition: "all 0.2s" }}
          >
            ❌ Without Sellora
          </button>
          <button
            onClick={() => setMobileView("after")}
            style={{ flex: 1, padding: "10px", borderRadius: 9, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", background: mobileView === "after" ? "rgba(16,185,129,0.2)" : "transparent", color: mobileView === "after" ? "#34d399" : "#64748b", transition: "all 0.2s" }}
          >
            ✅ With Sellora
          </button>
        </div>
      )}

      {/* Desktop Scrubber */}
      {!isMobile ? (
        <div
          ref={containerRef}
          className="scrubber-container"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchMove={handleTouchMove}
          style={{ height: "460px", cursor: isDragging ? "ew-resize" : "default" }}
        >
          {/* LEFT PANEL (BEFORE) */}
          <div className="scrubber-panel before" style={{ width: "100%", padding: "32px", textAlign: dir === "rtl" ? "right" : "left" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                <span style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", padding: "6px 14px", borderRadius: "8px", fontWeight: 700, fontSize: "12px", border: "1px solid rgba(239,68,68,0.3)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <AlertTriangle size={14} /> {d.beforeBadge}
                </span>
                <span style={{ color: "#64748b", fontSize: "12px" }}>{d.beforeTime}</span>
              </div>
              <span style={{ color: "#ef4444", fontWeight: 700, fontSize: "14px" }}>{d.beforeAlert}</span>
            </div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px", overflow: "hidden", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              {d.tabsBefore.map((tab, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(239,68,68,0.2)", padding: "6px 12px", borderRadius: "6px", fontSize: "11px", color: "#fca5a5", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "6px" }}>
                  <XCircle size={10} /> {tab}
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ fontSize: "11px", color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "8px" }}>{d.q1Title}</div>
                <div style={{ fontSize: "12px", color: "#f87171", background: "rgba(239,68,68,0.1)", padding: "10px", borderRadius: "8px" }}>{d.q1}</div>
                <div style={{ fontSize: "12px", color: "#f87171", background: "rgba(239,68,68,0.1)", padding: "10px", borderRadius: "8px" }}>{d.q2}</div>
              </div>
              <div style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(239,68,68,0.15)", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><Clock size={24} /></div>
                <h4 style={{ color: "#fff", fontSize: "15px", marginBottom: 6 }}>{d.wastedTitle}</h4>
                <p style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.5 }}>{d.wastedDesc}</p>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL (AFTER) */}
          <div
            className="scrubber-panel after"
            style={{ width: `${sliderPos}%`, padding: "32px", borderRight: dir === "rtl" ? "none" : "1px solid rgba(99,102,241,0.4)", borderLeft: dir === "rtl" ? "1px solid rgba(99,102,241,0.4)" : "none", textAlign: dir === "rtl" ? "right" : "left", overflow: "hidden" }}
          >
            <div style={{ minWidth: "600px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                  <span style={{ background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", padding: "6px 14px", borderRadius: "8px", fontWeight: 700, fontSize: "12px", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 4px 12px rgba(16,185,129,0.3)" }}>
                    <CheckCircle size={14} /> {d.afterBadge}
                  </span>
                  <span style={{ color: "#34d399", fontSize: "12px", fontWeight: 600 }}>{d.afterTime}</span>
                </div>
                <span style={{ background: "rgba(99,102,241,0.2)", color: "#818cf8", padding: "6px 14px", borderRadius: "20px", fontWeight: 700, fontSize: "12px", border: "1px solid rgba(99,102,241,0.4)", whiteSpace: "nowrap" }}>{d.replySpeed}</span>
              </div>
              <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexDirection: dir === "rtl" ? "row-reverse" : "row", flexWrap: "wrap" }}>
                {d.tabsAfter.map((tab, i) => (
                  <div key={i} style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", padding: "6px 14px", borderRadius: "6px", fontSize: "11.5px", color: "#34d399", fontWeight: 600 }}>{tab}</div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 8, flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                    <span style={{ fontSize: "11px", color: "#818cf8", fontWeight: 600 }}>{d.liveTitle}</span>
                    <span style={{ fontSize: "11px", color: "#34d399", fontWeight: 700 }}>{d.liveRate}</span>
                  </div>
                  {[{ title: d.o1Title, sub: d.o1Sub, val: `+650 ${d.currency}` }, { title: d.o2Title, sub: d.o2Sub, val: `+1,200 ${d.currency}` }].map((order, i) => (
                    <div key={i} style={{ fontSize: "12px", color: "#e2e8f0", background: "rgba(99,102,241,0.1)", padding: "10px", borderRadius: "8px", borderLeft: dir === "rtl" ? "none" : "3px solid #6366f1", borderRight: dir === "rtl" ? "3px solid #6366f1" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", flexDirection: dir === "rtl" ? "row-reverse" : "row", gap: 8 }}>
                      <div><strong style={{ color: "#fff", display: "block" }}>{order.title}</strong><span style={{ fontSize: "11px", color: "#94a3b8" }}>{order.sub}</span></div>
                      <span style={{ background: "#10b981", color: "#fff", padding: "4px 8px", borderRadius: 6, fontWeight: 700, fontSize: 11, whiteSpace: "nowrap" }}>{order.val}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.15),rgba(16,185,129,0.1))", border: "1px solid rgba(99,102,241,0.3)", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
                  <div style={{ fontSize: "13px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{d.closedTitle}</div>
                  <div style={{ fontSize: "36px", fontWeight: 900, color: "#fff", textShadow: "0 0 20px rgba(99,102,241,0.5)", marginBottom: 8 }}>42,500 <span style={{ fontSize: 18, color: "#818cf8" }}>{d.currency}</span></div>
                  <div style={{ fontSize: "12px", color: "#34d399", background: "rgba(16,185,129,0.2)", padding: "6px 14px", borderRadius: 20, fontWeight: 700 }}>{d.savedWeek}</div>
                </div>
              </div>
            </div>
          </div>

          {/* DRAG HANDLE */}
          <div className="scrubber-handle" style={{ left: `${sliderPos}%` }} onMouseDown={handleMouseDown} onTouchStart={handleMouseDown}>
            <div className="scrubber-button">↔</div>
          </div>
        </div>
      ) : (
        /* Mobile stacked view */
        <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
          {mobileView === "before" ? (
            <div style={{ background: "#151012", padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                <span style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", padding: "5px 12px", borderRadius: 8, fontWeight: 700, fontSize: 11, border: "1px solid rgba(239,68,68,0.3)", display: "flex", alignItems: "center", gap: 5 }}>
                  <AlertTriangle size={12} /> {d.beforeBadge}
                </span>
                <span style={{ color: "#ef4444", fontWeight: 700, fontSize: 12 }}>{d.beforeAlert}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>{d.q1Title}</div>
                  <div style={{ fontSize: 13, color: "#f87171", background: "rgba(239,68,68,0.1)", padding: 10, borderRadius: 8, marginBottom: 8 }}>{d.q1}</div>
                  <div style={{ fontSize: 13, color: "#f87171", background: "rgba(239,68,68,0.1)", padding: 10, borderRadius: 8 }}>{d.q2}</div>
                </div>
                <div style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 14, display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(239,68,68,0.15)", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Clock size={20} /></div>
                  <div><h4 style={{ color: "#fff", fontSize: 14, marginBottom: 4 }}>{d.wastedTitle}</h4><p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{d.wastedDesc}</p></div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ background: "radial-gradient(circle at 100% 0%,rgba(99,102,241,0.15),transparent 50%),#0b0c10", padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                <span style={{ background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", padding: "5px 12px", borderRadius: 8, fontWeight: 700, fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}>
                  <CheckCircle size={12} /> {d.afterBadge}
                </span>
                <span style={{ background: "rgba(99,102,241,0.2)", color: "#818cf8", padding: "5px 12px", borderRadius: 20, fontWeight: 700, fontSize: 11, border: "1px solid rgba(99,102,241,0.4)" }}>{d.replySpeed}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 12, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 11, color: "#818cf8", fontWeight: 600 }}>{d.liveTitle}</span>
                    <span style={{ fontSize: 11, color: "#34d399", fontWeight: 700 }}>{d.liveRate}</span>
                  </div>
                  {[{ title: d.o1Title, sub: d.o1Sub, val: `+650 ${d.currency}` }, { title: d.o2Title, sub: d.o2Sub, val: `+1,200 ${d.currency}` }].map((order, i) => (
                    <div key={i} style={{ fontSize: 12, color: "#e2e8f0", background: "rgba(99,102,241,0.1)", padding: 10, borderRadius: 8, borderLeft: "3px solid #6366f1", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: i === 0 ? 8 : 0 }}>
                      <div><strong style={{ color: "#fff", display: "block", fontSize: 12 }}>{order.title}</strong><span style={{ fontSize: 11, color: "#94a3b8" }}>{order.sub}</span></div>
                      <span style={{ background: "#10b981", color: "#fff", padding: "3px 7px", borderRadius: 6, fontWeight: 700, fontSize: 11, whiteSpace: "nowrap" }}>{order.val}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.15),rgba(16,185,129,0.1))", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 12, padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{d.closedTitle}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", marginBottom: 8 }}>42,500 <span style={{ fontSize: 15, color: "#818cf8" }}>{d.currency}</span></div>
                  <div style={{ fontSize: 12, color: "#34d399", background: "rgba(16,185,129,0.2)", padding: "5px 12px", borderRadius: 20, fontWeight: 700, display: "inline-block" }}>{d.savedWeek}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: "14px", fontSize: "12px", color: "#64748b", padding: isMobile ? "0 4px" : "0" }}>
        {isMobile ? "Tap the tabs above to compare" : d.footerTip}
      </div>
    </div>
  );
}
