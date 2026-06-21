"use client";

import { useState, useEffect } from "react";
import { Loader2, Truck, Package, RefreshCw, AlertTriangle, Sparkles, Clock, Zap, Save } from "lucide-react";
import { useToast } from "../components/ToastProvider";

const OPERATIONAL_AUTOMATIONS = [
  { id: 'failover', icon: RefreshCw, color: '#e17055', title: 'Channel Failover', desc: 'If WhatsApp message fails, auto-retry via SMS, then email. Ensures critical messages always reach customers.' },
  { id: 'inventory', icon: Package, color: '#fdcb6e', title: 'Inventory Auto-Reorder', desc: 'When stock hits a threshold, auto-create a reorder alert and notify you. Prevents stockouts.' },
  { id: 'carrier', icon: Truck, color: '#0984e3', title: 'Carrier Status Sync', desc: 'Auto-fetch shipping status from Aramex/Bosta/Mylerz every 2 hours → update order status → notify customer at each milestone.' },
];

const AI_AUTOMATIONS = [
  { id: 'churn', icon: AlertTriangle, color: '#d63031', title: 'Churn Prediction + Prevention', desc: 'AI analyzes customer behavior → flags at-risk customers → triggers a save campaign with a personalized discount before they leave.' },
  { id: 'recommendations', icon: Sparkles, color: '#6c5ce7', title: 'Smart Product Recommendations', desc: 'Analyzes order history to find "customers who bought this also bought..." pairs. Powers the AI recommendation engine.' },
  { id: 'send_time', icon: Clock, color: '#00b894', title: 'Optimal Send-Time AI', desc: 'Learns when each customer is most likely to respond → schedules broadcasts for their best hour. Boosts open rates 20-30%.' },
];

const DRIP_AUTOMATIONS = [
  { id: 'drip', icon: Zap, color: '#fd79a8', title: 'Multi-Step Drip Campaigns', desc: 'Extends abandoned cart recovery to a full 7-step sequence: browse abandon → cart abandon → checkout abandon → upsell → review → referral → win-back.' },
];

export default function OperationalAutomationsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [settings, setSettings] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await fetch('/api/automation/operational-suite/status');
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
      const res = await fetch('/api/automation/operational-suite/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automation, ...fields }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success('Settings saved');
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
        <p>Failed to load settings. Please run migration 051 in Supabase SQL Editor.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--space-xl)', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Operational & Advanced AI Automations</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          7 more automations — operational reliability (failover, inventory, carrier sync), advanced AI (churn prediction, recommendations, send-time optimization), and extended drip campaigns.
        </p>
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 'var(--space-md)', color: 'var(--text-secondary)' }}>🔔 Operational Automations</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}>
        {/* Channel Failover */}
        <AutomationCard
          config={OPERATIONAL_AUTOMATIONS[0]}
          enabled={settings.channel_failover_enabled}
          stats={stats?.failover}
          fields={[
            { key: 'sms_provider', label: 'SMS Provider', type: 'select', value: settings.sms_provider, options: [
              { value: 'none', label: 'None (disabled)' },
              { value: 'twilio', label: 'Twilio' },
              { value: 'messagebird', label: 'MessageBird' },
              { value: 'unifonic', label: 'Unifonic (Egypt)' },
            ]},
            { key: 'sms_sender_id', label: 'SMS Sender ID', type: 'text', value: settings.sms_sender_id, placeholder: 'SELLORA' },
          ]}
          saving={saving === 'failover'}
          onToggle={(enabled) => save('failover', { channel_failover_enabled: enabled })}
          onSave={(fields) => save('failover', fields)}
          note="💡 Requires SMS provider API key in Vercel env vars (e.g. TWILIO_AUTH_TOKEN). When a WhatsApp/IG/FB message fails, the system auto-retries via SMS, then email."
        />

        {/* Inventory Auto-Reorder */}
        <AutomationCard
          config={OPERATIONAL_AUTOMATIONS[1]}
          enabled={settings.inventory_reorder_enabled}
          stats={stats?.reorder}
          fields={[
            { key: 'inventory_reorder_threshold', label: 'Stock threshold (units)', type: 'number', value: settings.inventory_reorder_threshold, min: 0, max: 10000 },
            { key: 'inventory_reorder_qty', label: 'Suggested reorder quantity', type: 'number', value: settings.inventory_reorder_qty, min: 1, max: 10000 },
            { key: 'inventory_reorder_notify', label: 'Notify me on dashboard', type: 'checkbox', value: settings.inventory_reorder_notify },
          ]}
          saving={saving === 'inventory'}
          onToggle={(enabled) => save('inventory', { inventory_reorder_enabled: enabled })}
          onSave={(fields) => save('inventory', fields)}
        />

        {/* Carrier Sync */}
        <AutomationCard
          config={OPERATIONAL_AUTOMATIONS[2]}
          enabled={settings.carrier_sync_enabled}
          stats={stats?.carrier}
          fields={[]}
          saving={saving === 'carrier'}
          onToggle={(enabled) => save('carrier', { carrier_sync_enabled: enabled })}
          onSave={() => {}}
          note="Syncs every 2 hours. Supports Aramex, Bosta, Mylerz. Set carrier API keys in Vercel env vars (CARRIER_ARAMEX_API_KEY, CARRIER_BOSTA_API_KEY, CARRIER_MYLERZ_API_KEY). Auto-messages customers at each shipping milestone."
        />
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 'var(--space-md)', color: 'var(--text-secondary)' }}>🧠 Advanced AI Automations</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}>
        {/* Churn Prediction */}
        <AutomationCard
          config={AI_AUTOMATIONS[0]}
          enabled={settings.churn_prediction_enabled}
          stats={stats?.churn}
          fields={[
            { key: 'churn_threshold_days', label: 'Days inactive before flagging', type: 'number', value: settings.churn_threshold_days, min: 7, max: 365 },
            { key: 'churn_save_discount', label: 'Save campaign discount %', type: 'number', value: settings.churn_save_discount, min: 0, max: 100 },
          ]}
          saving={saving === 'churn'}
          onToggle={(enabled) => save('churn', { churn_prediction_enabled: enabled })}
          onSave={(fields) => save('churn', fields)}
          note="AI calculates a churn risk score (0-100) for each customer based on recency, frequency, and spend. Customers with 50+ score get an auto save-campaign message with a discount code."
        />

        {/* Product Recommendations */}
        <AutomationCard
          config={AI_AUTOMATIONS[1]}
          enabled={settings.product_recommendations_enabled}
          stats={stats?.recs}
          fields={[]}
          saving={saving === 'recommendations'}
          onToggle={(enabled) => save('recommendations', { product_recommendations_enabled: enabled })}
          onSave={() => {}}
          note="Analyzes all orders to find co-purchase patterns ('customers who bought A also bought B'). Also builds same-category recommendations. Powers the AI recommendation cards in conversations."
        />

        {/* Send-Time Optimization */}
        <AutomationCard
          config={AI_AUTOMATIONS[2]}
          enabled={settings.send_time_optimization_enabled}
          stats={stats?.sendTime}
          fields={[]}
          saving={saving === 'send_time'}
          onToggle={(enabled) => save('send_time', { send_time_optimization_enabled: enabled })}
          onSave={() => {}}
          note="Analyzes 30 days of customer response times to learn each customer's best hour. Broadcasts are then scheduled to send at each customer's optimal time. Requires 3+ response samples per customer."
        />
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 'var(--space-md)', color: 'var(--text-secondary)' }}>⚡ Extended Drip Campaigns</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        {/* Extended Drip */}
        <AutomationCard
          config={DRIP_AUTOMATIONS[0]}
          enabled={settings.extended_drip_enabled}
          stats={stats?.drips}
          fields={[]}
          saving={saving === 'drip'}
          onToggle={(enabled) => save('drip', { extended_drip_enabled: enabled })}
          onSave={() => {}}
          note="Extends the 3-step abandoned cart recovery to a full 7-step lifecycle: 1) Browse abandon (no cart) 2) Cart abandon 3) Checkout abandon 4) Post-purchase upsell 5) Review request 6) Referral ask 7) Win-back. Each step has its own timing + message template."
        />
      </div>
    </div>
  );
}

