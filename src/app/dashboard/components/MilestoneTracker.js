"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Star, Zap, Users, ShoppingBag, MessageCircle,
  Bot, Crown, X, Package,
} from "lucide-react";
import { useDevice } from "@/lib/use-device";

/**
 * MilestoneTracker — silently monitors the owner's achievements and
 * shows celebratory popups when they hit milestones.
 *
 * Milestones:
 *   - First product added
 *   - 10 / 50 / 100 products
 *   - First customer message
 *   - 10 / 50 / 100 conversations
 *   - First order
 *   - 10 / 50 / 100 orders
 *   - First $1000 revenue
 *   - AI deflection > 50%
 *   - 7-day streak (login 7 days in a row)
 *   - First review
 *
 * Each milestone shows ONCE, then is dismissed (stored in localStorage).
 */
const MILESTONES = [
  { id: "first_product", label: "First product added!", desc: "Your catalog is growing. The AI is ready to sell it! 📦", icon: ShoppingBag, color: "#5865F2" },
  { id: "products_10", label: "10 products! 🎉", desc: "Your store is looking professional. Customers will love the variety!", icon: Package, color: "#5865F2" },
  { id: "products_50", label: "50 products! 🚀", desc: "You're running a real catalog now. The AI has plenty to recommend!", icon: Package, color: "#00D2FF" },
  { id: "first_message", label: "First message received! 💬", desc: "A customer reached out! Your AI is on it. Check your Conversations!", icon: MessageCircle, color: "#00D2FF" },
  { id: "conversations_10", label: "10 conversations! 📱", desc: "People are interested in your store. Keep the momentum going!", icon: MessageCircle, color: "#7E88F5" },
  { id: "conversations_50", label: "50 conversations! 🔥", desc: "You're getting popular! Your AI is handling it like a pro.", icon: MessageCircle, color: "#F8A532" },
  { id: "first_order", label: "FIRST ORDER! 🎉🎉🎉", desc: "You just made your first sale! This is the start of something great!", icon: ShoppingBag, color: "#3BA55C" },
  { id: "orders_10", label: "10 orders! 💰", desc: "You're on a roll! Revenue is flowing. Keep it up!", icon: ShoppingBag, color: "#3BA55C" },
  { id: "orders_50", label: "50 orders! 🏆", desc: "50 sales! You're a real business now. Time to scale!", icon: Trophy, color: "#F8A532" },
  { id: "orders_100", label: "100 orders! 👑", desc: "Century! You've processed 100 orders. That's incredible!", icon: Crown, color: "#EB459E" },
  { id: "revenue_1000", label: "1000 EGP revenue! 💵", desc: "You've crossed 1000 EGP in total revenue. Every piaster counts!", icon: Trophy, color: "#3BA55C" },
  { id: "ai_50", label: "AI handling 50%! 🤖", desc: "Your AI agent is now handling over half your conversations. You're scaling without hiring!", icon: Bot, color: "#00D2FF" },
  { id: "ai_80", label: "AI handling 80%! 🤖🔥", desc: "80% deflection rate! You've basically automated your customer service. Incredible!", icon: Bot, color: "#3BA55C" },
  { id: "first_review", label: "First review! ⭐", desc: "A customer left you a review! Social proof is gold. Check it out!", icon: Star, color: "#f5b400" },
  { id: "streak_7", label: "7-day streak! 🔥", desc: "You've logged in 7 days in a row. Consistency is the key to success!", icon: Zap, color: "#F8A532" },
];

// Need to import Package since it's used in milestones — already imported above

