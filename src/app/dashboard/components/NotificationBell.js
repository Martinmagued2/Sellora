"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  ShoppingBag,
  MessageCircle,
  Bot,
  DollarSign,
  Package,
  Megaphone,
  UserPlus,
  AlertTriangle,
  CheckCircle2,
  Check,
  ExternalLink,
} from "lucide-react";

// Map notification types to icons and colors
const NOTIFICATION_TYPE_CONFIG = {
  new_order: {
    icon: ShoppingBag,
    color: "#F8A532",
    bgColor: "rgba(248, 165, 50, 0.12)",
    label: "New Order",
  },
  new_message: {
    icon: MessageCircle,
    color: "#00D2FF",
    bgColor: "rgba(0, 210, 255, 0.12)",
    label: "New Message",
  },
  ai_escalation: {
    icon: Bot,
    color: "#ED4245",
    bgColor: "rgba(237, 66, 69, 0.12)",
    label: "AI Escalation",
  },
  payment_received: {
    icon: DollarSign,
    color: "#3BA55C",
    bgColor: "rgba(59, 165, 92, 0.12)",
    label: "Payment",
  },
  low_stock: {
    icon: Package,
    color: "#F8A532",
    bgColor: "rgba(248, 165, 50, 0.12)",
    label: "Low Stock",
  },
  campaign_sent: {
    icon: Megaphone,
    color: "#5865F2",
    bgColor: "rgba(88, 101, 242, 0.12)",
    label: "Campaign",
  },
  team_invite: {
    icon: UserPlus,
    color: "#EB459E",
    bgColor: "rgba(235, 69, 158, 0.12)",
    label: "Team",
  },
  system: {
    icon: AlertTriangle,
    color: "#8E9297",
    bgColor: "rgba(142, 146, 151, 0.12)",
    label: "System",
  },
};

function getTimeAgo(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function NotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const panelRef = useRef(null);
  const bellRef = useRef(null);

  // Initial fetch + auto-refresh every 30 seconds
  useEffect(() => {
    let cancelled = false;

    const doFetch = async () => {
      try {
        const res = await fetch("/api/notifications?limit=10&unread=false");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setNotifications(data.notifications || []);
          setUnreadCount(data.unread_count || 0);
        }
      } catch (err) {
        if (!cancelled) console.error("[NotificationBell] Fetch error:", err);
      }
    };

    doFetch();
    const interval = setInterval(doFetch, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        bellRef.current &&
        !bellRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleMarkAllRead = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all: true }),
      });
      if (res.ok) {
        setUnreadCount(0);
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, read: true }))
        );
      }
    } catch (err) {
      console.error("[NotificationBell] Mark all read error:", err);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleMarkSingleRead = async (notifId) => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_id: notifId }),
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("[NotificationBell] Mark read error:", err);
    }
  };

  const handleNotificationClick = (notif) => {
    // Mark as read on click
    if (!notif.read) {
      handleMarkSingleRead(notif.id);
    }

    // Navigate based on type
    const navMap = {
      new_order: "/dashboard/orders",
      new_message: "/dashboard/conversations",
      ai_escalation: "/dashboard/conversations",
      payment_received: "/dashboard/orders",
      low_stock: "/dashboard/products",
      campaign_sent: "/dashboard/campaigns",
      team_invite: "/dashboard/settings",
      system: null,
    };

    const target = navMap[notif.type];
    if (target) {
      setIsOpen(false);
      router.push(target);
    }
  };

  const handleViewAll = () => {
    setIsOpen(false);
    router.push("/dashboard/notifications");
  };

  return (
    <>
      {/* Bell Button */}
      <button
        ref={bellRef}
        className="topbar-btn"
        id="topbar-notifications"
        title="Notifications"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        style={{ position: "relative" }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <motion.span
            className="notification-badge"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              minWidth: 18,
              height: 18,
              borderRadius: "50%",
              background: "var(--accent-red)",
              color: "white",
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
              border: "2px solid var(--bg-primary)",
              lineHeight: 1,
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "absolute",
              right: 0,
              top: "100%",
              width: 380,
              zIndex: 100,
              background: "var(--bg-secondary)",
              borderRadius: 16,
              boxShadow: "0 16px 48px rgba(0, 0, 0, 0.3), 0 0 0 1px var(--border-subtle)",
              overflow: "hidden",
              marginTop: 8,
            }}
            role="menu"
            aria-label="Notifications panel"
          >
            {/* Header */}
            <div
              style={{
                padding: "14px 16px",
                fontWeight: 700,
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 15 }}>Notifications</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {unreadCount > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--accent-primary-light)",
                      fontWeight: 500,
                    }}
                  >
                    {unreadCount} unread
                  </span>
                )}
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    disabled={markingAll}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--accent-primary-light)",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: markingAll ? "wait" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      opacity: markingAll ? 0.5 : 1,
                    }}
                  >
                    <Check size={12} />
                    {markingAll ? "Marking..." : "Mark all read"}
                  </button>
                )}
              </div>
            </div>

            {/* Notification List */}
            <div
              style={{
                maxHeight: 400,
                overflowY: "auto",
                scrollbarWidth: "thin",
                scrollbarColor: "var(--border-medium) transparent",
              }}
            >
              {notifications.length === 0 ? (
                <div
                  style={{
                    padding: 40,
                    textAlign: "center",
                    color: "var(--text-tertiary)",
                  }}
                >
                  <CheckCircle2
                    size={32}
                    style={{
                      margin: "0 auto 12px",
                      opacity: 0.4,
                      display: "block",
                    }}
                  />
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                    All caught up!
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    No notifications right now
                  </div>
                </div>
              ) : (
                notifications.map((notif) => {
                  const config = NOTIFICATION_TYPE_CONFIG[notif.type] || NOTIFICATION_TYPE_CONFIG.system;
                  const Icon = config.icon;

                  return (
                    <button
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        width: "100%",
                        padding: "12px 16px",
                        background: notif.read
                          ? "transparent"
                          : "rgba(88, 101, 242, 0.04)",
                        border: "none",
                        borderBottom: "1px solid var(--border-subtle)",
                        cursor: "pointer",
                        color: "var(--text-primary)",
                        textAlign: "left",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = notif.read
                          ? "var(--bg-glass-hover)"
                          : "rgba(88, 101, 242, 0.08)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = notif.read
                          ? "transparent"
                          : "rgba(88, 101, 242, 0.04)";
                      }}
                    >
                      {/* Icon */}
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: config.bgColor,
                          color: config.color,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={16} />
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            marginBottom: 2,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: notif.read ? 500 : 700,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {notif.title}
                          </span>
                          {!notif.read && (
                            <span
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: "50%",
                                background: "var(--accent-primary)",
                                flexShrink: 0,
                              }}
                            />
                          )}
                        </div>
                        {notif.message && (
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--text-tertiary)",
                              lineHeight: 1.4,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              marginBottom: 3,
                            }}
                          >
                            {notif.message}
                          </div>
                        )}
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-tertiary)",
                            opacity: 0.7,
                          }}
                        >
                          {getTimeAgo(notif.created_at)}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                borderTop: "1px solid var(--border-subtle)",
                padding: "8px 0",
              }}
            >
              {/* Enable push notifications button */}
              <EnablePushButton />
              <button
                onClick={handleViewAll}
                style={{
                  width: "100%",
                  padding: "10px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--accent-primary-light)",
                  fontSize: 12,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-glass-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "none";
                }}
              >
                View All Notifications
                <ExternalLink size={12} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * EnablePushButton — shows a "Enable push notifications" button in the
 * notification dropdown footer. When clicked, requests permission and
 * subscribes the browser to web push.
 *
 * Hides itself if:
 *   - Push is not supported in this browser
 *   - Permission is already granted
 *   - Push is not configured on the server (no VAPID key)
 */
