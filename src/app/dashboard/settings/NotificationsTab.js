"use client";

import { useState, useEffect } from "react";
import { Loader2, Save, Bell, Mail, Smartphone, Monitor } from "lucide-react";
import { useToast } from "../components/ToastProvider";

const CATEGORIES = [
  { key: "orders", label: "Orders", desc: "New orders, status changes, cancellations", icon: "🛒" },
  { key: "messages", label: "Messages", desc: "New conversations, customer replies", icon: "💬" },
  { key: "payments", label: "Payments", desc: "Payment received, failed, refunded", icon: "💳" },
  { key: "products", label: "Products", desc: "Product created, updated, out of stock", icon: "📦" },
  { key: "customers", label: "Customers", desc: "New customer, profile enriched, VIP tagged", icon: "👥" },
  { key: "reviews", label: "Reviews", desc: "New review submitted, negative review alert", icon: "⭐" },
  { key: "team", label: "Team", desc: "Team invites, role changes, member accepted", icon: "🤝" },
  { key: "channels", label: "Channels", desc: "Channel connected, disconnected, webhook errors", icon: "📡" },
  { key: "ai", label: "AI Activity", desc: "AI escalations, AI failures, copilot usage", icon: "🤖" },
  { key: "automation", label: "Automations", desc: "Win-back sent, upsell triggered, churn alerts", icon: "⚡" },
  { key: "security", label: "Security", desc: "2FA changes, suspicious logins, password changes", icon: "🔒" },
  { key: "system", label: "System", desc: "Maintenance, updates, billing reminders", icon: "⚙️" },
];

export default function NotificationsTab() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await fetch('/api/notifications/preferences');
      const data = await res.json();
      if (data.prefs) {
        // Ensure all categories exist
        const full = {};
        for (const cat of CATEGORIES) {
          full[cat.key] = data.prefs[cat.key] || { dashboard: true, push: false, email: false };
        }
        setPrefs(full);
      }
    } catch (e) {
      toast.error('Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const toggle = (category, channel) => {
    setPrefs(prev => ({
      ...prev,
      [category]: { ...prev[category], [channel]: !prev[category][channel] },
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success('Notification preferences saved');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const enableAll = (channel) => {
    const updated = {};
    for (const cat of CATEGORIES) {
      updated[cat.key] = { ...prefs[cat.key], [channel]: true };
    }
    setPrefs(updated);
  };

  const disableAll = (channel) => {
    const updated = {};
    for (const cat of CATEGORIES) {
      updated[cat.key] = { ...prefs[cat.key], [channel]: false };
    }
    setPrefs(updated);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-xl)' }}>
        <Loader2 size={24} className="spin" style={{ color: 'var(--accent-primary)' }} />
      </div>
    );
  }

  if (!prefs) {
    return <div style={{ padding: 'var(--space-xl)' }}>Failed to load preferences. Run migration 052.</div>;
  }

  return (
    <div className="dashboard-panel">
      <div className="dashboard-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>🔔 Notification Preferences</h3>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>

      <div className="dashboard-panel-body" style={{ padding: 'var(--space-xl)' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 'var(--space-lg)' }}>
          Get notified for every action that happens in your store. Toggle which categories you want to receive notifications for, and choose how you want to receive them — dashboard bell, push notification, or email.
        </p>

        {/* Bulk actions */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', alignSelf: 'center' }}>Bulk:</span>
          <button className="btn btn-secondary btn-sm" onClick={() => enableAll('dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Monitor size={12} /> Enable all dashboard
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => enableAll('push')} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Smartphone size={12} /> Enable all push
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => enableAll('email')} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Mail size={12} /> Enable all email
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => disableAll('email')} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            Disable all email
          </button>
        </div>

        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', gap: 8, padding: '0 var(--space-md) var(--space-sm)', borderBottom: '1px solid var(--border-medium)', fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
          <div>Category</div>
          <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Monitor size={12} /> Dashboard
          </div>
          <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Smartphone size={12} /> Push
          </div>
          <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Mail size={12} /> Email
          </div>
        </div>

        {/* Category rows */}
        {CATEGORIES.map((cat, i) => (
          <div key={cat.key} style={{
            display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', gap: 8,
            padding: 'var(--space-md)', alignItems: 'center',
            borderBottom: i < CATEGORIES.length - 1 ? '1px solid var(--border-subtle)' : 'none',
          }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{cat.icon}</span> {cat.label}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{cat.desc}</div>
            </div>
            {[{ ch: 'dashboard', color: '#6c5ce7' }, { ch: 'push', color: '#00b894' }, { ch: 'email', color: '#fd79a8' }].map(({ ch, color }) => (
              <div key={ch} style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={() => toggle(cat.key, ch)}
                  style={{
                    width: 40, height: 22, borderRadius: 11,
                    background: prefs[cat.key][ch] ? color : 'var(--bg-tertiary)',
                    position: 'relative', cursor: 'pointer', border: 'none',
                    transition: 'background 0.2s',
                  }}
                  title={prefs[cat.key][ch] ? `Disable ${ch}` : `Enable ${ch}`}
                >
                  <div style={{
                    position: 'absolute', top: 2, left: prefs[cat.key][ch] ? 21 : 2,
                    width: 18, height: 18, borderRadius: '50%',
                    background: 'white', transition: 'left 0.2s',
                  }} />
                </button>
              </div>
            ))}
          </div>
        ))}

        <div style={{ marginTop: 'var(--space-lg)', padding: 'var(--space-md)', background: 'var(--bg-glass)', borderRadius: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
          💡 <strong>Tip:</strong> Push notifications require you to enable them in your browser (you'll see a prompt). Email notifications use your account email — make sure it's verified. Dashboard notifications appear in the bell icon at the top of the page.
        </div>
      </div>
    </div>
  );
}
