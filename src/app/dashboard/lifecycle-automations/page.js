"use client";

import { useState, useEffect } from "react";
import { Loader2, Cake, Sparkles, RefreshCw, Star, Route, FileQuestion, AlertCircle, Save } from "lucide-react";
import { useToast } from "../components/ToastProvider";

const LIFECYCLE_AUTOMATIONS = [
  { id: 'birthday', icon: Cake, color: '#fd79a8', title: 'Birthday Rewards', desc: 'Auto-send a birthday discount code to customers on their birthday.' },
  { id: 'welcome', icon: Sparkles, color: '#00b894', title: 'First-Order Welcome Series', desc: '3-message series for new customers with a 10% discount on their next order.' },
  { id: 'reorder', icon: RefreshCw, color: '#6c5ce7', title: 'Reorder Reminders', desc: 'Remind customers to reorder consumable products 25 days after purchase.' },
  { id: 'review', icon: Star, color: '#fdcb6e', title: 'Review Timing Optimization', desc: 'AI predicts the best time to ask for a review based on engagement.' },
  { id: 'segments', icon: Star, color: '#0984e3', title: 'Smart Segmentation Auto-Update', desc: 'Auto-recompute dynamic segments daily so they stay current.' },
];

const AI_AUTOMATIONS = [
  { id: 'routing', icon: Route, color: '#e17055', title: 'Smart Conversation Routing', desc: 'Auto-assign conversations to team members based on keywords (e.g. complaints → agent X).' },
  { id: 'faq', icon: FileQuestion, color: '#00cec9', title: 'Auto-Generate FAQs', desc: 'Weekly AI scan of conversations — drafts FAQ entries from most-asked questions for your approval.' },
  { id: 'negative_review', icon: AlertCircle, color: '#d63031', title: 'Negative Review Auto-Response', desc: 'When a customer leaves 1-2 stars, AI drafts a personalized apology response for your approval.' },
];

