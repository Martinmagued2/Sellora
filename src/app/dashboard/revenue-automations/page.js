"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, TrendingUp, Package, ShoppingCart, CreditCard, Crown, Save, Check } from "lucide-react";
import { useToast } from "../components/ToastProvider";

const AUTOMATIONS = [
  { id: 'winback', icon: TrendingUp, color: '#6c5ce7', title: 'Win-Back Campaigns', desc: 'Auto-message dormant customers with a discount to bring them back.' },
  { id: 'backinstock', icon: Package, color: '#00b894', title: 'Back-in-Stock Alerts', desc: 'Notify customers when a product they wanted is restocked.' },
  { id: 'upsell', icon: ShoppingCart, color: '#fdcb6e', title: 'Post-Purchase Upsell', desc: 'Suggest complementary products 3 days after delivery.' },
  { id: 'payment_recovery', icon: CreditCard, color: '#e17055', title: 'Failed Payment Recovery', desc: 'Auto-message customers with failed payments + small discount.' },
  { id: 'vip', icon: Crown, color: '#fd79a8', title: 'VIP Customer Automation', desc: 'Auto-tag high-spenders + send them a VIP welcome message.' },
];

export default function RevenueAutomationsPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [settings, setSettings] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const res = await fetch('/api/automation/revenue-suite/status');
      const data = await res.json();
      if (data.settings) {
        setSettings(data.settings);
        setStats(data.stats);
      }
    } catch (e) {
      toast.error('Failed to load automation settings');
    } finally {
      setLoading(false);
    }
  };

  const save = async (automation, fields) => {
    setSaving(automation);
    try {
      const res = await fetch('/api/automation/revenue-suite/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automation, ...fields }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success('Settings saved');
      // Update local state
      setSettings(prev => ({ ...prev, ...data.updated }));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <Loader2 size={32} className="spin" style={{ color: 'var(--accent-primary)' }} />
      </div>
    );
  }

  if (!settings) {
    return (
      <div style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
        <p>Failed to load settings. Please run migration 049 in Supabase SQL Editor.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--space-xl)', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Revenue Automations</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          5 high-ROI automations that run automatically every day. Enable the ones you want, customize the messages, and let Sellora recover revenue while you sleep.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        {/* Win-Back */}
        <AutomationCard
          config={AUTOMATIONS[0]}
          enabled={settings.winback_enabled}
          stats={stats?.winback}
          fields={[
            { key: 'winback_days_threshold', label: 'Dormant threshold (days)', type: 'number', value: settings.winback_days_threshold, min: 7, max: 365 },
            { key: 'winback_discount_percent', label: 'Discount %', type: 'number', value: settings.winback_discount_percent, min: 0, max: 100 },
            { key: 'winback_message_template', label: 'Message template', type: 'textarea', value: settings.winback_message_template, placeholder: 'Use {name}, {store}, {discount}, {code}' },
          ]}
          saving={saving === 'winback'}
          onToggle={(enabled) => save('winback', { winback_enabled: enabled })}
          onSave={(fields) => save('winback', fields)}
        />

        {/* Back-in-Stock */}
        <AutomationCard
          config={AUTOMATIONS[1]}
          enabled={settings.back_in_stock_enabled}
          stats={stats?.backinstock}
          fields={[
            { key: 'back_in_stock_message_template', label: 'Message template', type: 'textarea', value: settings.back_in_stock_message_template, placeholder: 'Use {name}, {product}, {store_url}' },
          ]}
          saving={saving === 'backinstock'}
          onToggle={(enabled) => save('backinstock', { back_in_stock_enabled: enabled })}
          onSave={(fields) => save('backinstock', fields)}
        />

        {/* Upsell */}
        <AutomationCard
          config={AUTOMATIONS[2]}
          enabled={settings.upsell_enabled}
          stats={stats?.upsell}
          fields={[
            { key: 'upsell_delay_days', label: 'Delay after delivery (days)', type: 'number', value: settings.upsell_delay_days, min: 1, max: 30 },
            { key: 'upsell_discount_percent', label: 'Discount %', type: 'number', value: settings.upsell_discount_percent, min: 0, max: 100 },
            { key: 'upsell_message_template', label: 'Message template', type: 'textarea', value: settings.upsell_message_template, placeholder: 'Use {name}, {item}, {accessory}, {discount}' },
          ]}
          saving={saving === 'upsell'}
          onToggle={(enabled) => save('upsell', { upsell_enabled: enabled })}
          onSave={(fields) => save('upsell', fields)}
        />

        {/* Payment Recovery */}
        <AutomationCard
          config={AUTOMATIONS[3]}
          enabled={settings.payment_recovery_enabled}
          stats={stats?.payrec}
          fields={[
            { key: 'payment_recovery_discount_percent', label: 'Discount %', type: 'number', value: settings.payment_recovery_discount_percent, min: 0, max: 100 },
            { key: 'payment_recovery_message_template', label: 'Message template', type: 'textarea', value: settings.payment_recovery_message_template, placeholder: 'Use {name}, {discount}, {code}' },
          ]}
          saving={saving === 'payment_recovery'}
          onToggle={(enabled) => save('payment_recovery', { payment_recovery_enabled: enabled })}
          onSave={(fields) => save('payment_recovery', fields)}
        />

        {/* VIP */}
        <AutomationCard
          config={AUTOMATIONS[4]}
          enabled={settings.vip_enabled}
          stats={stats?.vip}
          fields={[
            { key: 'vip_threshold', label: 'VIP spend threshold (EGP)', type: 'number', value: settings.vip_threshold, min: 100, max: 1000000 },
            { key: 'vip_welcome_message', label: 'Welcome message', type: 'textarea', value: settings.vip_welcome_message, placeholder: 'Use {name}' },
          ]}
          saving={saving === 'vip'}
          onToggle={(enabled) => save('vip', { vip_enabled: enabled })}
          onSave={(fields) => save('vip', fields)}
        />
      </div>
    </div>
  );
}

