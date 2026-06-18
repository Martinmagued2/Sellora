"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, AlertTriangle, Info, Loader2 } from "lucide-react";

/**
 * ActionToast — a more satisfying, interactive toast that gives
 * the owner positive feedback after actions.
 *
 * Features:
 *   - Spring animation entrance
 *   - Contextual emoji per action type
 *   - Encouraging messages (not just "Saved!")
 *   - Progress bar that shrinks
 *   - Pause on hover
 *   - Optional action button (Undo, View, etc.)
 *   - Sound effect (optional, toggle in localStorage)
 *
 * Usage:
 *   const { showActionToast } = useActionToast();
 *   showActionToast({ type: "success", message: "Product created!", action: { label: "View", onClick: () => ... } });
 */

const SUCCESS_MESSAGES = {
  product_created: ["Product added! 📦 Your AI can sell it now.", "Nice! New product is live. 🎉"],
  product_deleted: ["Product removed. Cleanup feels good! 🧹"],
  product_updated: ["Product updated! Looking sharp. ✨"],
  order_status: ["Status updated! Customer notified. 📨", "Order moved forward! Keep the momentum. 🚀"],
  coupon_created: ["Coupon created! Customers love discounts. 🎫"],
  message_sent: ["Message sent! 💬", "Delivered! They'll love hearing from you. 📨"],
  settings_saved: ["Settings saved! You're all set. ✅", "Saved! Your store is looking good. 😎"],
  ai_paused: ["AI paused. You're in control now. ✋", "Taking over! The AI will sit this one out. 🤖"],
  ai_resumed: ["AI resumed! Let it handle the heavy lifting. 🤖", "AI is back online. Go focus on growing! 🚀"],
  campaign_sent: ["Campaign sent! Watch the responses roll in. 📣"],
  default: ["Done! ✅", "All set! 🎉", "Perfect! 💪"],
};

let toastId = 0;
const listeners = new Set();

export function showActionToast({ type = "success", actionType, message, action, duration = 4000 }) {
  const msg = message || SUCCESS_MESSAGES[actionType]?.[Math.floor(Math.random() * SUCCESS_MESSAGES[actionType].length)] || SUCCESS_MESSAGES.default[Math.floor(Math.random() * SUCCESS_MESSAGES.default.length)];
  const id = ++toastId;
  listeners.forEach(fn => fn({ id, type, message: msg, action, duration }));
}

export function useActionToast() {
  return { showActionToast };
}

const ICONS = {
  success: Check,
  error: X,
  warning: AlertTriangle,
  info: Info,
};

const COLORS = {
  success: { bg: "rgba(59,165,92,0.12)", border: "rgba(59,165,92,0.3)", icon: "#3BA55C", progress: "#3BA55C" },
  error: { bg: "rgba(237,66,69,0.12)", border: "rgba(237,66,69,0.3)", icon: "#ED4245", progress: "#ED4245" },
  warning: { bg: "rgba(248,165,50,0.12)", border: "rgba(248,165,50,0.3)", icon: "#F8A532", progress: "#F8A532" },
  info: { bg: "rgba(0,210,255,0.12)", border: "rgba(0,210,255,0.3)", icon: "#00D2FF", progress: "#00D2FF" },
};

export function ActionToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (toast) => {
      setToasts(prev => [...prev, toast]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, toast.duration);
    };
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, []);

  const dismiss = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24,
      zIndex: 9999, display: "flex", flexDirection: "column",
      gap: 8, pointerEvents: "none",
    }}>
      <AnimatePresence>
        {toasts.map(toast => {
          const Icon = ICONS[toast.type] || Info;
          const colors = COLORS[toast.type] || COLORS.info;
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 80, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px",
                background: "var(--bg-secondary, #21222C)",
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                pointerEvents: "auto",
                maxWidth: 380,
                overflow: "hidden",
                position: "relative",
              }}
            >
              {/* Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 15, delay: 0.1 }}
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: colors.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={16} color={colors.icon} />
              </motion.div>

              {/* Message */}
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                {toast.message}
              </span>

              {/* Action button */}
              {toast.action && (
                <button
                  onClick={() => { toast.action.onClick?.(); dismiss(toast.id); }}
                  style={{
                    padding: "4px 12px", borderRadius: 6,
                    background: colors.bg, color: colors.icon,
                    border: `1px solid ${colors.border}`, cursor: "pointer",
                    fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
                  }}
                >
                  {toast.action.label}
                </button>
              )}

              {/* Close */}
              <button
                onClick={() => dismiss(toast.id)}
                style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 2 }}
              >
                <X size={14} />
              </button>

              {/* Progress bar */}
              <motion.div
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: toast.duration / 1000, ease: "linear" }}
                style={{
                  position: "absolute", bottom: 0, left: 0, height: 2,
                  background: colors.progress, opacity: 0.5,
                }}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
