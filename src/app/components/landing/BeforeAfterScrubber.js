"use client";

import React, { useState, useRef } from "react";
import { AlertTriangle, CheckCircle, Clock, Zap, MessageSquare, DollarSign, ArrowRight, XCircle } from "lucide-react";
import "./landing.css";

export default function BeforeAfterScrubber() {
  const [sliderPos, setSliderPos] = useState(50); // percentage 0 to 100
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

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
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
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
        <div className="scrubber-panel before" style={{ width: "100%", padding: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", padding: "6px 14px", borderRadius: "8px", fontWeight: 700, fontSize: "12px", border: "1px solid rgba(239, 68, 68, 0.3)", display: "flex", alignItems: "center", gap: "6px" }}>
                <AlertTriangle size={14} /> Without Sellora • The Manual Chaos
              </span>
              <span style={{ color: "#64748b", fontSize: "12px" }}>2:14 AM — Still Replying to DMs</span>
            </div>
            <span style={{ color: "#ef4444", fontWeight: 700, fontSize: "14px" }}>⚠️ 18 Unread Orders Pending</span>
          </div>

          {/* Messy tabs simulation */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", overflowX: "hidden" }}>
            {["WhatsApp (14)", "Instagram DMs (28)", "Facebook Comments", "Excel Order Spreadsheet.xlsx", "Vodafone Cash Screenshot.jpg"].map((tab, i) => (
              <div key={i} style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(239, 68, 68, 0.2)", padding: "6px 12px", borderRadius: "6px", fontSize: "11px", color: "#fca5a5", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "6px" }}>
                <XCircle size={10} /> {tab}
              </div>
            ))}
          </div>

          {/* Chaos Chat / Spreadsheet */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", flex: 1 }}>
            <div style={{ background: "rgba(0, 0, 0, 0.5)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ fontSize: "11px", color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "8px" }}>❌ Unanswered Instagram Comments</div>
              <div style={{ fontSize: "12px", color: "#f87171", background: "rgba(239, 68, 68, 0.1)", padding: "10px", borderRadius: "8px", direction: "rtl" }}>
                "بقالي 5 ساعات بسأل على السعر ومحدش بيرد! ألغوا الأوردر خلاص!"
              </div>
              <div style={{ fontSize: "12px", color: "#f87171", background: "rgba(239, 68, 68, 0.1)", padding: "10px", borderRadius: "8px", direction: "rtl" }}>
                "بعت سكرين شوت إنستاباي ومحدش أكدلي الحجز من الصبح."
              </div>
            </div>

            <div style={{ background: "rgba(0, 0, 0, 0.5)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "12px" }}>
                <Clock size={24} />
              </div>
              <h4 style={{ color: "#fff", fontSize: "15px", marginBottom: "6px" }}>4+ Hours Daily Wasted</h4>
              <p style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.5 }}>
                Copy-pasting prices, checking bank app screenshots manually, and losing customer sales to faster competitors.
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
            borderRight: "1px solid rgba(99, 102, 241, 0.4)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", width: "936px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", padding: "6px 14px", borderRadius: "8px", fontWeight: 700, fontSize: "12px", display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)" }}>
                <CheckCircle size={14} /> With Sellora • 24/7 AI Auto-Pilot
              </span>
              <span style={{ color: "#34d399", fontSize: "12px", fontWeight: 600 }}>● All Channels Auto-Synchronized</span>
            </div>
            <span style={{ background: "rgba(99, 102, 241, 0.2)", color: "#818cf8", padding: "6px 14px", borderRadius: "20px", fontWeight: 700, fontSize: "12px", border: "1px solid rgba(99, 102, 241, 0.4)" }}>
              ⚡ Avg Reply: 0.8 Seconds
            </span>
          </div>

          {/* Clean Unified Tabs */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "16px", width: "936px" }}>
            {["✅ WhatsApp VIP (Active)", "✅ Instagram Auto-DM", "✅ Shopify Live Catalog Sync", "✅ Paymob & InstaPay Verified"].map((tab, i) => (
              <div key={i} style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "6px 14px", borderRadius: "6px", fontSize: "11.5px", color: "#34d399", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                {tab}
              </div>
            ))}
          </div>

          {/* Pristine Automated Dashboard */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", flex: 1, width: "936px" }}>
            <div style={{ background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(99, 102, 241, 0.25)", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px", boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px" }}>
                <span style={{ fontSize: "11px", color: "#818cf8", fontWeight: 600 }}>✨ Live AI Conversions (Today)</span>
                <span style={{ fontSize: "11px", color: "#34d399", fontWeight: 700 }}>+100% Response Rate</span>
              </div>
              <div style={{ fontSize: "12px", color: "#e2e8f0", background: "rgba(99, 102, 241, 0.1)", padding: "10px", borderRadius: "8px", borderLeft: "3px solid #6366f1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ color: "#fff", display: "block" }}>Order #1084 • Omar Khaled</strong>
                  <span style={{ fontSize: "11px", color: "#94a3b8" }}>InstaPay Payment Verified Automatically</span>
                </div>
                <span style={{ background: "#10b981", color: "#fff", padding: "4px 8px", borderRadius: "6px", fontWeight: 700, fontSize: "11px" }}>+650 EGP</span>
              </div>
              <div style={{ fontSize: "12px", color: "#e2e8f0", background: "rgba(99, 102, 241, 0.1)", padding: "10px", borderRadius: "8px", borderLeft: "3px solid #6366f1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ color: "#fff", display: "block" }}>Order #1085 • Sara Ahmed</strong>
                  <span style={{ fontSize: "11px", color: "#94a3b8" }}>Shopify Size 38 Auto-Reserved • Paymob Link Sent</span>
                </div>
                <span style={{ background: "#10b981", color: "#fff", padding: "4px 8px", borderRadius: "6px", fontWeight: 700, fontSize: "11px" }}>+1,200 EGP</span>
              </div>
            </div>

            <div style={{ background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(16, 185, 129, 0.1) 100%)", border: "1px solid rgba(99, 102, 241, 0.3)", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
              <div style={{ fontSize: "13px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                Closed Today (Zero Human Intervention)
              </div>
              <div style={{ fontSize: "36px", fontWeight: 900, color: "#fff", textShadow: "0 0 20px rgba(99, 102, 241, 0.5)", marginBottom: "8px" }}>
                42,500 <span style={{ fontSize: "18px", color: "#818cf8" }}>EGP</span>
              </div>
              <div style={{ fontSize: "12px", color: "#34d399", background: "rgba(16, 185, 129, 0.2)", padding: "6px 14px", borderRadius: "20px", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                🚀 +28 Hours Saved This Week
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
        💡 <strong>Interactive Scrubber:</strong> Drag the divider back and forth to see the difference Sellora makes.
      </div>
    </div>
  );
}