export default function MilestoneTracker({ stats }) {
  const [activeMilestone, setActiveMilestone] = useState(null);
  const [dismissedMilestones, setDismissedMilestones] = useState(new Set());
  const [streakDays, setStreakDays] = useState(0);
  const { isMobile } = useDevice();

  // Load dismissed milestones from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("sellora_milestones_dismissed");
      if (stored) setDismissedMilestones(new Set(JSON.parse(stored)));
    } catch (e) { /* ignore */ }

    // Track login streak
    const today = new Date().toDateString();
    const lastLogin = localStorage.getItem("sellora_last_login");
    const streakStr = localStorage.getItem("sellora_login_streak");
    let streak = parseInt(streakStr || "0", 10);

    if (lastLogin !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      if (lastLogin === yesterday) {
        streak += 1;
      } else {
        streak = 1;
      }
      localStorage.setItem("sellora_last_login", today);
      localStorage.setItem("sellora_login_streak", String(streak));
      setStreakDays(streak);

      if (streak === 7 && !dismissedMilestones.has("streak_7")) {
        triggerMilestone("streak_7");
      }
    } else {
      setStreakDays(streak);
    }
  }, []);

  // Check stats-based milestones
  useEffect(() => {
    if (!stats) return;

    const checks = [
      { id: "first_product", condition: stats.totalProducts >= 1 },
      { id: "products_10", condition: stats.totalProducts >= 10 },
      { id: "products_50", condition: stats.totalProducts >= 50 },
      { id: "conversations_10", condition: stats.totalConversations >= 10 },
      { id: "conversations_50", condition: stats.totalConversations >= 50 },
      { id: "orders_10", condition: stats.totalOrders >= 10 },
      { id: "orders_50", condition: stats.totalOrders >= 50 },
      { id: "orders_100", condition: stats.totalOrders >= 100 },
      { id: "revenue_1000", condition: (stats.revenue || 0) >= 1000 },
      { id: "ai_50", condition: (stats.aiPct || 0) >= 50 },
      { id: "ai_80", condition: (stats.aiPct || 0) >= 80 },
    ];

    for (const check of checks) {
      if (check.condition && !dismissedMilestones.has(check.id)) {
        triggerMilestone(check.id);
        break; // Only show one at a time
      }
    }
  }, [stats]);

  const triggerMilestone = (id) => {
    if (dismissedMilestones.has(id)) return;
    const milestone = MILESTONES.find(m => m.id === id);
    if (!milestone) return;

    setActiveMilestone(milestone);

    // Auto-dismiss after 6 seconds
    setTimeout(() => dismissMilestone(id), 6000);

    // Mark as dismissed
    const updated = new Set(dismissedMilestones);
    updated.add(id);
    setDismissedMilestones(updated);
    try {
      localStorage.setItem("sellora_milestones_dismissed", JSON.stringify([...updated]));
    } catch (e) { /* ignore */ }
  };

  const dismissMilestone = (id) => {
    setActiveMilestone(null);
  };

  if (!activeMilestone) return null;
  const Icon = activeMilestone.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -60, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -60, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        style={{
          position: "fixed", top: 20,
          // 🔧 FIX: On desktop, account for the 260px sidebar by shifting
          // the center point right by 130px (half the sidebar width).
          // On mobile, there's no sidebar, so use plain 50%.
          // Using JS state (isMobile) instead of CSS media query because
          // inline styles can't be overridden by <style> tags.
          left: isMobile ? "50%" : "calc(50% + 130px)",
          transform: "translateX(-50%)",
          zIndex: 10000,
          maxWidth: 440, width: "calc(100% - 40px)",
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "16px 20px",
          background: "linear-gradient(135deg, var(--bg-secondary, #21222C), var(--bg-tertiary, #282A36))",
          border: `1px solid ${activeMilestone.color}40`,
          borderRadius: 16,
          boxShadow: `0 12px 40px rgba(0,0,0,0.4), 0 0 40px ${activeMilestone.color}20`,
        }}>
          {/* Animated icon */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 15, delay: 0.1 }}
            style={{
              width: 48, height: 48, borderRadius: 12,
              background: `linear-gradient(135deg, ${activeMilestone.color}25, ${activeMilestone.color}08)`,
              border: `1px solid ${activeMilestone.color}30`,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon size={24} color={activeMilestone.color} />
          </motion.div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: activeMilestone.color }}>
              {activeMilestone.label}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.4 }}>
              {activeMilestone.desc}
            </div>
          </div>

          {/* Close */}
          <button
            onClick={() => dismissMilestone(activeMilestone.id)}
            style={{
              background: "transparent", border: "none",
              color: "var(--text-tertiary)", cursor: "pointer", padding: 4,
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Confetti for special milestones */}
        {(activeMilestone.id === "first_order" || activeMilestone.id === "orders_100") && (
          <>
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} style={{
                position: "fixed", top: 40, left: `${50 + (Math.random() - 0.5) * 60}%`,
                width: 6, height: 6, borderRadius: i % 2 === 0 ? "50%" : "2px",
                background: [activeMilestone.color, "#5865F2", "#00D2FF", "#F8A532"][i % 4],
                animation: `milestone-confetti ${1.5 + Math.random()}s ease-out forwards`,
                pointerEvents: "none", zIndex: 10001,
              }} />
            ))}
            <style>{`
              @keyframes milestone-confetti {
                0% { transform: translateY(0) rotate(0deg); opacity: 1; }
                100% { transform: translateY(300px) rotate(360deg); opacity: 0; }
              }
            `}</style>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
