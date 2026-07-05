"use client";

import { Check, X, Loader2 } from "lucide-react";

/**
 * StatusPipeline — visual order status pipeline.
 * Shows Pending → Confirmed → Shipped → Delivered as connected dots.
 * Click any stage to advance. Cancelled shows a red X.
 *
 * Props:
 *   status: current status string
 *   onAdvance: (newStatus) => void
 *   size: 'sm' | 'md' | 'lg'
 */
const STAGES = [
  { key: "pending", label: "Pending", icon: "⏳", color: "#F8A532" },
  { key: "confirmed", label: "Confirmed", icon: "✓", color: "#5865F2" },
  { key: "shipped", label: "Shipped", icon: "📦", color: "#00D2FF" },
  { key: "delivered", label: "Delivered", icon: "🎉", color: "#3BA55C" },
];

export default function StatusPipeline({ status, onAdvance, size = "sm", loading }) {
  // Cancelled — show special state
  if (status === "cancelled") {
    return (
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: size === "sm" ? "4px 12px" : "6px 16px",
        borderRadius: 20, fontSize: size === "sm" ? 11 : 13, fontWeight: 700,
        background: "rgba(237,66,69,0.15)", color: "#ED4245",
        border: "1px solid rgba(237,66,69,0.3)",
      }}>
        <X size={size === "sm" ? 12 : 14} /> Cancelled
      </div>
    );
  }

  // Returned — show special state
  if (status === "returned") {
    return (
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: size === "sm" ? "4px 12px" : "6px 16px",
        borderRadius: 20, fontSize: size === "sm" ? 11 : 13, fontWeight: 700,
        background: "rgba(248,165,50,0.15)", color: "#F8A532",
        border: "1px solid rgba(248,165,50,0.3)",
      }}>
        ↩️ Returned
      </div>
    );
  }

  const currentIdx = STAGES.findIndex(s => s.key === status);
  const dotSize = size === "sm" ? 20 : size === "md" ? 28 : 36;
  const lineWidth = size === "sm" ? 16 : 24;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {STAGES.map((stage, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isFuture = idx > currentIdx;
        const canAdvance = onAdvance && idx > currentIdx && !loading;

        return (
          <div key={stage.key} style={{ display: "flex", alignItems: "center" }}>
            {/* Dot */}
            <button
              onClick={() => canAdvance && onAdvance(stage.key)}
              disabled={!canAdvance}
              title={canAdvance ? `Move to ${stage.label}` : stage.label}
              style={{
                width: dotSize, height: dotSize,
                borderRadius: "50%",
                border: "2px solid",
                borderColor: isCompleted || isCurrent ? stage.color : "rgba(255,255,255,0.15)",
                background: isCompleted ? stage.color : isCurrent ? stage.color + "20" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: canAdvance ? "pointer" : "default",
                transition: "all 0.2s ease",
                flexShrink: 0,
                padding: 0,
              }}
              onMouseEnter={(e) => {
                if (canAdvance) {
                  e.currentTarget.style.transform = "scale(1.15)";
                  e.currentTarget.style.background = stage.color;
                  e.currentTarget.style.borderColor = stage.color;
                }
              }}
              onMouseLeave={(e) => {
                if (canAdvance) {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
                }
              }}
            >
              {loading && isCurrent ? (
                <Loader2 size={dotSize * 0.5} color={stage.color} style={{ animation: "spin 0.8s linear infinite" }} />
              ) : isCompleted ? (
                <Check size={dotSize * 0.55} color="#fff" strokeWidth={3} />
              ) : isCurrent ? (
                <div style={{ width: dotSize * 0.35, height: dotSize * 0.35, borderRadius: "50%", background: stage.color }} />
              ) : null}
            </button>

            {/* Label (only for lg or current) */}
            {(size === "lg" || isCurrent) && (
              <span style={{
                marginLeft: 4, marginRight: 4,
                fontSize: size === "lg" ? 12 : 10, fontWeight: 600,
                color: isCurrent ? stage.color : "var(--text-tertiary)",
                whiteSpace: "nowrap",
              }}>
                {stage.label}
              </span>
            )}

            {/* Connector line */}
            {idx < STAGES.length - 1 && (
              <div style={{
                width: lineWidth, height: 2,
                background: idx < currentIdx ? STAGES[idx + 1].color : "rgba(255,255,255,0.1)",
                transition: "background 0.3s ease",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
