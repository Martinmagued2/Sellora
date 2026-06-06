"use client";

import { useState, useEffect } from "react";
import { Download, X, Smartphone } from "lucide-react";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if dismissed recently
    const dismissedAt = localStorage.getItem("sellora_install_dismissed");
    if (dismissedAt) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return;
      }
    }

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      return;
    }

    // Listen for beforeinstallprompt event
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show prompt after a short delay
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setShowPrompt(false);
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem("sellora_install_dismissed", Date.now().toString());
  };

  if (!showPrompt) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 200,
        maxWidth: 480,
        width: "calc(100% - 48px)",
        background: "var(--bg-card)",
        border: "1px solid var(--border-accent)",
        borderRadius: 20,
        padding: "20px 24px",
        backdropFilter: "blur(20px)",
        boxShadow: "0 16px 40px rgba(0,0,0,0.3), 0 0 40px rgba(108, 92, 231, 0.15)",
        animation: "fade-in-up 0.4s ease",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: "var(--accent-gradient)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Smartphone size={24} style={{ color: "white" }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: "var(--font-size-sm)", marginBottom: 2 }}>
          Install Sellora
        </div>
        <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", lineHeight: 1.4 }}>
          Add to your home screen for quick access and push notifications
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleInstall}
            style={{ fontSize: "var(--font-size-xs)", padding: "6px 16px" }}
          >
            <Download size={12} />
            Install
          </button>
          <button
            onClick={handleDismiss}
            style={{
              background: "none",
              border: "1px solid var(--border-medium)",
              color: "var(--text-tertiary)",
              padding: "6px 16px",
              borderRadius: "var(--radius-full)",
              fontSize: "var(--font-size-xs)",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.target.style.color = "var(--text-primary)";
              e.target.style.borderColor = "var(--accent-primary)";
            }}
            onMouseLeave={(e) => {
              e.target.style.color = "var(--text-tertiary)";
              e.target.style.borderColor = "var(--border-medium)";
            }}
          >
            Not now
          </button>
        </div>
      </div>

      <button
        onClick={handleDismiss}
        style={{
          background: "none",
          border: "none",
          color: "var(--text-tertiary)",
          cursor: "pointer",
          padding: 4,
          flexShrink: 0,
          transition: "color 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}
      >
        <X size={16} />
      </button>
    </div>
  );
}
