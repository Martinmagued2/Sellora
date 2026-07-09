"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag,
  MessageCircle,
  Bot,
  DollarSign,
  Package,
  Megaphone,
  UserPlus,
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Filter,
} from "lucide-react";

const NOTIFICATION_TYPE_CONFIG = {
  new_order: {
    icon: ShoppingBag,
    color: "#F8A532",
    bgColor: "rgba(248, 165, 50, 0.12)",
    label: "New Order",
    category: "orders",
  },
  new_message: {
    icon: MessageCircle,
    color: "#00D2FF",
    bgColor: "rgba(0, 210, 255, 0.12)",
    label: "New Message",
    category: "messages",
  },
  ai_escalation: {
    icon: Bot,
    color: "#ED4245",
    bgColor: "rgba(237, 66, 69, 0.12)",
    label: "AI Escalation",
    category: "messages",
  },
  payment_received: {
    icon: DollarSign,
    color: "#3BA55C",
    bgColor: "rgba(59, 165, 92, 0.12)",
    label: "Payment",
    category: "orders",
  },
  low_stock: {
    icon: Package,
    color: "#F8A532",
    bgColor: "rgba(248, 165, 50, 0.12)",
    label: "Low Stock",
    category: "system",
  },
  campaign_sent: {
    icon: Megaphone,
    color: "#5865F2",
    bgColor: "rgba(88, 101, 242, 0.12)",
    label: "Campaign",
    category: "system",
  },
  team_invite: {
    icon: UserPlus,
    color: "#EB459E",
    bgColor: "rgba(235, 69, 158, 0.12)",
    label: "Team",
    category: "system",
  },
  system: {
    icon: AlertTriangle,
    color: "#8E9297",
    bgColor: "rgba(142, 146, 151, 0.12)",
    label: "System",
    category: "system",
  },
};

