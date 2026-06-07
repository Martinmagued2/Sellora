"use client";

import { useState, useEffect } from "react";
import { Search, X, MessageCircle, RefreshCw, Camera, Globe2, Phone, Bot } from "lucide-react";
import { useAdminAuth } from "@/lib/use-admin-auth";

export default function AdminConversations() {
  const { isAdmin, loading: adminLoading, userId } = useAdminAuth();
  const [conversations, setConversations] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const fetchConversations = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (channelFilter) params.set("channel", channelFilter);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/admin/conversations?${params}`, {
        headers: { "x-account-id": userId },
      });
      const json = await res.json();
      if (json.success) {
        setConversations(json.data.conversations);
        setPagination(json.data.pagination);
      }
    } catch (e) {
      console.error("Failed to fetch conversations:", e);
    }
    setLoading(false);
  };

  const fetchMessages = async (convId) => {
    setMessagesLoading(true);
    try {
      const res = await fetch(`/api/admin/messages?conversation_id=${convId}&limit=50`, {
        headers: { "x-account-id": userId },
      });
      const json = await res.json();
      if (json.success) {
        setMessages(json.data.messages);
      }
    } catch (e) {
      console.error("Failed to fetch messages:", e);
    }
    setMessagesLoading(false);
  };

  useEffect(() => {
    if (!userId) return;
    const load = async () => { await fetchConversations(1); };
    load();
  }, [channelFilter, statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchConversations(1);
  };

  const openConversation = (conv) => {
    setSelectedConv(conv);
    fetchMessages(conv.id);
  };

  const channelIcons = {
    instagram: <Camera size={12} />,
    facebook: <Globe2 size={12} />,
    whatsapp: <Phone size={12} />,
  };

  const statusColors = {
    new: "var(--accent-secondary)",
    open: "var(--accent-green)",
    in_progress: "var(--accent-primary-light)",
    closed: "var(--text-tertiary)",
  };

  return (
    <>
      <div className="page-header">
        <h1>Conversations</h1>
      </div>

      <div className="filter-bar">
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

        <div className="filter-tabs" style={{ marginLeft: "var(--space-sm)" }}>
          {["", "new", "open", "in_progress", "closed"].map((st) => (
            <button
              key={st}
              className={`filter-tab ${statusFilter === st ? "active" : ""}`}
              onClick={() => setStatusFilter(st)}
            >
              {st ? st.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "All Status"}
            </button>
          ))}
        </div>

        <form className="filter-search" onSubmit={handleSearch}>
          <Search size={14} />
          <input
            type="text"
            placeholder="Search conversations..."
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
                <th>Customer</th>
                <th>Account</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Last Message</th>
                <th>Unread</th>
                <th>Messages</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {conversations.map((conv) => (
                <tr
                  key={conv.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => openConversation(conv)}
                >
                  <td style={{ fontWeight: 600 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: "var(--accent-gradient)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, flexShrink: 0,
                      }}>
                        {(conv.customer?.name || "U").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div>{conv.customer?.name || "Unknown"}</div>
                        {conv.customer?.phone && (
                          <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{conv.customer.phone}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: "var(--font-size-sm)" }}>
                    {conv.account?.business_name || "—"}
                  </td>
                  <td>
                    <span className={`channel-badge ${conv.channel}`}>
                      {channelIcons[conv.channel]}
                      {conv.channel}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600,
                      background: `${statusColors[conv.status] || "var(--text-tertiary)"}18`,
                      color: statusColors[conv.status] || "var(--text-tertiary)",
                    }}>
                      {conv.status}
                    </span>
                  </td>
                  <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
                    {conv.last_message?.content || "—"}
                  </td>
                  <td>
                    {conv.unread_count > 0 ? (
                      <span style={{
                        width: 22, height: 22, borderRadius: "50%",
                        background: "#E84327", color: "white",
                        fontSize: 10, fontWeight: 700,
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {conv.unread_count}
                      </span>
                    ) : "—"}
                  </td>
                  <td>{conv.message_count}</td>
                  <td style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
                    {new Date(conv.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {conversations.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "var(--space-3xl)", color: "var(--text-tertiary)" }}>
                    No conversations found
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
          <button className="btn btn-secondary btn-sm" disabled={pagination.page <= 1} onClick={() => fetchConversations(pagination.page - 1)}>Previous</button>
          <span style={{ display: "flex", alignItems: "center", fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button className="btn btn-secondary btn-sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchConversations(pagination.page + 1)}>Next</button>
        </div>
      )}

      {/* Slide-out panel for conversation messages */}
      {selectedConv && (
        <div className="admin-slide-panel">
          <div className="admin-slide-panel-header">
            <div>
              <div style={{ fontWeight: 700 }}>{selectedConv.customer?.name || "Unknown"}</div>
              <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
                {selectedConv.account?.business_name} • {selectedConv.channel}
              </div>
            </div>
            <button onClick={() => setSelectedConv(null)} style={{ background: "none", color: "var(--text-tertiary)", padding: 4 }}>
              <X size={20} />
            </button>
          </div>
          <div className="admin-slide-panel-body">
            {messagesLoading ? (
              <div style={{ textAlign: "center", color: "var(--text-tertiary)" }}>Loading messages...</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`chat-msg ${msg.direction === "incoming" ? "incoming" : msg.is_ai ? "ai-reply" : "outgoing"}`}
                  >
                    {msg.is_ai && (
                      <div className="ai-label">
                        <Bot size={10} /> AI Reply
                      </div>
                    )}
                    {msg.content}
                    <span className="msg-time">{new Date(msg.created_at).toLocaleTimeString()}</span>
                  </div>
                ))}
                {messages.length === 0 && (
                  <div style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "var(--space-xl)" }}>
                    No messages found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