function AutomationCard({ config, enabled, stats, fields, saving, onToggle, onSave }) {
  const [localFields, setLocalFields] = useState({});
  const Icon = config.icon;

  useEffect(() => {
    const init = {};
    fields.forEach(f => { init[f.key] = f.value; });
    setLocalFields(init);
  }, [fields]);

  const hasChanges = fields.some(f => localFields[f.key] !== f.value);

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${enabled ? config.color + '40' : 'var(--border-medium)'}`,
      borderRadius: 'var(--radius-xl)',
      padding: 'var(--space-xl)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-md)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: config.color + '20', color: config.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon size={22} />
          </div>
          <div>
            <h3 style={{ fontWeight: 600, marginBottom: 4 }}>{config.title}</h3>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', maxWidth: 500 }}>{config.desc}</p>
          </div>
        </div>
        <button
          onClick={() => onToggle(!enabled)}
          style={{
            width: 48, height: 26, borderRadius: 13,
            background: enabled ? config.color : 'var(--bg-tertiary)',
            position: 'relative', cursor: 'pointer', border: 'none',
            transition: 'background 0.2s',
          }}
        >
          <div style={{
            position: 'absolute', top: 3, left: enabled ? 25 : 3,
            width: 20, height: 20, borderRadius: '50%',
            background: 'white', transition: 'left 0.2s',
          }} />
        </button>
      </div>

      {stats && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 'var(--space-md)', fontSize: 12, color: 'var(--text-tertiary)' }}>
          <span>Sent: <strong style={{ color: 'var(--text-primary)' }}>{stats.sent}</strong></span>
          {(stats.recovered > 0 || stats.expired > 0) && (
            <>
              <span>Recovered: <strong style={{ color: 'var(--accent-green)' }}>{stats.recovered}</strong></span>
              <span>Expired: <strong style={{ color: 'var(--accent-red)' }}>{stats.expired}</strong></span>
            </>
          )}
          <span>Total: <strong style={{ color: 'var(--text-primary)' }}>{stats.total}</strong></span>
        </div>
      )}

      {enabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
          {fields.map(f => (
            <div key={f.key}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea
                  className="form-input"
                  value={localFields[f.key] || ''}
                  onChange={(e) => setLocalFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  rows={3}
                  style={{ width: '100%', fontSize: 13, resize: 'vertical' }}
                />
              ) : (
                <input
                  type="number"
                  className="form-input"
                  value={localFields[f.key] ?? ''}
                  onChange={(e) => setLocalFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                  min={f.min}
                  max={f.max}
                  style={{ width: 200, fontSize: 13 }}
                />
              )}
            </div>
          ))}
          {hasChanges && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onSave(localFields)}
              disabled={saving}
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
