"use client";

import { ToggleLeft, ToggleRight } from "lucide-react";

export default function NotificationsTab({
  notifPrefs, setNotifPrefs, supabase,
}) {
  return (
    <div className="dashboard-panel">
      <div className="dashboard-panel-header"><h3>Notification Preferences</h3></div>
      <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
        {[
          { key: "new_message", label: "New message received", desc: "Get notified when a customer sends a new message" },
          { key: "new_order", label: "New order placed", desc: "Get notified when a new order is created" },
          { key: "order_status", label: "Order status changed", desc: "Get notified when an order status changes" },
          { key: "daily_summary", label: "Daily summary email", desc: "Receive a daily summary of conversations and orders" },
        ].map((n, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "var(--space-lg) 0",
            borderBottom: i < 3 ? "1px solid var(--border-subtle)" : "none",
          }}>
            <div>
              <div style={{ fontWeight: 500, marginBottom: 2 }}>{n.label}</div>
              <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>{n.desc}</div>
            </div>
            <div style={{ color: notifPrefs[n.key] ? "var(--accent-green)" : "var(--text-tertiary)", cursor: "pointer" }} onClick={async () => {
              const newPrefs = { ...notifPrefs, [n.key]: !notifPrefs[n.key] };
              setNotifPrefs(newPrefs);
              // Save to DB
              try {
                const { data: { user } } = await supabase.auth.getUser();
                await supabase.from('accounts').update({ notification_prefs: newPrefs }).eq('id', user.id);
              } catch (e) {}
            }}>
              {notifPrefs[n.key] ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
