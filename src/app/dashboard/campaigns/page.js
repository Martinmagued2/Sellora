"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Send,
  Clock,
  Users,
  Eye,
  BarChart3,
  Pause,
  Trash2,
  MessageCircle,
  X,
  Loader2,
  Calendar,
  Filter,
  Check,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getPlanLimits } from "@/lib/plan-limits";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [accountPlan, setAccountPlan] = useState("starter");

  // Create campaign modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    message: "",
    audience: "all",
    channel: "all",
    tag: "all",
    minSpent: "",
    scheduledAt: "",
  });

  // Send campaign state
  const [sendingCampaignId, setSendingCampaignId] = useState(null);
  const [sendResult, setSendResult] = useState(null);

  // Audience estimate
  const [audienceCount, setAudienceCount] = useState(null);
  const [estimating, setEstimating] = useState(false);

  const supabase = createClient();
  const router = useRouter();
  const planLimits = getPlanLimits(accountPlan);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: account } = await supabase.from("accounts").select("plan").eq("id", user.id).single();
      if (account?.plan) setAccountPlan(account.plan);
    }

    let query = supabase.from("campaigns").select("*").order("created_at", { ascending: false });
    if (filter !== "all") query = query.eq("status", filter);
    const { data } = await query;
    setCampaigns(data || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  // Estimate audience size when filters change
  const estimateAudience = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setEstimating(true);
    let query = supabase.from("customers").select("id", { count: "exact", head: true }).eq("account_id", user.id);

    if (newCampaign.channel && newCampaign.channel !== "all") {
      query = query.eq("channel", newCampaign.channel);
    }
    if (newCampaign.tag && newCampaign.tag !== "all") {
      query = query.contains("tags", [newCampaign.tag]);
    }
    if (newCampaign.minSpent && Number(newCampaign.minSpent) > 0) {
      query = query.gte("total_spent", Number(newCampaign.minSpent));
    }

    const { count } = await query;
    setAudienceCount(count || 0);
    setEstimating(false);
  }, [newCampaign.channel, newCampaign.tag, newCampaign.minSpent]);

  useEffect(() => {
    if (showCreateModal) {
      estimateAudience();
    }
  }, [showCreateModal, estimateAudience]);

  const handleDelete = async (id) => {
    if (!confirm("Delete this campaign?")) return;
    await supabase.from("campaigns").delete().eq("id", id);
    fetchCampaigns();
  };

  const handleStatusChange = async (id, newStatus) => {
    await supabase.from("campaigns").update({ status: newStatus }).eq("id", id);
    fetchCampaigns();
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    if (!newCampaign.name.trim()) return;
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

    // Build audience_filter JSONB
    const audienceFilter = {
      type: newCampaign.audience,
    };
    if (newCampaign.channel && newCampaign.channel !== "all") {
      audienceFilter.channel = newCampaign.channel;
    }
    if (newCampaign.tag && newCampaign.tag !== "all") {
      audienceFilter.tag = newCampaign.tag;
    }
    if (newCampaign.minSpent && Number(newCampaign.minSpent) > 0) {
      audienceFilter.min_spent = Number(newCampaign.minSpent);
    }

    // Format scheduled_at for the database
    let scheduledAt = null;
    if (newCampaign.scheduledAt) {
      scheduledAt = new Date(newCampaign.scheduledAt).toISOString();
    }

    const { error } = await supabase.from("campaigns").insert({
      account_id: user.id,
      name: newCampaign.name.trim(),
      message_template: newCampaign.message.trim(),
      audience_filter: audienceFilter,
      status: scheduledAt ? "scheduled" : "draft",
      scheduled_at: scheduledAt,
      sent_count: 0,
      delivered_count: 0,
      read_count: 0,
      replied_count: 0,
    });

    if (!error) {
      setShowCreateModal(false);
      setNewCampaign({ name: "", message: "", audience: "all", channel: "all", tag: "all", minSpent: "", scheduledAt: "" });
      setAudienceCount(null);
      fetchCampaigns();
    } else {
      alert("Failed to create campaign: " + error.message);
    }
    setSaving(false);
  };

  const handleSendCampaign = async (campaignId) => {
    if (!confirm("Send this campaign to all matching customers? This cannot be undone.")) return;
    setSendingCampaignId(campaignId);
    setSendResult(null);

    try {
      const res = await fetch("/api/campaigns/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      const data = await res.json();

      if (res.ok) {
        setSendResult({ type: "success", message: `Campaign sent! ${data.sent} messages sent, ${data.delivered} delivered, ${data.failed} failed.` });
        fetchCampaigns();
      } else {
        setSendResult({ type: "error", message: data.error || "Failed to send campaign" });
      }
    } catch (err) {
      setSendResult({ type: "error", message: "Failed to send campaign: " + err.message });
    }
    setSendingCampaignId(null);
  };

  // Compute stats
  const totalSent = campaigns.reduce((s, c) => s + (c.sent_count || 0), 0);
  const totalDelivered = campaigns.reduce((s, c) => s + (c.delivered_count || 0), 0);
  const totalRead = campaigns.reduce((s, c) => s + (c.read_count || 0), 0);
  const totalReplied = campaigns.reduce((s, c) => s + (c.replied_count || 0), 0);
  const readRate = totalDelivered > 0 ? ((totalRead / totalDelivered) * 100).toFixed(1) : "0";
  const replyRate = totalDelivered > 0 ? ((totalReplied / totalDelivered) * 100).toFixed(1) : "0";

  const campaignLimit = planLimits.campaigns_per_month;
  const limitReached = campaignLimit !== -1 && campaignLimit === 0;

  const formatDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const formatDateTime = (d) => new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const getStatusColor = (status) => {
    switch (status) {
      case "active": return "var(--accent-green)";
      case "completed": return "var(--accent-secondary)";
      case "scheduled": return "var(--accent-orange)";
      case "draft": return "var(--text-tertiary)";
      case "paused": return "var(--accent-primary-light)";
      default: return "var(--text-tertiary)";
    }
  };

  const getAudienceLabel = (filter) => {
    if (!filter || typeof filter === "string") return filter || "All";
    const parts = [];
    if (filter.type && filter.type !== "all") parts.push(filter.type.charAt(0).toUpperCase() + filter.type.slice(1));
    if (filter.channel && filter.channel !== "all") parts.push(filter.channel.charAt(0).toUpperCase() + filter.channel.slice(1));
    if (filter.tag && filter.tag !== "all") parts.push(filter.tag);
    if (filter.min_spent) parts.push(`Min ${filter.min_spent} EGP`);
    return parts.length > 0 ? parts.join(" • ") : "All Customers";
  };

  return (
    <>
      <div className="page-header">
        <h1>Campaigns</h1>
        <div className="page-header-actions">
          {limitReached ? (
            <button className="btn btn-primary" onClick={() => router.push('/dashboard/billing')} style={{ opacity: 0.7 }}>
              Upgrade for Campaigns
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} /> Create Campaign
            </button>
          )}
        </div>
      </div>

      {/* Send result notification */}
      {sendResult && (
        <div style={{
          padding: "var(--space-md) var(--space-lg)",
          marginBottom: "var(--space-lg)",
          borderRadius: "var(--radius-md)",
          background: sendResult.type === "success" ? "rgba(0, 200, 83, 0.1)" : "rgba(255, 82, 82, 0.1)",
          border: `1px solid ${sendResult.type === "success" ? "rgba(0, 200, 83, 0.3)" : "rgba(255, 82, 82, 0.3)"}`,
          color: sendResult.type === "success" ? "var(--accent-green)" : "var(--accent-red)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontWeight: 500, fontSize: "var(--font-size-sm)",
        }}>
          <span>{sendResult.message}</span>
          <button onClick={() => setSendResult(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 4 }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: "var(--space-xl)" }}>
        {[
          { label: "Total Sent", value: totalSent.toLocaleString(), icon: <Send size={18} />, color: "purple" },
          { label: "Delivered", value: totalDelivered.toLocaleString(), icon: <MessageCircle size={18} />, color: "blue" },
          { label: "Read Rate", value: `${readRate}%`, icon: <Eye size={18} />, color: "green" },
          { label: "Reply Rate", value: `${replyRate}%`, icon: <BarChart3 size={18} />, color: "orange" },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-card-header">
              <div className={`stat-card-icon ${s.color}`}>{s.icon}</div>
            </div>
            <div className="stat-card-value" style={{ fontSize: "var(--font-size-2xl)" }}>{s.value}</div>
            <div className="stat-card-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="filter-tabs">
          {["all", "draft", "scheduled", "active", "completed"].map((f) => (
            <button key={f} className={`filter-tab ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "var(--space-3xl)", textAlign: "center", color: "var(--text-tertiary)" }}>Loading campaigns...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="dashboard-panel" style={{ overflow: "visible" }}>
              <div style={{ padding: "var(--space-xl)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", marginBottom: "var(--space-sm)" }}>
                    <h3 style={{ fontWeight: 700 }}>{campaign.name}</h3>
                    <span style={{
                      padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: `${getStatusColor(campaign.status)}15`,
                      color: getStatusColor(campaign.status),
                      border: `1px solid ${getStatusColor(campaign.status)}33`,
                    }}>
                      {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "var(--space-xl)", fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)", flexWrap: "wrap" }}>
                    <span><Clock size={14} style={{ display: "inline", verticalAlign: -2, marginRight: 4 }} />{formatDate(campaign.created_at)}</span>
                    <span><Users size={14} style={{ display: "inline", verticalAlign: -2, marginRight: 4 }} />{getAudienceLabel(campaign.audience_filter)}</span>
                    {campaign.scheduled_at && (
                      <span><Calendar size={14} style={{ display: "inline", verticalAlign: -2, marginRight: 4 }} />Scheduled: {formatDateTime(campaign.scheduled_at)}</span>
                    )}
                  </div>
                  {/* Message preview */}
                  <div style={{
                    marginTop: "var(--space-sm)", padding: "var(--space-sm) var(--space-md)",
                    background: "var(--bg-glass)", borderRadius: "var(--radius-md)",
                    fontSize: "var(--font-size-sm)", color: "var(--text-secondary)",
                    border: "1px solid var(--border-subtle)", maxWidth: 500,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {campaign.message_template || "No message template"}
                  </div>
                </div>

                {campaign.sent_count > 0 && (
                  <div style={{ display: "flex", gap: "var(--space-2xl)", textAlign: "center" }}>
                    {[
                      { label: "Sent", value: campaign.sent_count.toLocaleString() },
                      { label: "Delivered", value: campaign.delivered_count.toLocaleString() },
                      { label: "Read", value: campaign.read_count.toLocaleString() },
                      { label: "Replied", value: campaign.replied_count.toLocaleString() },
                    ].map((m, i) => (
                      <div key={i}>
                        <div style={{ fontWeight: 700, fontSize: "var(--font-size-lg)" }}>{m.value}</div>
                        <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", gap: "var(--space-xs)", marginLeft: "var(--space-xl)" }}>
                  {campaign.status === "active" && (
                    <button className="topbar-btn" title="Pause" onClick={() => handleStatusChange(campaign.id, "paused")}><Pause size={16} /></button>
                  )}
                  {(campaign.status === "draft" || campaign.status === "paused") && (
                    <button
                      className="topbar-btn"
                      title="Send Now"
                      onClick={() => handleSendCampaign(campaign.id)}
                      disabled={sendingCampaignId === campaign.id}
                      style={{ color: "var(--accent-green)" }}
                    >
                      {sendingCampaignId === campaign.id ? <Loader2 size={16} className="spin" /> : <Zap size={16} />}
                    </button>
                  )}
                  {campaign.status === "draft" && (
                    <button className="topbar-btn" title="Activate" onClick={() => handleStatusChange(campaign.id, "active")}><Send size={16} /></button>
                  )}
                  <button className="topbar-btn" title="Delete" onClick={() => handleDelete(campaign.id)}><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ))}
          {campaigns.length === 0 && (
            <div style={{ padding: "var(--space-3xl)", textAlign: "center", color: "var(--text-tertiary)" }}>
              {limitReached ? (
                <>
                  <p>Campaigns are available on Professional and Business plans.</p>
                  <button className="btn btn-primary" style={{ marginTop: "var(--space-md)" }} onClick={() => router.push('/dashboard/billing')}>Upgrade Plan</button>
                </>
              ) : (
                "No campaigns yet. Create your first campaign to reach your customers."
              )}
            </div>
          )}
        </div>
      )}

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3>Create Campaign</h3>
              <button className="modal-close" onClick={() => { setShowCreateModal(false); setAudienceCount(null); }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateCampaign}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Campaign Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Summer Sale Announcement"
                    value={newCampaign.name}
                    onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Message Template</label>
                  <textarea
                    className="form-input form-textarea"
                    placeholder="Write your broadcast message here..."
                    value={newCampaign.message}
                    onChange={(e) => setNewCampaign({ ...newCampaign, message: e.target.value })}
                    rows={4}
                  />
                  <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>
                    Use {"{name}"} to personalize with the customer&apos;s name, {"{business_name}"} for your store name
                  </p>
                </div>

                {/* Audience Filtering */}
                <div style={{
                  padding: "var(--space-lg)", background: "var(--bg-glass)",
                  borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)",
                  marginBottom: "var(--space-lg)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: "var(--space-md)" }}>
                    <Filter size={16} style={{ color: "var(--accent-primary-light)" }} />
                    <label className="form-label" style={{ marginBottom: 0 }}>Audience Filters</label>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>Customer Segment</label>
                      <select
                        className="form-input"
                        value={newCampaign.audience}
                        onChange={(e) => setNewCampaign({ ...newCampaign, audience: e.target.value })}
                      >
                        <option value="all">All Customers</option>
                        <option value="vip">VIP Customers Only</option>
                        <option value="returning">Returning Customers</option>
                        <option value="new">New Customers</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>Channel</label>
                      <select
                        className="form-input"
                        value={newCampaign.channel}
                        onChange={(e) => setNewCampaign({ ...newCampaign, channel: e.target.value })}
                      >
                        <option value="all">All Channels</option>
                        <option value="instagram">Instagram Only</option>
                        <option value="facebook">Facebook Only</option>
                        <option value="whatsapp">WhatsApp Only</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>Customer Tag</label>
                      <select
                        className="form-input"
                        value={newCampaign.tag}
                        onChange={(e) => setNewCampaign({ ...newCampaign, tag: e.target.value })}
                      >
                        <option value="all">All Tags</option>
                        <option value="VIP">VIP</option>
                        <option value="new">New</option>
                        <option value="returning">Returning</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>Min. Spent (EGP)</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="e.g. 500"
                        value={newCampaign.minSpent}
                        onChange={(e) => setNewCampaign({ ...newCampaign, minSpent: e.target.value })}
                        min="0"
                      />
                    </div>
                  </div>
                  {/* Audience count estimate */}
                  <div style={{
                    marginTop: "var(--space-md)", padding: "var(--space-sm) var(--space-md)",
                    background: "rgba(108, 92, 231, 0.08)", borderRadius: "var(--radius-sm)",
                    fontSize: "var(--font-size-sm)", color: "var(--accent-primary-light)",
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <Users size={14} />
                    {estimating ? "Estimating..." : `${audienceCount ?? "?"} customers match these filters`}
                  </div>
                </div>

                {/* Schedule */}
                <div className="form-group">
                  <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Calendar size={14} /> Schedule (optional)
                  </label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={newCampaign.scheduledAt}
                    onChange={(e) => setNewCampaign({ ...newCampaign, scheduledAt: e.target.value })}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                  <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>
                    Leave empty to save as draft and send manually later
                  </p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowCreateModal(false); setAudienceCount(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving || !newCampaign.name.trim() || !newCampaign.message.trim()}>
                  {saving ? <><Loader2 size={14} className="spin" /> Creating...</> : (
                    newCampaign.scheduledAt
                      ? <><Calendar size={14} /> Schedule Campaign</>
                      : <><Send size={14} /> Create as Draft</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
