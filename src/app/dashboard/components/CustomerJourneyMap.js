"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  MessageCircle, ShoppingBag, Star, Tag, Clock,
  User, Phone, Mail, AlertCircle, CheckCircle, ArrowRight
} from "lucide-react";

/**
 * CustomerJourneyMap — visual horizontal timeline showing the customer's
 * journey across stages: Lead → Inquiry → First Order → Repeat → VIP → (Churned?)
 *
 * Each stage shows:
 *   - Stage icon + label
 *   - Date reached
 *   - Key events at that stage
 *
 * Below the stage bar, a chronological event feed shows all touchpoints:
 *   - Messages (with channel icon)
 *   - Orders (with total)
 *   - Reviews (with rating)
 *   - Notes (with author)
 *   - Tasks (with status)
 *   - Tag changes
 *
 * Fetches from /api/customers/[id]/timeline (existing endpoint).
 */

const STAGES = [
  { key: "lead", label: "Lead", icon: <User size={14} />, color: "#90a4ae" },
  { key: "prospect", label: "Prospect", icon: <MessageCircle size={14} />, color: "#2196f3" },
  { key: "first_order", label: "First Order", icon: <ShoppingBag size={14} />, color: "#00c853" },
  { key: "repeat", label: "Repeat Buyer", icon: <Star size={14} />, color: "#ffc107" },
  { key: "vip", label: "VIP", icon: <Star size={14} />, color: "#e91e63" },
  { key: "churned", label: "Churned", icon: <AlertCircle size={14} />, color: "#ff5252" },
];

