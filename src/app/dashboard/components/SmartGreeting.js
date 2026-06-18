"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sun, Moon, Coffee, Sunset, Sparkles, TrendingUp, Bell } from "lucide-react";

/**
 * SmartGreeting — personalized, time-aware greeting on the dashboard
 * that changes based on:
 *   - Time of day (morning/afternoon/evening/late night)
 *   - Performance (new orders today, unread messages, AI deflection)
 *   - Streak (days since signup)
 *
 * Makes the owner feel seen and appreciated every time they open the app.
 */
export default function SmartGreeting({ user, stats }) {
  const [greeting, setGreeting] = useState(null);

  useEffect(() => {
    if (!user) return;
    buildGreeting();
  }, [user, stats]);

  const buildGreeting = async () => {
    const hour = new Date().getHours();
    const name = user?.user_metadata?.business_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";

    // Time-based greeting
    let timeGreeting, icon, emoji;
    if (hour >= 5 && hour < 12) {
      timeGreeting = "Good morning";
      icon = Coffee; emoji = "☕";
    } else if (hour >= 12 && hour < 17) {
      timeGreeting = "Good afternoon";
      icon = Sun; emoji = "☀️";
    } else if (hour >= 17 && hour < 22) {
      timeGreeting = "Good evening";
      icon = Sunset; emoji = "🌆";
    } else {
      timeGreeting = "Burning the midnight oil";
      icon = Moon; emoji = "🌙";
    }

    // Performance-based message
    let perfMsg = "";
    if (stats) {
      const newOrders = stats.totalOrders || 0;
      const aiPct = stats.aiPct || 0;
      const activeChats = stats.activeConversations || 0;

      if (newOrders > 0 && aiPct > 70) {
        perfMsg = `You have ${newOrders} orders and your AI is handling ${aiPct}% of conversations. You're scaling beautifully! 🚀`;
      } else if (newOrders > 0) {
        perfMsg = `You have ${newOrders} orders today. Every sale counts! 💰`;
      } else if (activeChats > 0) {
        perfMsg = `You have ${activeChats} active conversations waiting. Let's close some deals! 💬`;
      } else if (aiPct > 50) {
        perfMsg = `Your AI handled ${aiPct}% of messages while you were away. Nice! 🤖`;
      } else {
        const motivations = [
          "Ready to make some sales today? Let's go! 💪",
          "Every great business starts with a single message. Let's get started! ✨",
          "Your store is set up and ready. Customers are just a message away! 📱",
          "Consistency is key. Small steps every day lead to big results! 🌟",
        ];
        perfMsg = motivations[Math.floor(Math.random() * motivations.length)];
      }
    }

    setGreeting({
      timeGreeting,
      name,
      icon,
      emoji,
      perfMsg,
    });
  };

  if (!greeting) return null;
  const GreetingIcon = greeting.icon;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      marginBottom: 24, padding: "16px 20px",
      background: "linear-gradient(135deg, rgba(88,101,242,0.06), rgba(0,210,255,0.03))",
      border: "1px solid rgba(88,101,242,0.12)",
      borderRadius: 16,
      animation: "greeting-fade-in 0.5s ease",
    }}>
      <style>{`
        @keyframes greeting-fade-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Icon */}
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: "linear-gradient(135deg, rgba(88,101,242,0.15), rgba(0,210,255,0.08))",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <GreetingIcon size={20} color="#7E88F5" />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
          {greeting.timeGreeting}, {greeting.name}! {greeting.emoji}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 2 }}>
          {greeting.perfMsg}
        </div>
      </div>

      {/* Quick stats badges */}
      {stats && (stats.activeConversations > 0 || stats.totalOrders > 0) && (
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {stats.activeConversations > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700,
              background: "rgba(0,210,255,0.1)", color: "#00D2FF",
            }}>
              <Bell size={11} /> {stats.activeConversations} active
            </div>
          )}
          {stats.totalOrders > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700,
              background: "rgba(59,165,92,0.1)", color: "#3BA55C",
            }}>
              <TrendingUp size={11} /> {stats.totalOrders} orders
            </div>
          )}
        </div>
      )}
    </div>
  );
}