function AutomationCard({ config, enabled, stats, fields, saving, onToggle, onSave, note }) {
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
      borderRadius: 'var(--radius-xl)', padding: 'var(--space-xl)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-md)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: config.color + '20', color: config.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon size={22} />
          </div>
          <div>
            <h3 style={{ fontWeight: 600, marginBottom: 4 }}>{config.title}</h3>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', maxWidth: 500 }}>{config.desc}</p>
          </div>
        </div>
        <button onClick={() => onToggle(!enabled)} style={{
          width: 48, height: 26, borderRadius: 13,
          background: enabled ? config.color : 'var(--bg-tertiary)',
          position: 'relative', cursor: 'pointer', border: 'none', transition: 'background 0.2s',
        }}>
          <div style={{
            position: 'absolute', top: 3, left: enabled ? 25 : 3,
            width: 20, height: 20, borderRadius: '50%',
            background: 'white', transition: 'left 0.2s',
          }} />
        </button>
      </div>

      {stats && (stats.total > 0 || stats.sent > 0) && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 'var(--space-md)', fontSize: 12, color: 'var(--text-tertiary)' }}>
          <span>Total: <strong style={{ color: 'var(--text-primary)' }}>{stats.total}</strong></span>
          {stats.sent > 0 && <span>Active: <strong style={{ color: 'var(--text-primary)' }}>{stats.sent}</strong></span>}
        </div>
      )}

      {note && enabled && (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)', fontStyle: 'italic' }}>{note}</div>
      )}

      {enabled && fields.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
          {fields.map(f => (
            <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {f.type === 'checkbox' ? (
                <>
                  <input type="checkbox" checked={localFields[f.key] || false}
                    onChange={(e) => setLocalFields(prev => ({ ...prev, [f.key]: e.target.checked }))}
                    id={f.key} />
                  <label htmlFor={f.key} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{f.label}</label>
                </>
              ) : (
                <>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 180 }}>{f.label}</label>
                  {f.type === 'select' ? (
                    <select className="form-input" value={localFields[f.key] || ''}
                      onChange={(e) => setLocalFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                      style={{ flex: 1, maxWidth: 300, fontSize: 13 }}>
                      {f.options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  ) : f.type === 'number' ? (
                    <input type="number" className="form-input" value={localFields[f.key] ?? ''}
                      onChange={(e) => setLocalFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                      min={f.min} max={f.max} style={{ width: 150, fontSize: 13 }} />
                  ) : (
                    <input type="text" className="form-input" value={localFields[f.key] || ''}
                      onChange={(e) => setLocalFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder} style={{ flex: 1, maxWidth: 300, fontSize: 13 }} />
                  )}
                </>
              )}
            </div>
          ))}
          {hasChanges && (
            <button className="btn btn-primary btn-sm" onClick={() => onSave(localFields)} disabled={saving}
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6 }}>
              {saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
