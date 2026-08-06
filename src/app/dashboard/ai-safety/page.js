"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Gauge,
  Eye,
  EyeOff,
  DollarSign,
  Clock,
  AlertTriangle,
  Check,
  X,
  Loader2,
  Save,
  RotateCcw,
  ToggleLeft,
  ToggleRight,
  Bell,
  Bot,
  MessageCircle,
  RefreshCw,
  Zap,
  TrendingUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const DEFAULTS = {
  ai_confidence_threshold: 70,
  ai_preview_mode: false,
  ai_high_value_threshold: 1000,
  ai_sla_hours: 4,
};

const PRIORITY_CONFIG = {
  low: { label: "Low", color: "var(--text-tertiary)", bg: "rgba(120,120,140,0.12)" },
  normal: { label: "Normal", color: "var(--accent-secondary)", bg: "rgba(108,92,231,0.12)" },
  high: { label: "High", color: "var(--accent-orange)", bg: "rgba(248,165,50,0.12)" },
  urgent: { label: "Urgent", color: "var(--accent-red)", bg: "rgba(255,82,82,0.12)" },
};

export default function AISafetyPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Settings
  const [confidenceThreshold, setConfidenceThreshold] = useState(DEFAULTS.ai_confidence_threshold);
  const [previewMode, setPreviewMode] = useState(DEFAULTS.ai_preview_mode);
  const [highValueThreshold, setHighValueThreshold] = useState(DEFAULTS.ai_high_value_threshold);
  const [slaHours, setSlaHours] = useState(DEFAULTS.ai_sla_hours);

  // Live data
  const [pendingReplies, setPendingReplies] = useState([]);
  const [breachedConversations, setBreachedConversations] = useState([]);
  const [pendingActions, setPendingActions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Per-row action state
  const [rowAction, setRowAction] = useState({}); // { [messageId]: "approving" | "rejecting" }
  const [editingReply, setEditingReply] = useState({}); // { [messageId]: "edited text" }

  const getSupabase = () => createClient();

  // ─── Load settings ───
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch("/api/ai-safety/settings");
        const data = await res.json();
        if (data.settings) {
          setConfidenceThreshold(data.settings.ai_confidence_threshold ?? DEFAULTS.ai_confidence_threshold);
          setPreviewMode(!!data.settings.ai_preview_mode);
          setHighValueThreshold(data.settings.ai_high_value_threshold ?? DEFAULTS.ai_high_value_threshold);
          setSlaHours(data.settings.ai_sla_hours ?? DEFAULTS.ai_sla_hours);
        }
      } catch (err) {
        console.error("AI Safety settings load error:", err);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  // ─── Load live data (pending replies + breached conversations + pending actions) ───
  const loadLiveData = useCallback(async () => {
    setRefreshing(true);
    try {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRefreshing(false);
        return;
      }

      // 1. Pending AI replies (held for review)
      const repliesRes = await fetch("/api/ai-safety/review");
      const repliesData = await repliesRes.json();
      if (repliesData.pendingReplies) {
        setPendingReplies(repliesData.pendingReplies);
      }

      // 2. SLA-breached conversations (read directly from supabase)
      const { data: breached } = await supabase
        .from("conversations")
        .select(`
          id,
          channel,
          status,
          priority,
          sla_deadline,
          last_message_at,
          customer:customers ( id, name, phone, platform_id )
        `)
        .eq("account_id", user.id)
        .eq("status", "sla_breached")
        .order("sla_deadline", { ascending: true })
        .limit(20);
      setBreachedConversations(breached || []);

      // 3. Pending high-value order approvals (pending_actions)
      const { data: actions } = await supabase
        .from("pending_actions")
        .select("id, action_type, payload, status, proposed_at, conversation_id, customer:customers(name)")
        .eq("account_id", user.id)
        .eq("status", "pending")
        .order("proposed_at", { ascending: false })
        .limit(20);
      setPendingActions(actions || []);
    } catch (err) {
      console.error("Live data load error:", err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadLiveData();
    // Auto-refresh every 30s
    const interval = setInterval(loadLiveData, 30000);
    return () => clearInterval(interval);
  }, [loadLiveData]);

  // ─── Save settings ───
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/ai-safety/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ai_confidence_threshold: confidenceThreshold,
          ai_preview_mode: previewMode,
          ai_high_value_threshold: highValueThreshold,
          ai_sla_hours: slaHours,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        alert(data.error || "Failed to save settings");
      }
    } catch (err) {
      console.error("Save error:", err);
      alert("Failed to save settings");
    }
    setSaving(false);
  };

  const handleReset = () => {
    setConfidenceThreshold(DEFAULTS.ai_confidence_threshold);
    setPreviewMode(DEFAULTS.ai_preview_mode);
    setHighValueThreshold(DEFAULTS.ai_high_value_threshold);
    setSlaHours(DEFAULTS.ai_sla_hours);
  };

  // ─── Approve / Reject pending AI reply ───
  const handleApproveReply = async (messageId) => {
    const edited = editingReply[messageId];
    setRowAction((prev) => ({ ...prev, [messageId]: "approving" }));
    try {
      const res = await fetch("/api/ai-safety/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          action: "approve",
          editedContent: edited || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Remove from list
        setPendingReplies((prev) => prev.filter((r) => r.id !== messageId));
        setEditingReply((prev) => {
          const next = { ...prev };
          delete next[messageId];
          return next;
        });
      } else {
        alert(data.error || "Failed to approve reply");
      }
    } catch (err) {
      alert("Failed to approve reply: " + err.message);
    } finally {
      setRowAction((prev) => ({ ...prev, [messageId]: undefined }));
    }
  };

  const handleRejectReply = async (messageId) => {
    if (!confirm("Reject this AI reply? The customer will not receive it.")) return;
    setRowAction((prev) => ({ ...prev, [messageId]: "rejecting" }));
    try {
      const res = await fetch("/api/ai-safety/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, action: "reject" }),
      });
      const data = await res.json();
      if (data.success) {
        setPendingReplies((prev) => prev.filter((r) => r.id !== messageId));
        setEditingReply((prev) => {
          const next = { ...prev };
          delete next[messageId];
          return next;
        });
      } else {
        alert(data.error || "Failed to reject reply");
      }
    } catch (err) {
      alert("Failed to reject reply: " + err.message);
    } finally {
      setRowAction((prev) => ({ ...prev, [messageId]: undefined }));
    }
  };

  // ─── Approve / Reject pending high-value order ───
  const handleApproveOrder = async (actionId) => {
    setRowAction((prev) => ({ ...prev, [`action-${actionId}`]: "approving" }));
    try {
      const res = await fetch(`/api/pending-actions/${actionId}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success || res.ok) {
        setPendingActions((prev) => prev.filter((a) => a.id !== actionId));
      } else {
        alert(data.error || "Failed to approve order");
      }
    } catch (err) {
      alert("Failed to approve order: " + err.message);
    } finally {
      setRowAction((prev) => ({ ...prev, [`action-${actionId}`]: undefined }));
    }
  };

  const handleRejectOrder = async (actionId) => {
    if (!confirm("Reject this order? The customer will not be charged.")) return;
    setRowAction((prev) => ({ ...prev, [`action-${actionId}`]: "rejecting" }));
    try {
      const res = await fetch(`/api/pending-actions/${actionId}/reject`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success || res.ok) {
        setPendingActions((prev) => prev.filter((a) => a.id !== actionId));
      } else {
        alert(data.error || "Failed to reject order");
      }
    } catch (err) {
      alert("Failed to reject order: " + err.message);
    } finally {
      setRowAction((prev) => ({ ...prev, [`action-${actionId}`]: undefined }));
    }
  };

  // ─── Helpers ───
  const formatRelative = (iso) => {
    if (!iso) return "—";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const formatSlaRemaining = (iso) => {
    if (!iso) return "—";
    const diff = new Date(iso).getTime() - Date.now();
    if (diff < 0) {
      const overdueMins = Math.floor(-diff / 60000);
      if (overdueMins < 60) return `${overdueMins}m overdue`;
      const hrs = Math.floor(overdueMins / 60);
      return `${hrs}h ${overdueMins % 60}m overdue`;
    }
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m left`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m left`;
  };

  const customerName = (conv) => {
    if (!conv) return "Unknown";
    if (Array.isArray(conv.customer)) return conv.customer[0]?.name || "Unknown";
    return conv.customer?.name || "Unknown";
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <Loader2 size={32} className="spin" style={{ color: "var(--accent-primary)" }} />
      </div>
    );
  }

  return (
    <>
      {/* ─── Page Header ─── */}
      <div className="page-header">
        <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Shield size={28} style={{ color: "var(--accent-primary-light)" }} />
          AI Safety Center
        </h1>
        <div className="page-header-actions">
          <button
            className="btn btn-secondary"
            onClick={loadLiveData}
            disabled={refreshing}
            title="Refresh live data"
          >
            {refreshing ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
            Refresh
          </button>
          <button className="btn btn-secondary" onClick={handleReset}>
            <RotateCcw size={16} /> Reset to Defaults
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saved ? <><Check size={16} /> Saved!</> : saving ? <><Loader2 size={16} className="spin" /> Saving...</> : <><Save size={16} /> Save Settings</>}
          </button>
        </div>
      </div>

      {/* ─── Live Stats Strip ─── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "var(--space-md)",
        marginBottom: "var(--space-xl)",
      }}>
        <StatCard
          icon={<Eye size={18} />}
          label="Pending AI Replies"
          value={pendingReplies.length}
          color="var(--accent-orange)"
          hint={previewMode ? "Preview mode is ON" : "Low-confidence replies"}
        />
        <StatCard
          icon={<AlertTriangle size={18} />}
          label="SLA Breached"
          value={breachedConversations.length}
          color="var(--accent-red)"
          hint="Conversations past deadline"
        />
        <StatCard
          icon={<DollarSign size={18} />}
          label="High-Value Orders"
          value={pendingActions.filter((a) => a.action_type === "create_order").length}
          color="var(--accent-primary-light)"
          hint={`Awaiting approval (>${highValueThreshold})`}
        />
        <StatCard
          icon={<ShieldCheck size={18} />}
          label="Hallucination Shield"
          value="100% Active"
          color="#38bdf8"
          hint="Price & Policy Auto-Sanitizer ON"
        />
        <StatCard
          icon={<Gauge size={18} />}
          label="Confidence Threshold"
          value={confidenceThreshold}
          color="var(--accent-green)"
          hint={previewMode ? "Preview ON — all held" : "Below this → held"}
        />
      </div>

      {/* ─── Settings Cards Grid ─── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
        gap: "var(--space-lg)",
        marginBottom: "var(--space-xl)",
      }}>
        {/* ─── Card 1: Confidence Threshold ─── */}
        <SafetyCard
          icon={<Gauge size={20} />}
          title="Confidence Threshold"
          subtitle="Hold low-confidence AI replies for review"
          accent="var(--accent-green)"
          enabled={true}
          onToggle={null}
          footer={
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
              style={{ marginTop: "var(--space-md)" }}
            >
              {saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
              Save Threshold
            </button>
          }
        >
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "0 0 var(--space-md) 0", lineHeight: 1.5 }}>
            When the AI provider's <code>finish_reason</code> suggests the reply may be
            truncated or filtered (e.g. <code>length</code>, <code>content_filter</code>),
            the reply is held for human review instead of being sent to the customer.
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-sm)" }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Threshold</span>
            <span style={{
              fontSize: 20, fontWeight: 700, color: "var(--accent-green)",
              padding: "2px 12px", borderRadius: 8,
              background: "rgba(59,165,92,0.12)",
            }}>
              {confidenceThreshold}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={confidenceThreshold}
            onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--accent-green)" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>
            <span>0 (hold all)</span>
            <span>70 (default)</span>
            <span>100 (never hold)</span>
          </div>
          <div style={{
            marginTop: "var(--space-md)", padding: "var(--space-sm) var(--space-md)",
            background: "var(--bg-glass)", borderRadius: 8, fontSize: 11,
            color: "var(--text-tertiary)", lineHeight: 1.5,
          }}>
            <strong>How it works:</strong> stop → 95 · tool-calls → 90 · length → 55 · content_filter → 30. Replies scoring below {confidenceThreshold} are flagged <code>needs_human_review</code>.
          </div>
        </SafetyCard>

        {/* ─── Card 2: Preview Mode ─── */}
        <SafetyCard
          icon={previewMode ? <Eye size={20} /> : <EyeOff size={20} />}
          title="Preview Mode"
          subtitle="Approve every AI reply before it's sent"
          accent="var(--accent-orange)"
          enabled={previewMode}
          onToggle={() => {
            const next = !previewMode;
            setPreviewMode(next);
            // Auto-save the toggle immediately so it takes effect
            fetch("/api/ai-safety/settings", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ai_preview_mode: next }),
            }).then(() => {
              setSaved(true);
              setTimeout(() => setSaved(false), 1500);
            }).catch((err) => {
              console.error("Toggle preview mode failed:", err);
              setPreviewMode(!next); // revert
              alert("Failed to toggle preview mode");
            });
          }}
        >
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "0 0 var(--space-md) 0", lineHeight: 1.5 }}>
            When enabled, <strong>ALL</strong> AI replies are saved to the database with{" "}
            <code>approval_status: "pending"</code> instead of being sent to the customer.
            Review them in the "Pending AI Replies" section below.
          </p>
          <div style={{
            padding: "var(--space-md)",
            background: previewMode ? "rgba(248,165,50,0.10)" : "var(--bg-glass)",
            border: `1px solid ${previewMode ? "rgba(248,165,50,0.3)" : "var(--border-subtle)"}`,
            borderRadius: 10,
            display: "flex", alignItems: "center", gap: "var(--space-sm)",
          }}>
            {previewMode ? (
              <>
                <Eye size={18} style={{ color: "var(--accent-orange)" }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-orange)" }}>Preview mode is ON</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Replies are held — approve to send</div>
                </div>
              </>
            ) : (
              <>
                <EyeOff size={18} style={{ color: "var(--text-tertiary)" }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Preview mode is OFF</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>AI replies are sent automatically</div>
                </div>
              </>
            )}
          </div>
        </SafetyCard>

        {/* ─── Card 3: High-Value Order Approval ─── */}
        <SafetyCard
          icon={<DollarSign size={20} />}
          title="High-Value Order Approval"
          subtitle="Require approval on large AI-created orders"
          accent="var(--accent-primary-light)"
          enabled={true}
          onToggle={null}
          footer={
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
              style={{ marginTop: "var(--space-md)" }}
            >
              {saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
              Save Threshold
            </button>
          }
        >
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "0 0 var(--space-md) 0", lineHeight: 1.5 }}>
            When the AI calls <code>create_order</code> and the order total exceeds this
            threshold, the order is saved as a <strong>pending action</strong> for owner
            approval instead of being auto-created. Prevents costly AI misunderstandings.
          </p>
          <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
            Threshold amount
          </label>
          <div style={{ position: "relative" }}>
            <span style={{
              position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
              color: "var(--text-tertiary)", fontSize: 14,
            }}>
              $
            </span>
            <input
              type="number"
              min={0}
              step={50}
              value={highValueThreshold}
              onChange={(e) => setHighValueThreshold(Number(e.target.value))}
              style={{
                width: "100%", padding: "10px 12px 10px 28px",
                background: "var(--bg-glass)", border: "1px solid var(--border-subtle)",
                borderRadius: 8, fontSize: 16, fontWeight: 600,
                color: "var(--text-primary)", outline: "none",
                fontFamily: "var(--font-family)",
              }}
            />
          </div>
          <div style={{
            marginTop: "var(--space-md)", padding: "var(--space-sm) var(--space-md)",
            background: "var(--bg-glass)", borderRadius: 8, fontSize: 11,
            color: "var(--text-tertiary)", lineHeight: 1.5,
          }}>
            Orders &gt; <strong>{Number(highValueThreshold).toLocaleString()}</strong> are saved to the{" "}
            <code>pending_actions</code> table. Approve them in the "High-Value Orders" section below.
          </div>
        </SafetyCard>

        {/* ─── Card 4: SLA Window (Human Handoff) ─── */}
        <SafetyCard
          icon={<Clock size={20} />}
          title="SLA Window (Human Handoff)"
          subtitle="Time-to-respond deadline for escalated chats"
          accent="var(--accent-red)"
          enabled={true}
          onToggle={null}
          footer={
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
              style={{ marginTop: "var(--space-md)" }}
            >
              {saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
              Save SLA
            </button>
          }
        >
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "0 0 var(--space-md) 0", lineHeight: 1.5 }}>
            When a conversation is escalated to a human, the SLA deadline is set to{" "}
            <strong>now + {slaHours} hours</strong>. A cron marks conversations as{" "}
            <code>sla_breached</code> when the deadline passes.
          </p>
          <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
            SLA window (hours)
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
            <button
              onClick={() => setSlaHours(Math.max(1, slaHours - 1))}
              style={{
                width: 36, height: 36, borderRadius: 8,
                background: "var(--bg-glass)", border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >–</button>
            <input
              type="number"
              min={1}
              max={72}
              value={slaHours}
              onChange={(e) => setSlaHours(Math.max(1, Math.min(72, Number(e.target.value) || 1)))}
              style={{
                flex: 1, textAlign: "center",
                padding: "10px 12px",
                background: "var(--bg-glass)", border: "1px solid var(--border-subtle)",
                borderRadius: 8, fontSize: 18, fontWeight: 700,
                color: "var(--accent-red)", outline: "none",
                fontFamily: "var(--font-family)",
              }}
            />
            <button
              onClick={() => setSlaHours(Math.min(72, slaHours + 1))}
              style={{
                width: 36, height: 36, borderRadius: 8,
                background: "var(--bg-glass)", border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >+</button>
          </div>
          <div style={{
            marginTop: "var(--space-md)", padding: "var(--space-sm) var(--space-md)",
            background: "rgba(255,82,82,0.08)", borderRadius: 8, fontSize: 11,
            color: "var(--text-tertiary)", lineHeight: 1.5,
            border: "1px solid rgba(255,82,82,0.15)",
          }}>
            <Bell size={11} style={{ color: "var(--accent-red)", marginRight: 4 }} />
            Cron: <code>POST /api/ai-safety/sla-check</code> with header{" "}
            <code>x-cron-secret</code> every ~5 min.
          </div>
        </SafetyCard>
      </div>

      {/* ─── Pending AI Replies (Preview Mode queue) ─── */}
      <div className="dashboard-panel" style={{ marginBottom: "var(--space-xl)" }}>
        <div className="dashboard-panel-header">
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Eye size={18} style={{ color: "var(--accent-orange)" }} />
            Pending AI Replies
            {pendingReplies.length > 0 && (
              <span style={{
                marginLeft: 4, padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                background: "rgba(248,165,50,0.18)", color: "var(--accent-orange)",
              }}>
                {pendingReplies.length}
              </span>
            )}
          </h3>
        </div>
        <div className="dashboard-panel-body" style={{ padding: "var(--space-lg)" }}>
          {pendingReplies.length === 0 ? (
            <EmptyState
              icon={<Check size={32} />}
              title="No pending replies"
              subtitle={previewMode
                ? "Preview mode is ON — new AI replies will appear here for approval."
                : "AI replies are sent automatically. Enable Preview Mode to hold them for review."}
              color="var(--accent-green)"
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)", maxHeight: 480, overflowY: "auto" }}>
              {pendingReplies.map((reply) => {
                const conv = Array.isArray(reply.conversation) ? reply.conversation[0] : reply.conversation;
                const cust = Array.isArray(conv?.customer) ? conv.customer[0] : conv?.customer;
                const edited = editingReply[reply.id];
                const isEditing = edited !== undefined;
                return (
                  <div
                    key={reply.id}
                    style={{
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 12,
                      padding: "var(--space-md)",
                      background: "var(--bg-glass)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                          {cust?.name || "Unknown customer"}
                          <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 400, marginLeft: 6 }}>
                            · {conv?.channel || "—"} · {formatRelative(reply.created_at)}
                          </span>
                        </div>
                        {reply.sentiment && (
                          <span style={{
                            fontSize: 10, padding: "1px 6px", borderRadius: 6,
                            background: reply.sentiment === "negative" ? "rgba(255,82,82,0.12)" : "var(--bg-glass)",
                            color: reply.sentiment === "negative" ? "var(--accent-red)" : "var(--text-tertiary)",
                            marginTop: 2, display: "inline-block",
                          }}>
                            {reply.sentiment}
                          </span>
                        )}
                      </div>
                      <Bot size={16} style={{ color: "var(--accent-secondary)", flexShrink: 0 }} />
                    </div>

                    {isEditing ? (
                      <textarea
                        value={edited}
                        onChange={(e) => setEditingReply((prev) => ({ ...prev, [reply.id]: e.target.value }))}
                        rows={4}
                        style={{
                          width: "100%", padding: "var(--space-sm)",
                          background: "var(--bg-primary)", border: "1px solid var(--accent-primary)",
                          borderRadius: 8, fontSize: 13, color: "var(--text-primary)",
                          fontFamily: "var(--font-family)", resize: "vertical",
                          outline: "none",
                        }}
                      />
                    ) : (
                      <div style={{
                        padding: "var(--space-sm) var(--space-md)",
                        background: "var(--bg-primary)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: 8,
                        fontSize: 13, color: "var(--text-secondary)",
                        lineHeight: 1.5, marginBottom: "var(--space-sm)",
                        whiteSpace: "pre-wrap",
                      }}>
                        {reply.content}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                      <button
                        onClick={() => handleApproveReply(reply.id)}
                        disabled={rowAction[reply.id]}
                        className="btn btn-primary"
                        style={{ fontSize: 12, padding: "6px 14px" }}
                      >
                        {rowAction[reply.id] === "approving" ? <Loader2 size={13} className="spin" /> : <Check size={13} />}
                        Approve &amp; Send
                      </button>
                      <button
                        onClick={() => handleRejectReply(reply.id)}
                        disabled={rowAction[reply.id]}
                        className="btn btn-secondary"
                        style={{ fontSize: 12, padding: "6px 14px", color: "var(--accent-red)" }}
                      >
                        {rowAction[reply.id] === "rejecting" ? <Loader2 size={13} className="spin" /> : <X size={13} />}
                        Reject
                      </button>
                      <button
                        onClick={() => {
                          if (isEditing) {
                            setEditingReply((prev) => {
                              const next = { ...prev };
                              delete next[reply.id];
                              return next;
                            });
                          } else {
                            setEditingReply((prev) => ({ ...prev, [reply.id]: reply.content }));
                          }
                        }}
                        disabled={rowAction[reply.id]}
                        className="btn btn-secondary"
                        style={{ fontSize: 12, padding: "6px 14px" }}
                      >
                        {isEditing ? "Cancel Edit" : "Edit"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── High-Value Pending Orders ─── */}
      <div className="dashboard-panel" style={{ marginBottom: "var(--space-xl)" }}>
        <div className="dashboard-panel-header">
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <TrendingUp size={18} style={{ color: "var(--accent-primary-light)" }} />
            High-Value Orders Awaiting Approval
            {pendingActions.filter((a) => a.action_type === "create_order").length > 0 && (
              <span style={{
                marginLeft: 4, padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                background: "rgba(108,92,231,0.18)", color: "var(--accent-primary-light)",
              }}>
                {pendingActions.filter((a) => a.action_type === "create_order").length}
              </span>
            )}
          </h3>
        </div>
        <div className="dashboard-panel-body" style={{ padding: "var(--space-lg)" }}>
          {pendingActions.filter((a) => a.action_type === "create_order").length === 0 ? (
            <EmptyState
              icon={<ShieldCheck size={32} />}
              title="No high-value orders pending"
              subtitle={`AI orders above ${Number(highValueThreshold).toLocaleString()} will appear here for approval.`}
              color="var(--accent-green)"
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)", maxHeight: 480, overflowY: "auto" }}>
              {pendingActions.filter((a) => a.action_type === "create_order").map((action) => {
                const payload = action.payload || {};
                const cust = Array.isArray(action.customer) ? action.customer[0] : action.customer;
                return (
                  <div
                    key={action.id}
                    style={{
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 12,
                      padding: "var(--space-md)",
                      background: "var(--bg-glass)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-sm)" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                          {cust?.name || payload.customer_name || "Unknown customer"}
                          <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 400, marginLeft: 6 }}>
                            · {formatRelative(action.proposed_at)}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                          {(payload.items || []).length} item(s) · {payload.payment_method || "cod"}
                        </div>
                      </div>
                      <div style={{
                        fontSize: 18, fontWeight: 700, color: "var(--accent-primary-light)",
                        padding: "2px 12px", borderRadius: 8,
                        background: "rgba(108,92,231,0.10)",
                      }}>
                        {Number(payload.total || 0).toLocaleString()} {payload.currency || "EGP"}
                      </div>
                    </div>

                    {payload.items && payload.items.length > 0 && (
                      <div style={{ marginBottom: "var(--space-sm)", fontSize: 12, color: "var(--text-secondary)" }}>
                        {payload.items.map((item, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                            <span>{item.name} × {item.qty}</span>
                            <span style={{ color: "var(--text-tertiary)" }}>
                              {Number(item.price * item.qty).toLocaleString()} {payload.currency || "EGP"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                      <button
                        onClick={() => handleApproveOrder(action.id)}
                        disabled={rowAction[`action-${action.id}`]}
                        className="btn btn-primary"
                        style={{ fontSize: 12, padding: "6px 14px" }}
                      >
                        {rowAction[`action-${action.id}`] === "approving" ? <Loader2 size={13} className="spin" /> : <Check size={13} />}
                        Approve Order
                      </button>
                      <button
                        onClick={() => handleRejectOrder(action.id)}
                        disabled={rowAction[`action-${action.id}`]}
                        className="btn btn-secondary"
                        style={{ fontSize: 12, padding: "6px 14px", color: "var(--accent-red)" }}
                      >
                        {rowAction[`action-${action.id}`] === "rejecting" ? <Loader2 size={13} className="spin" /> : <X size={13} />}
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── SLA-Breached Conversations ─── */}
      <div className="dashboard-panel" style={{ marginBottom: "var(--space-xl)" }}>
        <div className="dashboard-panel-header">
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={18} style={{ color: "var(--accent-red)" }} />
            SLA-Breached Conversations
            {breachedConversations.length > 0 && (
              <span style={{
                marginLeft: 4, padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                background: "rgba(255,82,82,0.18)", color: "var(--accent-red)",
                animation: "pulse 2s ease-in-out infinite",
              }}>
                {breachedConversations.length}
              </span>
            )}
          </h3>
        </div>
        <div className="dashboard-panel-body" style={{ padding: "var(--space-lg)" }}>
          {breachedConversations.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck size={32} />}
              title="No SLA breaches"
              subtitle="All escalated conversations are within their SLA window."
              color="var(--accent-green)"
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", maxHeight: 480, overflowY: "auto" }}>
              {breachedConversations.map((conv) => {
                const cust = Array.isArray(conv.customer) ? conv.customer[0] : conv.customer;
                const prio = PRIORITY_CONFIG[conv.priority] || PRIORITY_CONFIG.normal;
                return (
                  <a
                    key={conv.id}
                    href={`/dashboard/conversations`}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "var(--space-md)",
                      background: "rgba(255,82,82,0.06)",
                      border: "1px solid rgba(255,82,82,0.2)",
                      borderRadius: 10,
                      textDecoration: "none", cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                        {cust?.name || "Unknown"}
                        <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 400, marginLeft: 6 }}>
                          · {conv.channel}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--accent-red)", marginTop: 2 }}>
                        <Clock size={10} style={{ marginRight: 3 }} />
                        {formatSlaRemaining(conv.sla_deadline)}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 12,
                      background: prio.bg, color: prio.color, textTransform: "uppercase",
                    }}>
                      {prio.label}
                    </span>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Helper components ───

function StatCard({ icon, label, value, color, hint }) {
  return (
    <div className="dashboard-panel" style={{ padding: "var(--space-md) var(--space-lg)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-xs)" }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}1a`, color,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {icon}
        </div>
        <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function SafetyCard({ icon, title, subtitle, accent, enabled, onToggle, footer, children }) {
  return (
    <div className="dashboard-panel" style={{ display: "flex", flexDirection: "column" }}>
      <div className="dashboard-panel-header" style={{ padding: "var(--space-md) var(--space-lg)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", flex: 1 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `${accent}1a`, color: accent,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            {icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              {title}
            </h3>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>
              {subtitle}
            </div>
          </div>
          {onToggle && (
            <div
              onClick={onToggle}
              style={{
                color: enabled ? accent : "var(--text-tertiary)",
                cursor: "pointer",
                display: "flex", alignItems: "center",
              }}
              title={enabled ? "Disable" : "Enable"}
            >
              {enabled ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
            </div>
          )}
        </div>
      </div>
      <div className="dashboard-panel-body" style={{ padding: "var(--space-lg)", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1 }}>{children}</div>
        {footer}
      </div>
    </div>
  );
}

function EmptyState({ icon, title, subtitle, color = "var(--text-tertiary)" }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "var(--space-xl)", textAlign: "center",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: `${color}1a`, color,
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: "var(--space-md)",
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-tertiary)", maxWidth: 360, lineHeight: 1.5 }}>
        {subtitle}
      </div>
    </div>
  );
}
