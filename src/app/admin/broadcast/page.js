"use client";

import { useState, useEffect } from "react";
import {
  Megaphone, Send, Instagram, Facebook, Phone, Users, RefreshCw, CheckCircle, AlertCircle,
} from "lucide-react";

const ADMIN_ACCOUNT_ID = "0643bcc3-d5ef-43e1-a1be-0b36de04ef92";

export default function AdminBroadcast() {
  const [message, setMessage] = useState("");
  const [channels, setChannels] = useState(["instagram", "facebook", "whatsapp"]);
  const [target, setTarget] = useState("all");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [previewCount, setPreviewCount] = useState(null);
  const [recentBroadcasts, setRecentBroadcasts] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  // Fetch preview count
  useEffect(() => {
    const fetchPreview = async () => {
      try {
        const res = await fetch("/api/admin/accounts?limit=1000", {
          headers: { "x-account-id": ADMIN_ACCOUNT_ID },
        });
        const json = await res.json();
        if (json.success) {
          let accounts = json.data.accounts || [];
          if (target.startsWith("plan:")) {
            const plan = target.replace("plan:", "");
            accounts = accounts.filter((a) => a.plan === plan);
          }
          const eligible = accounts.filter((a) =>
            channels.some((ch) => {
              const map = { instagram: "instagram_connected", facebook: "facebook_connected", whatsapp: "whatsapp_connected" };
              return a[map[ch]];
            })
          );
          setPreviewCount(eligible.length);
        }
      } catch (e) {
        setPreviewCount(null);
      }
    };
    fetchPreview();
  }, [channels, target]);

  // Fetch recent broadcasts
  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const res = await fetch("/api/campaigns/broadcast-logs?limit=10", {
          headers: { "x-account-id": ADMIN_ACCOUNT_ID },
        });
        const json = await res.json();
        if (json.success && json.data?.campaigns) {
          setRecentBroadcasts(json.data.campaigns);
        }
      } catch (e) {
        // Silent fail
      }
      setLoadingRecent(false);
    };
    fetchRecent();
  }, []);

  const handleChannelToggle = (channel) => {
    setChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  };

  const handleSend = async () => {
    if (!message.trim()) {
      setError("Message is required");
      return;
    }
    if (channels.length === 0) {
      setError("Select at least one channel");
      return;
    }

    setSending(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-account-id": ADMIN_ACCOUNT_ID,
        },
        body: JSON.stringify({ message, channels, target, name: "Admin Broadcast" }),
      });
      const json = await res.json();

      if (json.success) {
        setResult(json.data);
        setMessage("");
      } else {
        setError(json.error || "Failed to send broadcast");
      }
    } catch (e) {
      setError("Network error");
    }
    setSending(false);
  };

  const channelOptions = [
    { id: "instagram", label: "Instagram", icon: Instagram, color: "#E1306C" },
    { id: "facebook", label: "Facebook", icon: Facebook, color: "#1877F2" },
    { id: "whatsapp", label: "WhatsApp", icon: Phone, color: "#25D366" },
  ];

  return (
    <>
      <div className="page-header">
        <h1>Platform Broadcast</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-lg)" }}>
        {/* Broadcast Form */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3><Megaphone size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: 8 }} />New Broadcast</h3>
          </div>
          <div className="dashboard-panel-body" style={{ padding: "var(--space-lg)" }}>
            {/* Message */}
            <div className="form-group">
              <label className="form-label">Message</label>
              <textarea
                className="admin-broadcast-textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter your broadcast message..."
                rows={5}
              />
            </div>

            {/* Channel Selector */}
            <div className="form-group">
              <label className="form-label">Channels</label>
              <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                {channelOptions.map((ch) => {
                  const isActive = channels.includes(ch.id);
                  const Icon = ch.icon;
                  return (
                    <button
                      key={ch.id}
                      onClick={() => handleChannelToggle(ch.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "8px 16px", borderRadius: "var(--radius-full)",
                        background: isActive ? `${ch.color}20` : "var(--bg-glass)",
                        border: `1px solid ${isActive ? ch.color : "var(--border-subtle)"}`,
                        color: isActive ? ch.color : "var(--text-tertiary)",
                        fontWeight: 600, fontSize: "var(--font-size-sm)",
                        cursor: "pointer", transition: "all var(--transition-fast)",
                      }}
                    >
                      <Icon size={14} />
                      {ch.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target Selector */}
            <div className="form-group">
              <label className="form-label">Target Audience</label>
              <select
                className="admin-select"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="all">All Users</option>
                <option value="plan:starter">Starter Plan Only</option>
                <option value="plan:professional">Professional Plan Only</option>
                <option value="plan:business">Business Plan Only</option>
              </select>
            </div>

            {/* Preview */}
            <div className="admin-broadcast-preview">
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
                <Users size={16} style={{ color: "#E84327" }} />
                <span style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>Audience Preview</span>
              </div>
              <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, color: "#E84327" }}>
                {previewCount !== null ? previewCount : "—"}
              </div>
              <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
                eligible accounts will receive this broadcast across {channels.length} channel{channels.length !== 1 ? "s" : ""}
              </div>
            </div>

            {/* Send Button */}
            <button
              className="admin-send-btn"
              onClick={handleSend}
              disabled={sending || !message.trim() || channels.length === 0}
              style={{ width: "100%", justifyContent: "center" }}
            >
              {sending ? (
                <>
                  <RefreshCw size={16} className="spin" /> Sending...
                </>
              ) : (
                <>
                  <Send size={16} /> Send Broadcast
                </>
              )}
            </button>

            {/* Result */}
            {result && (
              <div style={{
                marginTop: "var(--space-lg)", padding: "var(--space-lg)",
                background: "rgba(0, 230, 118, 0.05)",
                border: "1px solid rgba(0, 230, 118, 0.2)",
                borderRadius: 16,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
                  <CheckCircle size={20} style={{ color: "var(--accent-green)" }} />
                  <span style={{ fontWeight: 700 }}>Broadcast Sent!</span>
                </div>
                <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", lineHeight: 1.8 }}>
                  <div><strong>Campaigns Created:</strong> {result.campaignsCreated}</div>
                  <div><strong>Eligible Accounts:</strong> {result.eligibleAccounts}</div>
                  <div><strong>Errors:</strong> {result.errors}</div>
                  <div><strong>Channels:</strong> {result.channels?.join(", ")}</div>
                </div>
              </div>
            )}

            {error && (
              <div style={{
                marginTop: "var(--space-lg)", padding: "var(--space-md)",
                background: "rgba(255, 82, 82, 0.05)",
                border: "1px solid rgba(255, 82, 82, 0.2)",
                borderRadius: 12,
                display: "flex", alignItems: "center", gap: "var(--space-sm)",
                color: "var(--accent-red)", fontSize: "var(--font-size-sm)",
              }}>
                <AlertCircle size={16} />
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Recent Broadcasts */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3>Recent Broadcasts</h3>
          </div>
          <div className="dashboard-panel-body" style={{ padding: "var(--space-md)" }}>
            {loadingRecent ? (
              <div style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "var(--space-xl)" }}>
                <RefreshCw size={20} className="spin" style={{ display: "inline-block" }} />
              </div>
            ) : recentBroadcasts.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "var(--space-2xl)" }}>
                <Megaphone size={32} style={{ margin: "0 auto var(--space-md)", opacity: 0.3 }} />
                <div>No recent broadcasts</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                {recentBroadcasts.map((bc, i) => (
                  <div key={i} style={{
                    padding: "var(--space-md)", background: "var(--bg-glass)",
                    borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>{bc.name || "Broadcast"}</span>
                      <span className={`status-badge ${bc.status}`}>{bc.status}</span>
                    </div>
                    <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginBottom: 4 }}>
                      {bc.channel || "—"} • {new Date(bc.created_at).toLocaleString()}
                    </div>
                    {bc.message_template && (
                      <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {bc.message_template}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