function EnablePushButton() {
  const [status, setStatus] = useState("idle"); // idle | checking | granted | denied | unsupported | not-configured
  const [pushSupported, setPushSupported] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("PushManager" in window) || !("serviceWorker" in navigator)) {
      setPushSupported(false);
      setStatus("unsupported");
      return;
    }
    // Check existing permission
    if (Notification.permission === "granted") {
      setStatus("granted");
    }
    // Check if push is configured on the server
    fetch("/api/push/vapid-key")
      .then((r) => r.json())
      .then((data) => {
        if (!data.configured) setStatus("not-configured");
      })
      .catch(() => setStatus("not-configured"));
  }, []);

  const handleEnable = async () => {
    setStatus("checking");
    try {
      const { requestPushPermissionAndSubscribe } = await import("./PushSubscriptionManager");
      const ok = await requestPushPermissionAndSubscribe();
      setStatus(ok ? "granted" : "denied");
    } catch (e) {
      setStatus("denied");
    }
  };

  if (status === "granted") {
    return (
      <div style={{
        padding: "8px 12px",
        fontSize: 11,
        color: "var(--accent-green)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}>
        <CheckCircle2 size={12} />
        Push notifications enabled
      </div>
    );
  }

  if (status === "unsupported") return null;
  if (status === "not-configured") return null;
  if (status === "denied") {
    return (
      <div style={{
        padding: "8px 12px",
        fontSize: 11,
        color: "var(--text-tertiary)",
        textAlign: "center",
      }}>
        Notifications blocked — enable in browser settings
      </div>
    );
  }

  return (
    <button
      onClick={handleEnable}
      disabled={status === "checking"}
      style={{
        width: "100%",
        padding: "10px",
        background: "var(--accent-gradient)",
        border: "none",
        cursor: status === "checking" ? "wait" : "pointer",
        color: "#fff",
        fontSize: 12,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        marginBottom: 4,
        opacity: status === "checking" ? 0.7 : 1,
      }}
    >
      <Bell size={12} />
      {status === "checking" ? "Enabling…" : "Enable push notifications"}
    </button>
  );
}
