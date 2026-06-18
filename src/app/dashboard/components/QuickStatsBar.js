"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  MessageCircle, ShoppingBag, Bot, DollarSign,
  ArrowRight,
} from "lucide-react";

/**
 * QuickStatsBar — horizontal row of tappable mini-stats at the top
 * of the dashboard. Each stat is clickable → navigates to the
 * relevant page. Hover shows a subtle lift + glow.
 */
export default function QuickStatsBar({ stats }) {
  const router = useRouter();

  if (!stats) return null;

  const items = [
    { label: "Active Chats", value: stats.activeConversations || 0, icon: MessageCircle, color: "#00D2FF", path: "/dashboard/conversations" },
    { label: "Orders", value: stats.totalOrders || 0, icon: ShoppingBag, color: "#F8A532", path: "/dashboard/orders" },
    { label: "AI Resolution", value: `${stats.aiPct || 0}%`, icon: Bot, color: "#3BA55C", path: "/dashboard/analytics" },
    { label: "Revenue", value: `${(stats.revenue || 0).toLocaleString()}`, suffix: " EGP", icon: DollarSign, color: "#3BA55C", path: "/dashboard/analytics" },
  ];

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8,
      marginBottom: 20,
    }}>
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <button
            key={i}
            onClick={() => router.push(item.path)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 14px", borderRadius: 12,
              background: "var(--bg-card, rgba(33,34,44,0.7))",
              border: "1px solid var(--border-subtle, rgba(255,255,255,0.06))",
              cursor: "pointer", textAlign: "left",
              transition: "all 0.2s ease", position: "relative", overflow: "hidden",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = item.color + "30";
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = `0 8px 20px -6px ${item.color}20`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border-subtle, rgba(255,255,255,0.06))";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {/* Gradient glow */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 2,
              background: `linear-gradient(90deg, transparent, ${item.color}, transparent)`,
              opacity: 0.5,
            }} />

            {/* Icon */}
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: item.color + "12",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <Icon size={15} color={item.color} />
            </div>

            {/* Value + Label */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.2 }}>
                {item.value}{item.suffix || ""}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 1 }}>
                {item.label}
              </div>
            </div>

            {/* Arrow */}
            <ArrowRight size={12} color="var(--text-tertiary)" style={{ opacity: 0.4, flexShrink: 0 }} />
          </button>
        );
      })}
    </div>
  );
}