export default function LifecycleAutomationsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [settings, setSettings] = useState(null);
  const [stats, setStats] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [routingRules, setRoutingRules] = useState([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await fetch('/api/automation/lifecycle-suite/status');
      const data = await res.json();
      if (data.settings) {
        setSettings(data.settings);
        setStats(data.stats);
        setRoutingRules(Array.isArray(data.settings.routing_rules) ? data.settings.routing_rules : []);
      }
    } catch (e) {
      toast.error('Failed to load automation settings');
    } finally {
      setLoading(false);
    }
  };

  // Load team members for routing rules
  useEffect(() => {
    if (settings?.smart_routing_enabled) {
      (async () => {
        try {
          const { createClient } = await import("@/lib/supabase/client");
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          const { data } = await supabase.from("team_members").select("user_id, invited_email, role, invite_status").eq("account_id", user.id);
          setTeamMembers(data || []);
        } catch (e) {}
      })();
    }
  }, [settings?.smart_routing_enabled]);

  const save = async (automation, fields) => {
    setSaving(automation);
    try {
      const res = await fetch('/api/automation/lifecycle-suite/settings', {
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
        <p>Failed to load settings. Please run migration 050 in Supabase SQL Editor.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--space-xl)', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Lifecycle & AI Automations</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          8 more automations that run automatically — lifecycle campaigns (birthday, welcome, reorder, reviews, segments) and AI-driven features (smart routing, FAQ generation, review responses).
        </p>
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 'var(--space-md)', color: 'var(--text-secondary)' }}>📅 Lifecycle Automations</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}>
        {/* Birthday */}
        <AutomationCard
          config={LIFECYCLE_AUTOMATIONS[0]}
          enabled={settings.birthday_enabled}
          stats={stats?.birthday}
          fields={[
            { key: 'birthday_discount_percent', label: 'Discount %', type: 'number', value: settings.birthday_discount_percent, min: 0, max: 100 },
            { key: 'birthday_message_template', label: 'Message template', type: 'textarea', value: settings.birthday_message_template, placeholder: 'Use {name}, {store}, {discount}, {code}' },
          ]}
          saving={saving === 'birthday'}
          onToggle={(enabled) => save('birthday', { birthday_enabled: enabled })}
          onSave={(fields) => save('birthday', fields)}
          note="💡 Tip: Add customer birthdays via the Customers page (Enrich Profile → birthday field)"
        />

        {/* Welcome Series */}
        <AutomationCard
          config={LIFECYCLE_AUTOMATIONS[1]}
          enabled={settings.welcome_series_enabled}
          stats={stats?.welcome}
          fields={[
            { key: 'welcome_discount_percent', label: 'Discount %', type: 'number', value: settings.welcome_discount_percent, min: 0, max: 100 },
          ]}
          saving={saving === 'welcome'}
          onToggle={(enabled) => save('welcome', { welcome_series_enabled: enabled })}
          onSave={(fields) => save('welcome', fields)}
          note="Sends 1 day after first order: welcome + discount code. (Steps 2 & 3 coming soon.)"
        />

        {/* Reorder */}
        <AutomationCard
          config={LIFECYCLE_AUTOMATIONS[2]}
          enabled={settings.reorder_reminders_enabled}
          stats={stats?.reorder}
          fields={[
            { key: 'reorder_reminder_days', label: 'Days after delivery', type: 'number', value: settings.reorder_reminder_days, min: 1, max: 365 },
            { key: 'reorder_message_template', label: 'Message template', type: 'textarea', value: settings.reorder_message_template, placeholder: 'Use {name}, {product}, {store_url}' },
          ]}
          saving={saving === 'reorder'}
          onToggle={(enabled) => save('reorder', { reorder_reminders_enabled: enabled })}
          onSave={(fields) => save('reorder', fields)}
        />

        {/* Review Optimization */}
        <AutomationCard
          config={LIFECYCLE_AUTOMATIONS[3]}
          enabled={settings.review_optimization_enabled}
          stats={stats?.review}
          fields={[]}
          saving={saving === 'review'}
          onToggle={(enabled) => save('review', { review_optimization_enabled: enabled })}
          onSave={() => {}}
          note="Smart timing replaces the fixed '3 days after delivery' rule with AI-predicted optimal send time."
        />

        {/* Segments */}
        <AutomationCard
          config={LIFECYCLE_AUTOMATIONS[4]}
          enabled={settings.segment_auto_update_enabled}
          stats={stats?.routing}
          fields={[]}
          saving={saving === 'segments'}
          onToggle={(enabled) => save('segments', { segment_auto_update_enabled: enabled })}
          onSave={() => {}}
          note="Daily recompute of all dynamic segments. Keeps VIP/active/dormant segments current."
        />
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 'var(--space-md)', color: 'var(--text-secondary)' }}>🤖 AI-Driven Automations</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        {/* Smart Routing */}
        <AutomationCard
          config={AI_AUTOMATIONS[0]}
          enabled={settings.smart_routing_enabled}
          stats={stats?.routing}
          fields={[]}
          saving={saving === 'routing'}
          onToggle={(enabled) => save('routing', { smart_routing_enabled: enabled })}
          onSave={() => {}}
        >
          {settings.smart_routing_enabled && (
            <RoutingRulesEditor
              rules={routingRules}
              setRules={setRoutingRules}
              teamMembers={teamMembers}
              onSave={() => save('routing', { routing_rules: routingRules })}
              saving={saving === 'routing'}
            />
          )}
        </AutomationCard>

        {/* FAQ Auto-Generate */}
        <AutomationCard
          config={AI_AUTOMATIONS[1]}
          enabled={settings.faq_auto_generate_enabled}
          stats={stats?.faq}
          fields={[]}
          saving={saving === 'faq'}
          onToggle={(enabled) => save('faq', { faq_auto_generate_enabled: enabled })}
          onSave={() => {}}
          note="Runs every Sunday. AI analyzes the week's conversations and drafts 3 FAQ entries for your review. Approve them in the FAQs settings page."
        />

        {/* Negative Review Response */}
        <AutomationCard
          config={AI_AUTOMATIONS[2]}
          enabled={settings.negative_review_response_enabled}
          stats={stats?.negReview}
          fields={[
            { key: 'negative_review_message_template', label: 'Fallback message (used if AI fails)', type: 'textarea', value: settings.negative_review_message_template, placeholder: 'Use {name}' },
          ]}
          saving={saving === 'negative_review'}
          onToggle={(enabled) => save('negative_review', { negative_review_response_enabled: enabled })}
          onSave={(fields) => save('negative_review', fields)}
          note="AI drafts personalized apology responses for 1-2 star reviews. Review and send from the Reviews page."
        />
      </div>
    </div>
  );
}

