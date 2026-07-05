"use client";

import React, { useState } from "react";
import { Calculator, Clock, DollarSign, TrendingUp, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import "./landing.css";

export default function ROICalculator() {
  const [dailyDMs, setDailyDMs] = useState(250);
  const [avgOrderValue, setAvgOrderValue] = useState(650);
  const [manualHours, setManualHours] = useState(4);

  // Calculations
  const weeklyHoursSaved = Math.round(dailyDMs * 0.08 * 7);
  const monthlyRecoveredRevenue = Math.round(dailyDMs * 30 * 0.12 * avgOrderValue);
  const revenueLiftPercent = Math.min(65, Math.round(18 + (dailyDMs / 100) * 4));

  return (
    <div className="designer-card" style={{ maxWidth: "1050px", margin: "0 auto", padding: "40px" }}>
      <div style={{ textAlign: "center", marginBottom: "36px" }}>
        <span className="designer-badge" style={{ marginBottom: "12px" }}>
          <span className="dot" /> Interactive ROI Calculator
        </span>
        <h3 style={{ fontSize: "32px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>
          See How Much <span style={{ color: "#34d399" }}>Time & Revenue</span> You&apos;re Losing Today.
        </h3>
        <p style={{ fontSize: "14.5px", color: "#94a3b8", maxWidth: "620px", margin: "0 auto", lineHeight: 1.6 }}>
          Manual DM answering isn&apos;t just tiring—it causes 40% of customers to buy elsewhere while waiting for a reply. Adjust the sliders below to calculate your estimated return with Sellora.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "32px", alignItems: "center" }}>
        {/* ================= LEFT COLUMN: SLIDERS ================= */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Slider 1: Daily DMs */}
          <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.06)", borderRadius: "14px", padding: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontSize: "13.5px", fontWeight: 600, color: "#e2e8f0" }}>Daily Incoming Messages & DMs:</span>
              <span style={{ fontSize: "18px", fontWeight: 800, color: "#818cf8", background: "rgba(99, 102, 241, 0.15)", padding: "4px 12px", borderRadius: "8px" }}>
                {dailyDMs} DMs/day
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
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748b" }}>
              <span>50 (Small Store)</span>
              <span>500 (Growth Brand)</span>
              <span>1,500+ (High Volume)</span>
            </div>
          </div>

          {/* Slider 2: AOV */}
          <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.06)", borderRadius: "14px", padding: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontSize: "13.5px", fontWeight: 600, color: "#e2e8f0" }}>Average Order Value (EGP):</span>
              <span style={{ fontSize: "18px", fontWeight: 800, color: "#34d399", background: "rgba(16, 185, 129, 0.15)", padding: "4px 12px", borderRadius: "8px" }}>
                {avgOrderValue.toLocaleString()} EGP
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
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748b" }}>
              <span>150 EGP (Accessories)</span>
              <span>800 EGP (Fashion/Beauty)</span>
              <span>4,000+ EGP (Electronics)</span>
            </div>
          </div>

          {/* Slider 3: Manual Hours */}
          <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.06)", borderRadius: "14px", padding: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontSize: "13.5px", fontWeight: 600, color: "#e2e8f0" }}>Current Manual Replying Time / Day:</span>
              <span style={{ fontSize: "18px", fontWeight: 800, color: "#f59e0b", background: "rgba(245, 158, 11, 0.15)", padding: "4px 12px", borderRadius: "8px" }}>
                {manualHours} Hours/day
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
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748b" }}>
              <span>1 Hour</span>
              <span>5 Hours (Part-time Mod)</span>
              <span>12+ Hours (2 Shifts)</span>
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: LIVE COMPUTED RETURN ================= */}
        <div style={{ background: "linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 27, 75, 0.9) 100%)", border: "1px solid rgba(99, 102, 241, 0.4)", borderRadius: "20px", padding: "28px", display: "flex", flexDirection: "column", gap: "20px", boxShadow: "0 25px 60px rgba(0,0,0,0.6)" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: "6px" }}>
            <Sparkles size={14} /> YOUR ESTIMATED MONTHLY SELLORA RETURN
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Metric 1 */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "rgba(16, 185, 129, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#34d399" }}>
                  <DollarSign size={20} />
                </div>
                <div>
                  <div style={{ fontSize: "11.5px", color: "#94a3b8" }}>Recovered Abandoned Carts / Mo</div>
                  <div style={{ fontSize: "22px", fontWeight: 900, color: "#fff" }}>
                    +{monthlyRecoveredRevenue.toLocaleString()} <span style={{ fontSize: "13px", color: "#34d399" }}>EGP</span>
                  </div>
                </div>
              </div>
              <span style={{ fontSize: "11px", fontWeight: 700, background: "rgba(16, 185, 129, 0.15)", color: "#34d399", padding: "4px 8px", borderRadius: "6px" }}>
                +{revenueLiftPercent}% Lift
              </span>
            </div>

            {/* Metric 2 */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "rgba(99, 102, 241, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#818cf8" }}>
                  <Clock size={20} />
                </div>
                <div>
                  <div style={{ fontSize: "11.5px", color: "#94a3b8" }}>Time Reclaimed Every Week</div>
                  <div style={{ fontSize: "22px", fontWeight: 900, color: "#fff" }}>
                    {weeklyHoursSaved} <span style={{ fontSize: "13px", color: "#818cf8" }}>Hours/week</span>
                  </div>
                </div>
              </div>
              <span style={{ fontSize: "11px", fontWeight: 700, background: "rgba(99, 102, 241, 0.15)", color: "#818cf8", padding: "4px 8px", borderRadius: "6px" }}>
                100% Automated
              </span>
            </div>
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <a href="/signup" className="btn-designer-primary" style={{ width: "100%", padding: "16px" }}>
              Start 14-Day Free Trial Now <ArrowRight size={18} />
            </a>
            <div style={{ fontSize: "11px", color: "#94a3b8", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              <ShieldCheck size={14} color="#10b981" /> No credit card required • Cancel anytime in 1 click
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
