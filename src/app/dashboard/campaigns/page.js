"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("campaigns").select("*").order("created_at", { ascending: false });
    if (filter !== "all") query = query.eq("status", filter);
    const { data } = await query;
    setCampaigns(data || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const handleDelete = async (id) => {
    if (!confirm("Delete this campaign?")) return;
    await supabase.from("campaigns").delete().eq("id", id);
    fetchCampaigns();
  };

  const handleStatusChange = async (id, newStatus) => {
    await supabase.from("campaigns").update({ status: newStatus }).eq("id", id);
    fetchCampaigns();
  };

  // Compute stats
  const totalSent = campaigns.reduce((s, c) => s + (c.sent_count || 0), 0);
  const totalDelivered = campaigns.reduce((s, c) => s + (c.delivered_count || 0), 0);
  const totalRead = campaigns.reduce((s, c) => s + (c.read_count || 0), 0);
  const totalReplied = campaigns.reduce((s, c) => s + (c.replied_count || 0), 0);
  const readRate = totalDelivered > 0 ? ((totalRead / totalDelivered) * 100).toFixed(1) : "0";
  const replyRate = totalDelivered > 0 ? ((totalReplied / totalDelivered) * 100).toFixed(1) : "0";

  const formatDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <>
      <div className="page-header">
        <h1>Campaigns</h1>
      </div>

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
          {["all", "active", "completed", "draft"].map((f) => (
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
                    <span className={`status-badge ${campaign.status === "completed" ? "delivered" : campaign.status === "scheduled" ? "confirmed" : campaign.status}`}>
                      {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "var(--space-xl)", fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>
                    <span><Clock size={14} style={{ display: "inline", verticalAlign: -2, marginRight: 4 }} />{formatDate(campaign.created_at)}</span>
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
                    <button className="topbar-btn" title="Pause" onClick={() => handleStatusChange(campaign.id, "draft")}><Pause size={16} /></button>
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
            <div style={{ padding: "var(--space-3xl)", textAlign: "center", color: "var(--text-tertiary)" }}>No campaigns found</div>
          )}
        </div>
      )}
    </>
  );
}
