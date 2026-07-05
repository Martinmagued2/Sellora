"use client";

import React, { useState } from "react";
import { Calculator, Clock, DollarSign, TrendingUp, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import "./landing.css";

const DICT = {
  en: {
    badge: "Interactive ROI Calculator",
    title1: "See How Much",
    title2: "Time & Revenue",
    title3: "You're Losing Today.",
    subtitle: "Manual DM answering isn't just tiring—it causes 40% of customers to buy elsewhere while waiting for a reply. Adjust the sliders below to calculate your estimated return with Sellora.",
    s1Label: "Daily Incoming Messages & DMs:",
    s1Unit: "DMs/day",
    s1Sub1: "50 (Small Store)",
    s1Sub2: "500 (Growth Brand)",
    s1Sub3: "1,500+ (High Volume)",
    s2Label: "Average Order Value (EGP):",
    s2Unit: "EGP",
    s2Sub1: "150 EGP (Accessories)",
    s2Sub2: "800 EGP (Fashion)",
    s2Sub3: "4,000+ EGP (Tech)",
    s3Label: "Current Manual Replying Time / Day:",
    s3Unit: "Hours/day",
    s3Sub1: "1 Hour",
    s3Sub2: "5 Hours (Part-time)",
    s3Sub3: "12+ Hours (2 Shifts)",
    returnTitle: "YOUR ESTIMATED MONTHLY SELLORA RETURN",
    r1Label: "Recovered Abandoned Carts / Mo",
    r1Unit: "EGP",
    r1Lift: "% Lift",
    r2Label: "Time Reclaimed Every Week",
    r2Unit: "Hours/week",
    r2Auto: "100% Automated",
    cta: "Start 14-Day Free Trial Now",
    trust: "No credit card required • Cancel anytime in 1 click",
  },
  ar: {
    badge: "حاسبة العائد على الاستثمار التفاعلية",
    title1: "اكتشف كم من",
    title2: "الوقت والمبيعات",
    title3: "تخسره يومياً بدون Sellora.",
    subtitle: "الرد اليدوي على الرسائل ليس مرهقاً فقط—بل يسبب خسارة 40% من العملاء الذين يشترون من منافسين أثناء انتظارهم للرد. حرك المؤشرات أدناه لحساب عائدك المتوقع مع Sellora.",
    s1Label: "عدد الاستفسارات والرسائل اليومية:",
    s1Unit: "رسالة/يوم",
    s1Sub1: "50 (متجر ناشئ)",
    s1Sub2: "500 (علامة نمو)",
    s1Sub3: "1,500+ (حجم ضخم)",
    s2Label: "متوسط قيمة الأوردر الواحد (ج.م):",
    s2Unit: "ج.م",
    s2Sub1: "150 ج.م (إكسسوارات)",
    s2Sub2: "800 ج.م (أزياء وموضة)",
    s2Sub3: "4,000+ ج.م (إلكترونيات)",
    s3Label: "الوقت المستهلك في الرد اليدوي يومياً:",
    s3Unit: "ساعة/يوم",
    s3Sub1: "1 ساعة",
    s3Sub2: "5 ساعات (دوام جزئي)",
    s3Sub3: "12+ ساعة (شيفتين)",
    returnTitle: "عائدك الشهري المتوقع مع نظام SELLORA",
    r1Label: "مبيعات السلات المهجورة المستردة / شهر",
    r1Unit: "ج.م",
    r1Lift: "% زيادة مبيعات",
    r2Label: "الوقت المسترد والموفر أسبوعياً",
    r2Unit: "ساعة/أسبوع",
    r2Auto: "أتمتة كاملة 100%",
    cta: "ابدأ تجربتك المجانية 14 يوم الآن",
    trust: "بدون بطاقة ائتمانية • إلغاء في أي وقت بضغطة زر",
  },
  fr: {
    badge: "Calculateur de ROI Interactif",
    title1: "Découvrez Combien de",
    title2: "Temps & Revenus",
    title3: "Vous Perdez Aujourd'hui.",
    subtitle: "Répondre manuellement n'est pas seulement épuisant — cela pousse 40% des clients à acheter ailleurs en attendant une réponse. Ajustez les curseurs ci-dessous pour estimer votre gain avec Sellora.",
    s1Label: "Messages et MP Reçus / Jour :",
    s1Unit: "MP/jour",
    s1Sub1: "50 (Petit Boutique)",
    s1Sub2: "500 (Marque en Croissance)",
    s1Sub3: "1 500+ (Gros Volume)",
    s2Label: "Panier Moyen par Commande (EGP) :",
    s2Unit: "EGP",
    s2Sub1: "150 EGP (Accessoires)",
    s2Sub2: "800 EGP (Mode/Beauté)",
    s2Sub3: "4 000+ EGP (High-Tech)",
    s3Label: "Temps Actuel Passé à Répondre / Jour :",
    s3Unit: "Heures/jour",
    s3Sub1: "1 Heure",
    s3Sub2: "5 Heures (Mi-temps)",
    s3Sub3: "12+ Heures (2 Équipes)",
    returnTitle: "VOTRE RETOUR SUR INVESTISSEMENT ESTIMÉ",
    r1Label: "Paniers Abandonnés Récupérés / Mois",
    r1Unit: "EGP",
    r1Lift: "% de Croissance",
    r2Label: "Temps Gagné Chaque Semaine",
    r2Unit: "Heures/semaine",
    r2Auto: "100% Automatisé",
    cta: "Démarrer l'Essai Gratuit de 14 Jours",
    trust: "Sans carte de crédit • Annulation en 1 clic à tout moment",
  },
};

export default function ROICalculator() {
  const { lang, dir } = useLanguage();
  const d = DICT[lang] || DICT.en;

  const [dailyDMs, setDailyDMs] = useState(250);
  const [avgOrderValue, setAvgOrderValue] = useState(650);
  const [manualHours, setManualHours] = useState(4);

  // Calculations
  const weeklyHoursSaved = Math.round(dailyDMs * 0.08 * 7);
  const monthlyRecoveredRevenue = Math.round(dailyDMs * 30 * 0.12 * avgOrderValue);
  const revenueLiftPercent = Math.min(65, Math.round(18 + (dailyDMs / 100) * 4));

  return (
    <div className="designer-card" style={{ maxWidth: "1050px", margin: "0 auto", padding: "40px", direction: dir }}>
      <div style={{ textAlign: "center", marginBottom: "36px" }}>
        <span className="designer-badge" style={{ marginBottom: "12px" }}>
          <span className="dot" /> {d.badge}
        </span>
        <h3 style={{ fontSize: "32px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>
          {d.title1} <span style={{ color: "#34d399" }}>{d.title2}</span> {d.title3}
        </h3>
        <p style={{ fontSize: "14.5px", color: "#94a3b8", maxWidth: "620px", margin: "0 auto", lineHeight: 1.6 }}>
          {d.subtitle}
        </p>
      </div>

      <div className="roi-grid">
        {/* ================= LEFT COLUMN: SLIDERS ================= */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", textAlign: dir === "rtl" ? "right" : "left" }}>
          {/* Slider 1: Daily DMs */}
          <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.06)", borderRadius: "14px", padding: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              <span style={{ fontSize: "13.5px", fontWeight: 600, color: "#e2e8f0" }}>{d.s1Label}</span>
              <span style={{ fontSize: "18px", fontWeight: 800, color: "#818cf8", background: "rgba(99, 102, 241, 0.15)", padding: "4px 12px", borderRadius: "8px" }}>
                {dailyDMs} {d.s1Unit}
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="1500"
              step="25"
              value={dailyDMs}
              onChange={(e) => setDailyDMs(Number(e.target.value))}
              className="slider-input"
              style={{ direction: dir }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748b", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              <span>{d.s1Sub1}</span>
              <span>{d.s1Sub2}</span>
              <span>{d.s1Sub3}</span>
            </div>
          </div>

          {/* Slider 2: AOV */}
          <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.06)", borderRadius: "14px", padding: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              <span style={{ fontSize: "13.5px", fontWeight: 600, color: "#e2e8f0" }}>{d.s2Label}</span>
              <span style={{ fontSize: "18px", fontWeight: 800, color: "#34d399", background: "rgba(16, 185, 129, 0.15)", padding: "4px 12px", borderRadius: "8px" }}>
                {avgOrderValue.toLocaleString()} {d.s2Unit}
              </span>
            </div>
            <input
              type="range"
              min="150"
              max="4000"
              step="50"
              value={avgOrderValue}
              onChange={(e) => setAvgOrderValue(Number(e.target.value))}
              className="slider-input"
              style={{ direction: dir }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748b", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              <span>{d.s2Sub1}</span>
              <span>{d.s2Sub2}</span>
              <span>{d.s2Sub3}</span>
            </div>
          </div>

          {/* Slider 3: Manual Hours */}
          <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.06)", borderRadius: "14px", padding: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              <span style={{ fontSize: "13.5px", fontWeight: 600, color: "#e2e8f0" }}>{d.s3Label}</span>
              <span style={{ fontSize: "18px", fontWeight: 800, color: "#f59e0b", background: "rgba(245, 158, 11, 0.15)", padding: "4px 12px", borderRadius: "8px" }}>
                {manualHours} {d.s3Unit}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="12"
              step="0.5"
              value={manualHours}
              onChange={(e) => setManualHours(Number(e.target.value))}
              className="slider-input"
              style={{ direction: dir }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748b", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              <span>{d.s3Sub1}</span>
              <span>{d.s3Sub2}</span>
              <span>{d.s3Sub3}</span>
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: LIVE COMPUTED RETURN ================= */}
        <div style={{ background: "linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 27, 75, 0.9) 100%)", border: "1px solid rgba(99, 102, 241, 0.4)", borderRadius: "20px", padding: "28px", display: "flex", flexDirection: "column", gap: "20px", boxShadow: "0 25px 60px rgba(0,0,0,0.6)", textAlign: dir === "rtl" ? "right" : "left" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: "6px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
            <Sparkles size={14} /> {d.returnTitle}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Metric 1 */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "14px", display: "flex", alignItems: "center", justifyContent: "space-between", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "rgba(16, 185, 129, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#34d399" }}>
                  <DollarSign size={20} />
                </div>
                <div>
                  <div style={{ fontSize: "11.5px", color: "#94a3b8" }}>{d.r1Label}</div>
                  <div style={{ fontSize: "22px", fontWeight: 900, color: "#fff" }}>
                    +{monthlyRecoveredRevenue.toLocaleString()} <span style={{ fontSize: "13px", color: "#34d399" }}>{d.r1Unit}</span>
                  </div>
                </div>
              </div>
              <span style={{ fontSize: "11px", fontWeight: 700, background: "rgba(16, 185, 129, 0.15)", color: "#34d399", padding: "4px 8px", borderRadius: "6px" }}>
                +{revenueLiftPercent}{d.r1Lift}
              </span>
            </div>

            {/* Metric 2 */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "14px", display: "flex", alignItems: "center", justifyContent: "space-between", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "rgba(99, 102, 241, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#818cf8" }}>
                  <Clock size={20} />
                </div>
                <div>
                  <div style={{ fontSize: "11.5px", color: "#94a3b8" }}>{d.r2Label}</div>
                  <div style={{ fontSize: "22px", fontWeight: 900, color: "#fff" }}>
                    {weeklyHoursSaved} <span style={{ fontSize: "13px", color: "#818cf8" }}>{d.r2Unit}</span>
                  </div>
                </div>
              </div>
              <span style={{ fontSize: "11px", fontWeight: 700, background: "rgba(99, 102, 241, 0.15)", color: "#818cf8", padding: "4px 8px", borderRadius: "6px" }}>
                {d.r2Auto}
              </span>
            </div>
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <a href="/signup" className="btn-designer-primary" style={{ width: "100%", padding: "16px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              {d.cta} <ArrowRight size={18} style={{ transform: dir === "rtl" ? "rotate(180deg)" : "none" }} />
            </a>
            <div style={{ fontSize: "11px", color: "#94a3b8", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              <ShieldCheck size={14} color="#10b981" /> {d.trust}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