const FILTER_TABS = [
  { key: "all", label: "All", types: null },
  { key: "unread", label: "Unread", types: null, unreadOnly: true },
  { key: "orders", label: "Orders", types: ["new_order", "payment_received"] },
  { key: "messages", label: "Messages", types: ["new_message", "ai_escalation"] },
  { key: "system", label: "System", types: ["low_stock", "campaign_sent", "team_invite", "system"] },
];

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
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getFullDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [hasMore, setHasMore] = useState(false);
  const loadMoreRef = useRef(null);
  const PAGE_SIZE = 20;

  const currentFilter = FILTER_TABS.find((t) => t.key === activeTab);

  // Fetch on mount and tab change
  useEffect(() => {
    let cancelled = false;

    const doFetch = async () => {
      try {
        setLoading(true);

        let url = `/api/notifications?limit=${PAGE_SIZE}&offset=0`;
        if (currentFilter?.unreadOnly) {
          url += "&unread=true";
        }
        if (currentFilter?.types) {
          url += `&type=${currentFilter.types.join(",")}`;
        }

        const res = await fetch(url);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setNotifications(data.notifications || []);
          setUnreadCount(data.unread_count || 0);
          setTotal(data.total || 0);
          setHasMore(data.has_more || false);
        }
      } catch (err) {
        if (!cancelled) console.error("[NotificationsPage] Fetch error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    doFetch();
    return () => { cancelled = true; };
  }, [activeTab, currentFilter]);

  // Load more function (for infinite scroll)
  const loadMore = useCallback(async () => {
    if (loadingMore || loading) return;
    try {
      setLoadingMore(true);

      let url = `/api/notifications?limit=${PAGE_SIZE}&offset=${notifications.length}`;
      if (currentFilter?.unreadOnly) {
        url += "&unread=true";
      }
      if (currentFilter?.types) {
        url += `&type=${currentFilter.types.join(",")}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setNotifications((prev) => [...prev, ...(data.notifications || [])]);
        setUnreadCount(data.unread_count || 0);
        setTotal(data.total || 0);
        setHasMore(data.has_more || false);
      }
    } catch (err) {
      console.error("[NotificationsPage] Load more error:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, loading, notifications.length, currentFilter]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, loadMore]);

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
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      }
    } catch (err) {
      console.error("[NotificationsPage] Mark all read error:", err);
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
      console.error("[NotificationsPage] Mark read error:", err);
    }
  };

  const handleNotificationClick = (notif) => {
    if (!notif.read) {
      handleMarkSingleRead(notif.id);
    }

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
      router.push(target);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1>Notifications</h1>
          <p
            style={{
              color: "var(--text-tertiary)",
              fontSize: "var(--font-size-sm)",
              marginTop: 4,
            }}
          >
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
              : "You're all caught up"}
          </p>
        </div>
        <div className="page-header-actions">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markingAll}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                background: "var(--bg-glass)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                color: "var(--accent-primary-light)",
                fontSize: "var(--font-size-sm)",
                fontWeight: 600,
                cursor: markingAll ? "wait" : "pointer",
                transition: "all 0.15s ease",
                opacity: markingAll ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--bg-glass-hover)";
                e.currentTarget.style.borderColor = "var(--border-medium)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--bg-glass)";
                e.currentTarget.style.borderColor = "var(--border-subtle)";
              }}
            >
              <Check size={14} />
              {markingAll ? "Marking..." : "Mark all as read"}
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: "var(--space-xl)",
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          padding: 4,
          overflowX: "auto",
        }}
      >
        {FILTER_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "8px 18px",
                fontSize: "var(--font-size-sm)",
                fontWeight: isActive ? 600 : 500,
                color: isActive
                  ? "var(--accent-primary-light)"
                  : "var(--text-secondary)",
                background: isActive
                  ? "rgba(88, 101, 242, 0.12)"
                  : "transparent",
                border: "none",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
                position: "relative",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "var(--bg-glass-hover)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }
              }}
            >
              {tab.label}
              {tab.key === "unread" && unreadCount > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 18,
                    height: 18,
                    padding: "0 5px",
                    borderRadius: "var(--radius-full)",
                    background: "var(--accent-primary)",
                    color: "white",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Notifications List */}
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-xl)",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <div
            style={{
              padding: 60,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              color: "var(--text-tertiary)",
            }}
          >
            <Loader2 size={24} className="spin" />
            <span style={{ fontSize: "var(--font-size-sm)" }}>
              Loading notifications...
            </span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="empty-state">
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "var(--bg-glass)",
                border: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto var(--space-lg)",
                color: "var(--text-tertiary)",
              }}
            >
              <Bell size={28} />
            </div>
            <h3
              style={{
                fontSize: "var(--font-size-xl)",
                fontWeight: 700,
                marginBottom: "var(--space-sm)",
              }}
            >
              No notifications
            </h3>
            <p
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--text-tertiary)",
                maxWidth: 400,
                margin: "0 auto",
              }}
            >
              {activeTab === "unread"
                ? "You have no unread notifications. Great job staying on top of things!"
                : activeTab === "all"
                ? "When you receive orders, messages, or system alerts, they'll appear here."
                : `No ${activeTab} notifications found.`}
            </p>
          </div>
        ) : (
          <>
            <AnimatePresence mode="popLayout">
              {notifications.map((notif, index) => {
                const config =
                  NOTIFICATION_TYPE_CONFIG[notif.type] ||
                  NOTIFICATION_TYPE_CONFIG.system;
                const Icon = config.icon;

                return (
                  <motion.div
                    key={notif.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2, delay: index * 0.03 }}
                    layout
                  >
                    <button
                      onClick={() => handleNotificationClick(notif)}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 16,
                        width: "100%",
                        padding: "16px 20px",
                        background: notif.read
                          ? "transparent"
                          : "rgba(88, 101, 242, 0.03)",
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
                          : "rgba(88, 101, 242, 0.06)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = notif.read
                          ? "transparent"
                          : "rgba(88, 101, 242, 0.03)";
                      }}
                    >
                      {/* Icon */}
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 12,
                          background: config.bgColor,
                          color: config.color,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                      >
                        <Icon size={18} />
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: notif.read ? 500 : 700,
                              flex: 1,
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
                                width: 8,
                                height: 8,
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
                              fontSize: "var(--font-size-sm)",
                              color: "var(--text-tertiary)",
                              lineHeight: 1.5,
                              marginBottom: 6,
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {notif.message}
                          </div>
                        )}

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 11,
                            color: "var(--text-tertiary)",
                            opacity: 0.8,
                          }}
                        >
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "2px 8px",
                              borderRadius: "var(--radius-full)",
                              background: config.bgColor,
                              color: config.color,
                              fontWeight: 600,
                              fontSize: 10,
                            }}
                          >
                            {config.label}
                          </span>
                          <span>{getTimeAgo(notif.created_at)}</span>
                        </div>
                      </div>

                      {/* Mark read button */}
                      {!notif.read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkSingleRead(notif.id);
                          }}
                          title="Mark as read"
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "var(--radius-sm)",
                            background: "none",
                            border: "1px solid var(--border-subtle)",
                            color: "var(--text-tertiary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            flexShrink: 0,
                            transition: "all 0.15s ease",
                            marginTop: 4,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background =
                              "var(--bg-glass-hover)";
                            e.currentTarget.style.borderColor =
                              "var(--border-medium)";
                            e.currentTarget.style.color =
                              "var(--accent-primary-light)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "none";
                            e.currentTarget.style.borderColor =
                              "var(--border-subtle)";
                            e.currentTarget.style.color =
                              "var(--text-tertiary)";
                          }}
                        >
                          <Check size={12} />
                        </button>
                      )}
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Load More Trigger */}
            {hasMore && (
              <div
                ref={loadMoreRef}
                style={{
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  color: "var(--text-tertiary)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                {loadingMore ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    Loading more...
                  </>
                ) : (
                  "Scroll for more"
                )}
              </div>
            )}

            {/* End of list */}
            {!hasMore && notifications.length > 0 && (
              <div
                style={{
                  padding: "16px 20px",
                  textAlign: "center",
                  color: "var(--text-tertiary)",
                  fontSize: "var(--font-size-xs)",
                  opacity: 0.6,
                }}
              >
                Showing {notifications.length} of {total} notification
                {total !== 1 ? "s" : ""}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
