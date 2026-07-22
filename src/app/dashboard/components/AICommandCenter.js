"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles, AlertTriangle, TrendingUp, TrendingDown, Package,
  Users, MessageCircle, Zap, RefreshCw, ChevronRight, Clock
} from "lucide-react";

/**
 * AICommandCenter — proactive AI insights panel for the dashboard.
 *
 * Shows:
 *   - A greeting with the AI's daily summary
 *   - 3-5 prioritized insight cards with action buttons
 *   - Refresh button
 *
 * Falls back to rule-based insights if AI providers aren't configured.
 */
export default function AICommandCenter() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchInsights = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/dashboard-insights");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInsights();
    // Auto-refresh every 5 minutes
    const interval = setInterval(() => fetchInsights(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchInsights]);

  if (loading) {
    return (
      <div style={{
        background: "linear-gradient(135deg, rgba(108, 92, 231, 0.08) 0%, rgba(162, 155, 254, 0.04) 100%)",
        border: "1px solid rgba(108, 92, 231, 0.2)",
        borderRadius: "var(--radius-xl, 16px)",
        padding: "var(--space-xl, 24px)",
        marginBottom: "var(--space-lg, 16px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={20} color="#fff" className="pulse" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>AI Command Center</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Analyzing your store...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: "rgba(255, 82, 82, 0.05)",
        border: "1px solid rgba(255, 82, 82, 0.2)",
        borderRadius: "var(--radius-xl, 16px)",
        padding: "var(--space-xl, 24px)",
        marginBottom: "var(--space-lg, 16px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <AlertTriangle size={20} color="var(--accent-red)" />
          <span>Failed to load AI insights: {error}</span>
          <button onClick={() => fetchInsights(true)} style={{ marginLeft: "auto", background: "none", border: "1px solid var(--border-medium)", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 12 }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data || !data.insights || data.insights.length === 0) {
    return null;  // Nothing to show
  }

  const categoryIcons = {
    revenue: <TrendingUp size={16} />,
    customers: <Users size={16} />,
    inventory: <Package size={16} />,
    response: <MessageCircle size={16} />,
    opportunity: <Zap size={16} />,
  };

  const priorityColors = {
    high: { bg: "rgba(255, 82, 82, 0.08)", border: "rgba(255, 82, 82, 0.3)", text: "#ff5252", dot: "#ff5252" },
    medium: { bg: "rgba(255, 193, 7, 0.08)", border: "rgba(255, 193, 7, 0.3)", text: "#ffc107", dot: "#ffc107" },
    low: { bg: "rgba(0, 200, 83, 0.08)", border: "rgba(0, 200, 83, 0.3)", text: "#00c853", dot: "#00c853" },
  };

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(108, 92, 231, 0.08) 0%, rgba(162, 155, 254, 0.04) 100%)",
      border: "1px solid rgba(108, 92, 231, 0.2)",
      borderRadius: "var(--radius-xl, 16px)",
      padding: "var(--space-xl, 24px)",
      marginBottom: "var(--space-lg, 16px)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(108, 92, 231, 0.3)",
          }}>
            <Sparkles size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>AI Command Center</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={10} />
              {data.ai_powered ? "Powered by AI" : "Rule-based"} · Updated {new Date(data.generated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>
        <button
          onClick={() => fetchInsights(true)}
          disabled={refreshing}
          style={{
            background: "var(--bg-card)", border: "1px solid var(--border-medium)",
            borderRadius: 8, padding: "8px 12px", cursor: refreshing ? "wait" : "pointer",
            display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500,
            color: "var(--text-secondary)",
          }}
        >
          <RefreshCw size={14} className={refreshing ? "spin" : ""} />
          Refresh
        </button>
      </div>

      {/* AI Summary */}
      {data.summary && (
        <div style={{
          background: "var(--bg-card)", borderRadius: 12, padding: "14px 16px",
          marginBottom: 16, fontSize: 14, lineHeight: 1.6, color: "var(--text-primary)",
          border: "1px solid var(--border-subtle)",
        }}>
          <span style={{ fontWeight: 600, color: "#6c5ce7" }}>AI says: </span>
          {data.summary}
        </div>
      )}

      {/* Insight cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        {data.insights.map((insight, idx) => {
          const colors = priorityColors[insight.priority] || priorityColors.medium;
          const icon = categoryIcons[insight.category] || <Sparkles size={16} />;
          return (
            <div
              key={idx}
              style={{
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {/* Top row: priority dot + category icon */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%", background: colors.dot,
                    boxShadow: `0 0 8px ${colors.dot}`,
                  }} />
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: colors.text }}>
                    {insight.priority}
                  </span>
                </div>
                <span style={{ color: colors.text, opacity: 0.7 }}>{icon}</span>
              </div>

              {/* Title */}
              <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3, color: "var(--text-primary)" }}>
                {insight.title}
              </div>

              {/* Detail */}
              {insight.detail && (
                <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--text-secondary)" }}>
                  {insight.detail}
                </div>
              )}

              {/* Action button */}
              {insight.action_path && (
                <button
                  onClick={() => router.push(insight.action_path)}
                  style={{
                    marginTop: "auto", alignSelf: "flex-start",
                    background: "var(--bg-card)", border: `1px solid ${colors.border}`,
                    borderRadius: 8, padding: "6px 12px", cursor: "pointer",
                    fontSize: 12, fontWeight: 600, color: colors.text,
                    display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  {insight.action_label || "Take Action"}
                  <ChevronRight size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick stats row */}
      {data.stats && (
        <div style={{
          display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap",
          fontSize: 12, color: "var(--text-tertiary)",
        }}>
          {data.stats.revenue && (
            <span>
              Revenue Today: <strong style={{ color: data.stats.revenue.today_vs_yesterday_pct >= 0 ? "#00c853" : "#ff5252" }}>
                {data.stats.revenue.today}
              </strong>
              {" "}
              ({data.stats.revenue.today_vs_yesterday_pct >= 0 ? "+" : ""}{data.stats.revenue.today_vs_yesterday_pct}%)
            </span>
          )}
          {data.stats.conversations && (
            <>
              <span>Waiting: <strong>{data.stats.conversations.waiting_count}</strong></span>
              <span>Needs Attention: <strong>{data.stats.conversations.needs_attention_count}</strong></span>
            </>
          )}
          {data.stats.unread_messages > 0 && (
            <span>Unread: <strong style={{ color: "#ff5252" }}>{data.stats.unread_messages}</strong></span>
          )}
          {data.stats.inventory && data.stats.inventory.low_stock_count > 0 && (
            <span>Low Stock: <strong style={{ color: "#ffc107" }}>{data.stats.inventory.low_stock_count}</strong></span>
          )}
        </div>
      )}
    </div>
  );
}
