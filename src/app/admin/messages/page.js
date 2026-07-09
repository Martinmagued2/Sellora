"use client";

import { useState, useEffect } from "react";
import { Search, RefreshCw, Bot, User, ArrowRight, ArrowLeft } from "lucide-react";
import { useAdminAuth } from "@/lib/use-admin-auth";

export default function AdminMessages() {
  const { isAdmin, loading: adminLoading, userId } = useAdminAuth();
  const [messages, setMessages] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState("");
  const [isAiFilter, setIsAiFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");

  const fetchMessages = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "30" });
      if (search) params.set("search", search);
      if (directionFilter) params.set("direction", directionFilter);
      if (isAiFilter !== "") params.set("is_ai", isAiFilter);
      if (channelFilter) params.set("channel", channelFilter);

      const res = await fetch(`/api/admin/messages?${params}`, {
        headers: { "x-account-id": userId },
      });
      const json = await res.json();
      if (json.success) {
        setMessages(json.data.messages);
        setPagination(json.data.pagination);
      }
    } catch (e) {
      console.error("Failed to fetch messages:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!userId) return;
    const load = async () => { await fetchMessages(1); };
    load();
  }, [directionFilter, isAiFilter, channelFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchMessages(1);
  };

  const sentimentColors = {
    positive: "var(--accent-green)",
    neutral: "var(--text-tertiary)",
    negative: "var(--accent-red)",
    urgent: "var(--accent-orange)",
  };

  return (
    <>
      <div className="page-header">
        <h1>Messages</h1>
      </div>

      <div className="filter-bar">
        <div className="filter-tabs">
          {["", "incoming", "outgoing"].map((dir) => (
            <button
              key={dir}
              className={`filter-tab ${directionFilter === dir ? "active" : ""}`}
              onClick={() => setDirectionFilter(dir)}
            >
              {dir ? dir.charAt(0).toUpperCase() + dir.slice(1) : "All Directions"}
            </button>
          ))}
        </div>

        <div className="filter-tabs">
          {["", "true", "false"].map((val) => (
            <button
              key={val}
              className={`filter-tab ${isAiFilter === val ? "active" : ""}`}
              onClick={() => setIsAiFilter(val)}
            >
              {val === "" ? "All" : val === "true" ? "AI" : "Human"}
            </button>
          ))}
        </div>

        <div className="filter-tabs">
          {["", "instagram", "facebook", "whatsapp"].map((ch) => (
            <button
              key={ch}
              className={`filter-tab ${channelFilter === ch ? "active" : ""}`}
              onClick={() => setChannelFilter(ch)}
            >
              {ch ? ch.charAt(0).toUpperCase() + ch.slice(1) : "All Channels"}
            </button>
          ))}
        </div>

        <form className="filter-search" onSubmit={handleSearch}>
          <Search size={14} />
          <input
            type="text"
            placeholder="Search messages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
      </div>

      <div className="admin-table-container">
        {loading ? (
          <div style={{ padding: "var(--space-3xl)", textAlign: "center", color: "var(--text-tertiary)" }}>
            <RefreshCw size={20} className="spin" style={{ display: "inline-block" }} />
          </div>
        ) : (
          <div className="table-scroll-wrapper"><table className="data-table">
            <thead>
              <tr>
                <th>Content</th>
                <th>Direction</th>
                <th>AI</th>
                <th>Intent</th>
                <th>Sentiment</th>
                <th>Account</th>
                <th>Customer</th>
                <th>Channel</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((msg) => (
                <tr key={msg.id}>
                  <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {msg.content || "—"}
                  </td>
                  <td>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      fontSize: "var(--font-size-xs)", fontWeight: 600,
                      color: msg.direction === "incoming" ? "var(--accent-secondary)" : "var(--accent-primary-light)",
                    }}>
                      {msg.direction === "incoming" ? <ArrowLeft size={12} /> : <ArrowRight size={12} />}
                      {msg.direction}
                    </span>
                  </td>
                  <td>
                    {msg.is_ai ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--accent-secondary)", fontSize: "var(--font-size-xs)", fontWeight: 600 }}>
                        <Bot size={12} /> AI
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--text-tertiary)", fontSize: "var(--font-size-xs)" }}>
                        <User size={12} /> Human
                      </span>
                    )}
                  </td>
                  <td>
                    {msg.intent ? (
                      <span style={{
                        padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 600,
                        background: "rgba(108, 92, 231, 0.1)", color: "var(--accent-primary-light)",
                        textTransform: "capitalize",
                      }}>
                        {msg.intent.replace(/_/g, " ")}
                      </span>
                    ) : "—"}
                  </td>
                  <td>
                    {msg.sentiment ? (
                      <span style={{
                        padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 600,
                        background: `${sentimentColors[msg.sentiment] || "var(--text-tertiary)"}18`,
                        color: sentimentColors[msg.sentiment] || "var(--text-tertiary)",
                        textTransform: "capitalize",
                      }}>
                        {msg.sentiment}
                      </span>
                    ) : "—"}
                  </td>
                  <td style={{ fontSize: "var(--font-size-xs)" }}>
                    {msg.account?.business_name || "—"}
                  </td>
                  <td style={{ fontSize: "var(--font-size-xs)" }}>
                    {msg.customer?.name || "—"}
                  </td>
                  <td>
                    {msg.channel ? (
                      <span className={`channel-badge ${msg.channel}`}>{msg.channel}</span>
                    ) : "—"}
                  </td>
                  <td style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
                    {new Date(msg.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {messages.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "var(--space-3xl)", color: "var(--text-tertiary)" }}>
                    No messages found
                  </td>
                </tr>
              )}
            </tbody>
          </table></div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-sm)", marginTop: "var(--space-lg)" }}>
          <button className="btn btn-secondary btn-sm" disabled={pagination.page <= 1} onClick={() => fetchMessages(pagination.page - 1)}>Previous</button>
          <span style={{ display: "flex", alignItems: "center", fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </span>
          <button className="btn btn-secondary btn-sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchMessages(pagination.page + 1)}>Next</button>
        </div>
      )}
    </>
  );
}