export default function CustomerJourneyMap({ customerId }) {
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customer, setCustomer] = useState(null);

  const fetchTimeline = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/timeline`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEvents(data.events || []);
      if (data.customer) setCustomer(data.customer);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
        Loading journey map...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 12, color: "var(--accent-red)", fontSize: 12 }}>
        Failed to load journey: {error}
      </div>
    );
  }

  // Determine current stage based on customer data + events
  const currentStage = determineStage(customer, events);

  // Group events by type for the stage bar
  const stageProgress = computeStageProgress(events, customer);

  return (
    <div>
      {/* Stage Bar — horizontal timeline */}
      <div style={{
        display: "flex", alignItems: "center", gap: 4, marginBottom: 20,
        padding: "12px 8px", background: "var(--bg-card)", borderRadius: 12,
        border: "1px solid var(--border-subtle)", overflowX: "auto",
      }}>
        {STAGES.map((stage, idx) => {
          const isReached = stageProgress[stage.key]?.reached;
          const isCurrent = currentStage === stage.key;
          const dateReached = stageProgress[stage.key]?.date;

          return (
            <div key={stage.key} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              {/* Stage node */}
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                minWidth: 80,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: isReached ? stage.color : "var(--bg-hover)",
                  color: isReached ? "#fff" : "var(--text-tertiary)",
                  border: isCurrent ? `3px solid ${stage.color}` : "3px solid transparent",
                  transition: "all 0.3s ease",
                  boxShadow: isCurrent ? `0 0 12px ${stage.color}66` : "none",
                }}>
                  {stage.icon}
                </div>
                <div style={{
                  fontSize: 10, fontWeight: isCurrent ? 700 : 500,
                  color: isReached ? "var(--text-primary)" : "var(--text-tertiary)",
                  textAlign: "center",
                }}>
                  {stage.label}
                </div>
                {dateReached && (
                  <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>
                    {new Date(dateReached).toLocaleDateString()}
                  </div>
                )}
              </div>

              {/* Connector line */}
              {idx < STAGES.length - 1 && (
                <div style={{
                  width: 40, height: 2,
                  background: stageProgress[STAGES[idx + 1].key]?.reached ? stage.color : "var(--border-subtle)",
                  margin: "0 4px", marginBottom: 20,
                  transition: "background 0.3s ease",
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Event feed */}
      <div style={{ maxHeight: 400, overflowY: "auto" }}>
        {events.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
            No journey events yet. This customer's story will appear here as they interact with your store.
          </div>
        ) : (
          events.map((event, idx) => <JourneyEvent key={idx} event={event} />)
        )}
      </div>
    </div>
  );
}

/**
 * Determine the customer's current stage.
 */
function determineStage(customer, events) {
  if (!customer) return "lead";

  const totalOrders = customer.total_orders || 0;
  const totalSpent = Number(customer.total_spent) || 0;
  const lifecycleStage = customer.lifecycle_stage;

  if (lifecycleStage === "churned") return "churned";
  if (totalOrders >= 5 || totalSpent >= 1000) return "vip";
  if (totalOrders >= 2) return "repeat";
  if (totalOrders === 1) return "first_order";
  if (events.length > 0 || lifecycleStage === "prospect") return "prospect";
  return "lead";
}

/**
 * Compute which stages have been reached + when.
 */
function computeStageProgress(events, customer) {
  const progress = {};
  const now = new Date();

  // Lead: always reached (customer exists)
  progress.lead = { reached: true, date: customer?.created_at };

  // Prospect: first message sent
  const firstMessage = events.find(e => e.event_type === "message" || e.type === "message");
  if (firstMessage) {
    progress.prospect = { reached: true, date: firstMessage.created_at || firstMessage.date };
  } else if (events.length > 0) {
    progress.prospect = { reached: true, date: events[0].created_at };
  }

  // First order: first order event
  const firstOrder = events.find(e => e.event_type === "order" || e.type === "order");
  if (firstOrder) {
    progress.first_order = { reached: true, date: firstOrder.created_at };
  } else if (customer?.total_orders >= 1) {
    progress.first_order = { reached: true, date: customer?.last_active_at };
  }

  // Repeat: 2+ orders
  if ((customer?.total_orders || 0) >= 2) {
    const orders = events.filter(e => e.event_type === "order" || e.type === "order");
    progress.repeat = { reached: true, date: orders[1]?.created_at || customer?.last_active_at };
  }

  // VIP: 5+ orders or $1000+ spent
  if ((customer?.total_orders || 0) >= 5 || (Number(customer?.total_spent) || 0) >= 1000) {
    progress.vip = { reached: true, date: customer?.last_active_at };
  }

  // Churned
  if (customer?.lifecycle_stage === "churned") {
    progress.churned = { reached: true, date: customer?.last_active_at };
  }

  return progress;
}

/**
 * Individual journey event renderer.
 */
function JourneyEvent({ event }) {
  const type = event.event_type || event.type;
  const icon = getEventIcon(type);
  const color = getEventColor(type);
  const title = event.title || event.event_type || "Event";
  const description = event.description || event.content || "";
  const date = event.created_at || event.date;

  return (
    <div style={{
      display: "flex", gap: 12, padding: "10px 0",
      borderBottom: "1px solid var(--border-subtle)",
    }}>
      {/* Icon */}
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: `${color}15`, color: color,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            {title}
          </span>
          {date && (
            <span style={{ fontSize: 11, color: "var(--text-tertiary)", flexShrink: 0 }}>
              {new Date(date).toLocaleDateString()}
            </span>
          )}
        </div>
        {description && (
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.4 }}>
            {description.slice(0, 200)}
            {description.length > 200 && "..."}
          </div>
        )}
        {/* Metadata badges */}
        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          {type && (
            <span style={{
              padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600,
              background: `${color}15`, color: color,
            }}>
              {type.replace(/_/g, " ")}
            </span>
          )}
          {event.channel && (
            <span style={{ padding: "1px 6px", borderRadius: 4, fontSize: 10, background: "var(--bg-hover)", color: "var(--text-tertiary)" }}>
              {event.channel}
            </span>
          )}
          {event.total != null && (
            <span style={{ padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: "rgba(0, 200, 83, 0.1)", color: "#00c853" }}>
              {event.total} {event.currency || ""}
            </span>
          )}
          {event.rating != null && (
            <span style={{ padding: "1px 6px", borderRadius: 4, fontSize: 10, background: "rgba(255, 193, 7, 0.1)", color: "#ffc107" }}>
              ★ {event.rating}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function getEventIcon(type) {
  const t = (type || "").toLowerCase();
  if (t.includes("message") || t.includes("conversation")) return <MessageCircle size={14} />;
  if (t.includes("order")) return <ShoppingBag size={14} />;
  if (t.includes("review")) return <Star size={14} />;
  if (t.includes("note")) return <Tag size={14} />;
  if (t.includes("task")) return <CheckCircle size={14} />;
  if (t.includes("call") || t.includes("phone")) return <Phone size={14} />;
  if (t.includes("email")) return <Mail size={14} />;
  return <Clock size={14} />;
}

function getEventColor(type) {
  const t = (type || "").toLowerCase();
  if (t.includes("message")) return "#2196f3";
  if (t.includes("order")) return "#00c853";
  if (t.includes("review")) return "#ffc107";
  if (t.includes("note")) return "#9c27b0";
  if (t.includes("task")) return "#ff9800";
  if (t.includes("complaint") || t.includes("escalation")) return "#ff5252";
  return "#90a4ae";
}
