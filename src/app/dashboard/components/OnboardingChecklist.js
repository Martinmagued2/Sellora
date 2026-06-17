"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare, Package, Sparkles, Send, UserPlus,
  Check, X, ChevronRight, PartyPopper,
} from "lucide-react";

const STEP_ICONS = {
  whatsapp: MessageSquare,
  product: Package,
  ai: Sparkles,
  chat: Send,
  team: UserPlus,
};

export default function OnboardingChecklist({ onClose }) {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/onboarding");
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.progress.isComplete && !json.completedAt) {
          setCelebrating(true);
        }
      }
    } catch (e) {
      console.error("Onboarding load failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleStepClick = (step) => {
    if (step.href) router.push(step.href);
  };

  const handleDismiss = async () => {
    setDismissed(true);
    if (onClose) onClose();
  };

  if (loading || dismissed || !data) return null;
  if (data.progress.isComplete && data.completedAt) return null; // already done

  const { steps, progress } = data;

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(88, 101, 242, 0.08), rgba(88, 101, 242, 0.02))",
      border: "1px solid rgba(88, 101, 242, 0.25)",
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      position: "relative",
    }}>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        style={{
          position: "absolute", top: 12, right: 12,
          background: "transparent", border: "none",
          color: "var(--text-tertiary)", cursor: "pointer",
          width: 28, height: 28, borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <X size={16} />
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        {celebrating ? <PartyPopper size={20} color="var(--accent-primary)" /> : null}
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
          {celebrating ? "You're all set! 🎉" : "Welcome to Sellora — let's get you selling"}
        </h3>
      </div>
      <p style={{ margin: "4px 0 16px 0", fontSize: 13, color: "var(--text-secondary)" }}>
        {progress.completed} of {progress.total} steps complete · {progress.percent}%
      </p>

      {/* Progress bar */}
      <div style={{
        height: 6, background: "rgba(255,255,255,0.06)",
        borderRadius: 3, overflow: "hidden", marginBottom: 16,
      }}>
        <div style={{
          width: `${progress.percent}%`,
          height: "100%",
          background: "linear-gradient(90deg, var(--accent-primary), var(--accent-primary-light))",
          transition: "width 0.4s ease",
        }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        {steps.map((step) => {
          const Icon = STEP_ICONS[step.icon] || Check;
          return (
            <button
              key={step.key}
              onClick={() => handleStepClick(step)}
              style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "12px 14px",
                background: step.completed
                  ? "rgba(59, 165, 92, 0.08)"
                  : "rgba(255,255,255,0.03)",
                border: `1px solid ${step.completed ? "rgba(59, 165, 92, 0.3)" : "rgba(255,255,255,0.06)"}`,
                borderRadius: 10,
                cursor: "pointer", textAlign: "left",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = step.completed
                  ? "rgba(59, 165, 92, 0.12)"
                  : "rgba(255,255,255,0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = step.completed
                  ? "rgba(59, 165, 92, 0.08)"
                  : "rgba(255,255,255,0.03)";
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                background: step.completed ? "var(--accent-green)" : "rgba(255,255,255,0.05)",
                color: step.completed ? "#fff" : "var(--text-secondary)",
              }}>
                {step.completed ? <Check size={16} /> : <Icon size={14} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600,
                  color: step.completed ? "var(--accent-green)" : "var(--text-primary)",
                  marginBottom: 2,
                  textDecoration: step.completed ? "line-through" : "none",
                  opacity: step.completed ? 0.85 : 1,
                }}>
                  {step.title}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.4 }}>
                  {step.description}
                </div>
              </div>
              {!step.completed && (
                <ChevronRight size={14} color="var(--text-tertiary)" style={{ marginTop: 2 }} />
              )}
            </button>
          );
        })}
      </div>

      {progress.isComplete && !data.completedAt && (
        <div style={{
          marginTop: 16, padding: "12px 14px",
          background: "rgba(59, 165, 92, 0.1)",
          border: "1px solid rgba(59, 165, 92, 0.3)",
          borderRadius: 10,
          fontSize: 13, color: "var(--accent-green)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <PartyPopper size={16} />
          <span>You've completed onboarding! We've credited your account with 1 month of Pro free. 🎁</span>
        </div>
      )}
    </div>
  );
}
