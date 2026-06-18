"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ShoppingBag, MessageCircle, UserPlus, Bot, Star, Tag,
  RefreshCw, Activity,
} from "lucide-react";

/**
 * LiveActivityFeed — shows a real-time feed of the latest activities
 * on the dashboard home. Auto-refreshes every 30 seconds.
 * Makes the dashboard feel alive.
 */
export default function LiveActivityFeed({ limit = 8 }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch recent notifications as activity items
      const { data: notifs } = await supabase
        .from("notifications")
        .select("id, type, title, body, created_at, read")
        .eq("account_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (notifs && notifs.length > 0) {
        const mapped = notifs.map(n => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          time: n.created_at,
          read: n.read,
          icon: getActivityIcon(n.type),
          color: getActivityColor(n.type),
        }));
        setActivities(mapped);
      } else {
        setActivities([]);
      }
    } catch (e) {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      background: "var(--bg-card, rgba(33,34,44,0.7))",
      border: "1px solid var(--border-subtle, rgba(255,255,255,0.06))",
      borderRadius: 14, padding: 16, maxHeight: 320, overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Activity size={16} color="var(--accent-primary)" />
          <span style={{ fontSize: 14, fontWeight: 700 }}>Recent Activity</span>
          {/* Live dot */}
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "#3BA55C",
            animation: "live-pulse 2s ease-in-out infinite",
          }} />
          <style>{`@keyframes live-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
        </div>
        <button onClick={load} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Feed */}
      {loading ? (
        <div style={{ padding: 20, textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>Loading activity...</div>
      ) : activities.length === 0 ? (
        <div style={{ padding: 20, textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>
          No activity yet. Connect WhatsApp to start receiving messages!
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {activities.map((act, i) => {
            const Icon = act.icon;
            return (
              <div
                key={act.id}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "8px 4px",
                  borderBottom: i < activities.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
                  opacity: act.read ? 0.5 : 1,
                  animation: !act.read && i === 0 ? "activity-slide-in 0.4s ease" : "none",
                }}
              >
                <style>{`@keyframes activity-slide-in { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }`}</style>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: act.color + "15",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, marginTop: 1,
                }}>
                  <Icon size={13} color={act.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {act.title}
                  </div>
                  {act.body && (
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {act.body}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 10, color: "var(--text-tertiary)", flexShrink: 0, marginTop: 2 }}>
                  {timeAgo(act.time)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getActivityIcon(type) {
  const map = {
    new_order: ShoppingBag,
    new_message: MessageCircle,
    team_invite: UserPlus,
    ai_escalation: Bot,
    payment_received: Tag,
    low_stock: Activity,
    campaign_sent: MessageCircle,
    low_review: Star,
    install_bonus: Star,
  };
  return map[type] || Activity;
}

function getActivityColor(type) {
  const map = {
    new_order: "#F8A532",
    new_message: "#00D2FF",
    team_invite: "#5865F2",
    ai_escalation: "#ED4245",
    payment_received: "#3BA55C",
    low_stock: "#F8A532",
    campaign_sent: "#5865F2",
    low_review: "#ED4245",
    install_bonus: "#3BA55C",
  };
  return map[type] || "#5865F2";
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}
