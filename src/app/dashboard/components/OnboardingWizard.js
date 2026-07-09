"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  MessageSquare, Package, Sparkles, Send, UserPlus,
  Check, X, ChevronRight, ArrowLeft, Loader2, PartyPopper,
} from "lucide-react";

const STEPS = [
  { key: "connect_whatsapp", title: "Connect WhatsApp", icon: MessageSquare, description: "Link your WhatsApp Business number to start receiving messages", href: "/dashboard/settings?tab=channels" },
  { key: "add_product", title: "Add your first product", icon: Package, description: "Add at least one product so the AI can sell it", href: "/dashboard/products" },
  { key: "set_ai_personality", title: "Customize your AI", icon: Sparkles, description: "Tune your AI agent's tone and personality", href: "/dashboard/ai-personality" },
  { key: "send_test_msg", title: "Send a test message", icon: Send, description: "Try out the AI copilot to see how it replies", href: "/dashboard/conversations" },
  { key: "invite_teammate", title: "Invite a teammate", icon: UserPlus, description: "Bring your team in (Pro+ feature)", href: "/dashboard/settings?tab=team" },
];

export default function OnboardingWizard({ onComplete, onSkip }) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [stepsCompleted, setStepsCompleted] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    const checkSteps = async () => {
      try {
        const res = await fetch("/api/onboarding");
        if (res.ok) {
          const data = await res.json();
          const completed = {};
          (data.steps || []).forEach(s => { if (s.completed) completed[s.key] = true; });

          // Find first incomplete step
          const firstIncomplete = (data.steps || []).findIndex(s => !s.completed);
          setCurrentStep(firstIncomplete >= 0 ? firstIncomplete : STEPS.length - 1);
          setStepsCompleted(completed);

          if (data.progress?.isComplete) {
            setShowCelebration(true);
          }
        }
      } catch (e) { /* ignore */ }
      setLoading(false);
    };
    checkSteps();
  }, []);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setShowCelebration(true);
      setTimeout(() => {
        onComplete?.();
      }, 3000);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleNavigate = () => {
    router.push(STEPS[currentStep].href);
  };

  const handleSkipStep = async () => {
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: STEPS[currentStep].key }),
      });
      setStepsCompleted(prev => ({ ...prev, [STEPS[currentStep].key]: true }));
      handleNext();
    } catch (e) { /* ignore */ }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0b0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={32} style={{ animation: "spin 0.8s linear infinite", color: "#5865F2" }} />
      </div>
    );
  }

  // Celebration screen
  if (showCelebration) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0b0f", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ textAlign: "center", maxWidth: 440 }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "linear-gradient(135deg, #5865F2, #00D2FF)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
            boxShadow: "0 12px 40px rgba(88, 101, 242, 0.5)",
          }}>
            <PartyPopper size={36} color="#fff" />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>You're all set! 🎉</h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            Your Sellora store is ready. Start receiving messages and let the AI handle the rest.
          </p>
          <button
            onClick={() => onComplete?.()}
            style={{
              padding: "14px 32px", borderRadius: 12,
              background: "linear-gradient(135deg, #5865F2, #00D2FF)",
              color: "#fff", border: "none", cursor: "pointer",
              fontSize: 16, fontWeight: 700,
              boxShadow: "0 8px 24px rgba(88, 101, 242, 0.4)",
            }}
          >
            Go to Dashboard
          </button>
        </div>
        {/* Confetti */}
        {Array.from({ length: 30 }).map((_, i) => (
          <div key={i} style={{
            position: "fixed", top: 0, left: `${Math.random() * 100}%`,
            width: 8, height: 8, borderRadius: i % 2 === 0 ? "50%" : "2px",
            background: ["#5865F2", "#00D2FF", "#F8A532", "#3BA55C", "#EB459E"][i % 5],
            animation: `confetti-fall ${2 + Math.random() * 2}s ease-out ${Math.random() * 0.5}s forwards`,
            pointerEvents: "none", zIndex: 10000,
          }} />
        ))}
        <style>{`@keyframes confetti-fall { 0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(360deg); opacity: 0; } }`}</style>
      </div>
    );
  }

  const step = STEPS[currentStep];
  const Icon = step.icon;
  const isCompleted = stepsCompleted[step.key];
  const progressPct = Math.round((Object.keys(stepsCompleted).length / STEPS.length) * 100);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0b0f", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
      {/* Progress bar */}
      <div style={{ width: "100%", maxWidth: 480, marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Step {currentStep + 1} of {STEPS.length}</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{progressPct}% complete</span>
        </div>
        <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{
            width: `${((currentStep + 1) / STEPS.length) * 100}%`,
            height: "100%",
            background: "linear-gradient(90deg, #5865F2, #00D2FF)",
            borderRadius: 3,
            transition: "width 0.4s ease",
          }} />
        </div>
      </div>

      {/* Step card */}
      <div style={{
        maxWidth: 440, width: "100%",
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20, padding: 32, textAlign: "center",
      }}>
        {/* Icon */}
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: "linear-gradient(135deg, rgba(88,101,242,0.2), rgba(0,210,255,0.1))",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px",
          border: "1px solid rgba(88,101,242,0.2)",
        }}>
          {isCompleted ? <Check size={28} color="#3BA55C" /> : <Icon size={28} color="#7E88F5" />}
        </div>

        {/* Title */}
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>{step.title}</h2>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          {step.description}
        </p>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          {currentStep > 0 && (
            <button onClick={handlePrev} style={{
              padding: "12px 16px", borderRadius: 10,
              background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)",
              border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer",
              fontSize: 14, fontWeight: 600,
            }}>
              <ArrowLeft size={14} />
            </button>
          )}
          <button onClick={handleNavigate} style={{
            flex: 1, padding: "12px 20px", borderRadius: 10,
            background: "linear-gradient(135deg, #5865F2, #00D2FF)",
            color: "#fff", border: "none", cursor: "pointer",
            fontSize: 14, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            {isCompleted ? "Done — Next" : "Go there"} <ChevronRight size={16} />
          </button>
          <button onClick={handleSkipStep} style={{
            padding: "12px 16px", borderRadius: 10,
            background: "transparent", color: "rgba(255,255,255,0.3)",
            border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer",
            fontSize: 13, fontWeight: 600,
          }}>
            Skip
          </button>
        </div>
      </div>

      {/* Skip all */}
      <button onClick={() => onSkip?.()} style={{
        marginTop: 20, background: "transparent", border: "none",
        color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: 12,
      }}>
        Skip setup — I'll do this later
      </button>
    </div>
  );
}
