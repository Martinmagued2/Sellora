"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sparkles, RefreshCw, MessageCircle, ShoppingBag, Heart,
  AlertTriangle, TrendingUp, Clock, Tag, Zap
} from "lucide-react";

/**
 * AIMemoryCard — displays an AI-generated customer memory card.
 *
 * Shows a structured summary of the customer including:
 *   - One-sentence summary
 *   - Communication preferences (channel, reply time, language)
 *   - Buying behavior (avg order value, frequency, last order, LTV)
 *   - Interests (tags + mentioned products)
 *   - Sentiment + risk level
 *   - Next best action with priority
 *   - Key facts bullets
 *
 * Fetches from /api/ai/memory-card?customer_id=...
 * Cached server-side for 24 hours.
 */
export default function AIMemoryCard({ customerId }) {
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchCard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai/memory-card?customer_id=${customerId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCard(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (customerId) fetchCard();
  }, [customerId, fetchCard]);

  if (loading) {
    return (
      <div style={{
        background: "linear-gradient(135deg, rgba(108, 92, 231, 0.05) 0%, rgba(162, 155, 254, 0.02) 100%)",
        border: "1px solid rgba(108, 92, 231, 0.15)",
        borderRadius: 12, padding: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={16} color="#6c5ce7" className="pulse" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
            Generating AI memory card...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: "rgba(255, 82, 82, 0.05)",
        border: "1px solid rgba(255, 82, 82, 0.2)",
        borderRadius: 12, padding: 12,
        fontSize: 12, color: "var(--accent-red)",
      }}>
        Failed to load memory card: {error}
      </div>
    );
  }

  if (!card || !card.memory_card) return null;
  const mc = card.memory_card;

  const sentimentColors = {
    positive: { bg: "rgba(0, 200, 83, 0.1)", text: "#00c853" },
    neutral: { bg: "rgba(144, 164, 174, 0.1)", text: "#90a4ae" },
    negative: { bg: "rgba(255, 82, 82, 0.1)", text: "#ff5252" },
    mixed: { bg: "rgba(255, 193, 7, 0.1)", text: "#ffc107" },
  };

  const riskColors = {
    low: { bg: "rgba(0, 200, 83, 0.1)", text: "#00c853", dot: "#00c853" },
    medium: { bg: "rgba(255, 193, 7, 0.1)", text: "#ffc107", dot: "#ffc107" },
    high: { bg: "rgba(255, 82, 82, 0.1)", text: "#ff5252", dot: "#ff5252" },
  };

  const priorityColors = {
    high: "#ff5252",
    medium: "#ffc107",
    low: "#00c853",
  };

  const sentimentStyle = sentimentColors[mc.sentiment] || sentimentColors.neutral;
  const riskStyle = riskColors[mc.risk_level?.churn_risk] || riskColors.low;

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(108, 92, 231, 0.05) 0%, rgba(162, 155, 254, 0.02) 100%)",
      border: "1px solid rgba(108, 92, 231, 0.2)",
      borderRadius: 12, padding: 16,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={14} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>AI Memory Card</div>
            <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
              {card.ai_powered ? "AI-generated" : "Rule-based"} · {card.cached ? "Cached" : "Fresh"}
              {" · "}
              {card.generated_at && new Date(card.generated_at).toLocaleDateString()}
            </div>
          </div>
        </div>
        <button
          onClick={() => fetchCard(true)}
          disabled={refreshing}
          style={{
            background: "var(--bg-card)", border: "1px solid var(--border-medium)",
            borderRadius: 6, padding: "4px 8px", cursor: refreshing ? "wait" : "pointer",
            display: "flex", alignItems: "center", gap: 4, fontSize: 11,
          }}
        >
          <RefreshCw size={11} className={refreshing ? "spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Summary */}
      {mc.summary && (
        <div style={{
          background: "var(--bg-card)", borderRadius: 8, padding: "10px 12px",
          marginBottom: 12, fontSize: 13, lineHeight: 1.5, color: "var(--text-primary)",
          border: "1px solid var(--border-subtle)",
        }}>
          {mc.summary}
        </div>
      )}

      {/* Sentiment + Risk badges */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {mc.sentiment && (
          <span style={{
            padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: sentimentStyle.bg, color: sentimentStyle.text,
          }}>
            Sentiment: {mc.sentiment}
          </span>
        )}
        {mc.risk_level?.churn_risk && (
          <span style={{
            padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: riskStyle.bg, color: riskStyle.text,
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: riskStyle.dot }} />
            Churn risk: {mc.risk_level.churn_risk}
          </span>
        )}
      </div>

      {/* Grid: preferences + behavior */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        {/* Communication preferences */}
        <div style={{ background: "var(--bg-card)", borderRadius: 8, padding: 10, border: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6, fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            <MessageCircle size={11} /> Preferences
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-secondary)" }}>
            {mc.communication_preferences?.preferred_channel && (
              <div>📱 Channel: <strong>{mc.communication_preferences.preferred_channel}</strong></div>
            )}
            {mc.communication_preferences?.typical_reply_time && (
              <div>⏰ {mc.communication_preferences.typical_reply_time}</div>
            )}
            {mc.communication_preferences?.language && mc.communication_preferences.language !== "unknown" && (
              <div>🌐 Language: {mc.communication_preferences.language}</div>
            )}
          </div>
        </div>

        {/* Buying behavior */}
        <div style={{ background: "var(--bg-card)", borderRadius: 8, padding: 10, border: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6, fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            <ShoppingBag size={11} /> Buying
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-secondary)" }}>
            {mc.buying_behavior?.avg_order_value != null && (
              <div>💰 AOV: <strong>{mc.buying_behavior.avg_order_value}</strong></div>
            )}
            {mc.buying_behavior?.purchase_frequency && (
              <div>🔄 {mc.buying_behavior.purchase_frequency}</div>
            )}
            {mc.buying_behavior?.total_lifetime_value != null && (
              <div>💎 LTV: <strong>{mc.buying_behavior.total_lifetime_value}</strong></div>
            )}
          </div>
        </div>
      </div>

      {/* Interests */}
      {mc.interests && mc.interests.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6, fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            <Tag size={11} /> Interests
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {mc.interests.map((interest, i) => (
              <span key={i} style={{
                padding: "2px 8px", borderRadius: 10, fontSize: 11,
                background: "rgba(108, 92, 231, 0.1)", color: "#6c5ce7",
              }}>
                {interest}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Next best action — highlighted */}
      {mc.next_best_action && (
        <div style={{
          background: "linear-gradient(135deg, rgba(108, 92, 231, 0.1) 0%, rgba(162, 155, 254, 0.05) 100%)",
          border: "1px solid rgba(108, 92, 231, 0.3)",
          borderRadius: 8, padding: 10, marginBottom: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6, fontSize: 11, fontWeight: 700, color: "#6c5ce7", textTransform: "uppercase", letterSpacing: 0.5 }}>
            <Zap size={11} /> Next Best Action
            {mc.next_best_action.priority && (
              <span style={{
                marginLeft: "auto", padding: "1px 6px", borderRadius: 4, fontSize: 9,
                background: priorityColors[mc.next_best_action.priority] || "#90a4ae",
                color: "#fff", fontWeight: 700,
              }}>
                {mc.next_best_action.priority}
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
            {mc.next_best_action.action}
          </div>
          {mc.next_best_action.reason && (
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              {mc.next_best_action.reason}
            </div>
          )}
        </div>
      )}

      {/* Key facts */}
      {mc.key_facts && mc.key_facts.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6, fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            <Heart size={11} /> Key Facts
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.6, color: "var(--text-secondary)" }}>
            {mc.key_facts.map((fact, i) => (
              <li key={i}>{fact}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