function AutomationCard({ config, enabled, stats, fields, saving, onToggle, onSave, note, children }) {
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
          <span>Sent: <strong style={{ color: 'var(--text-primary)' }}>{stats.sent}</strong></span>
          <span>Total: <strong style={{ color: 'var(--text-primary)' }}>{stats.total}</strong></span>
        </div>
      )}

      {note && enabled && (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)', fontStyle: 'italic' }}>{note}</div>
      )}

      {enabled && fields.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
          {fields.map(f => (
            <div key={f.key}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea className="form-input" value={localFields[f.key] || ''}
                  onChange={(e) => setLocalFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder} rows={3}
                  style={{ width: '100%', fontSize: 13, resize: 'vertical' }} />
              ) : (
                <input type="number" className="form-input" value={localFields[f.key] ?? ''}
                  onChange={(e) => setLocalFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                  min={f.min} max={f.max} style={{ width: 200, fontSize: 13 }} />
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

      {children}
    </div>
  );
}

function RoutingRulesEditor({ rules, setRules, teamMembers, onSave, saving }) {
  const addRule = () => {
    setRules([...rules, { name: `Rule ${rules.length + 1}`, keywords: [], assignee_id: null }]);
  };
  const removeRule = (idx) => setRules(rules.filter((_, i) => i !== idx));
  const updateRule = (idx, field, value) => {
    const updated = [...rules];
    updated[idx] = { ...updated[idx], [field]: value };
    setRules(updated);
  };

  return (
    <div style={{ marginTop: 'var(--space-md)' }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>Routing Rules (keyword → team member)</label>
      {rules.map((rule, idx) => (
        <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="form-input" placeholder="Rule name" value={rule.name || ''}
            onChange={(e) => updateRule(idx, 'name', e.target.value)}
            style={{ width: 120, fontSize: 12 }} />
          <input className="form-input" placeholder="keywords (comma-separated)" value={Array.isArray(rule.keywords) ? rule.keywords.join(', ') : ''}
            onChange={(e) => updateRule(idx, 'keywords', e.target.value.split(',').map(k => k.trim()).filter(Boolean))}
            style={{ flex: 1, minWidth: 200, fontSize: 12 }} />
          <select className="form-input" value={rule.assignee_id || ''}
            onChange={(e) => updateRule(idx, 'assignee_id', e.target.value)}
            style={{ width: 150, fontSize: 12 }}>
            <option value="">Select agent...</option>
            {teamMembers.map(tm => (
              <option key={tm.user_id} value={tm.user_id}>{tm.invited_email || tm.user_id.slice(0, 8)}</option>
            ))}
          </select>
          <button onClick={() => removeRule(idx)} style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="btn btn-secondary btn-sm" onClick={addRule}>+ Add Rule</button>
        <button className="btn btn-primary btn-sm" onClick={onSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Save Rules
        </button>
      </div>
      {teamMembers.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8, fontStyle: 'italic' }}>
          No team members found. Invite team members in Settings → Team first.
        </p>
      )}
    </div>
  );
}
