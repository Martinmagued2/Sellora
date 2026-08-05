"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Sparkles, Send, Bot, Loader2, ChevronRight, Plus, Search, Pin,
  Trash2, Download, Edit3, Check, X, MessageSquare, PanelLeftClose,
  PanelLeftOpen, Copy, ThumbsUp, ThumbsDown, RefreshCw, ExternalLink,
  Zap, TrendingUp, Package, Users, ShoppingBag, Bot as BotIcon
} from "lucide-react";
import MentionInput from "../components/MentionInput";
import VoiceRecorder from "../components/VoiceRecorder";

// ─── Helpers ───
const MENTION_DISPLAY_REGEX = /@\[([^\]]+)\]\((?:team_member|customer):[a-f0-9-]+\)/g;
function stripMentionEncoding(text) {
  if (!text || typeof text !== "string") return text;
  return text.replace(MENTION_DISPLAY_REGEX, "@$1");
}

function getMessageText(msg) {
  let raw = "";
  if (msg.parts && Array.isArray(msg.parts)) {
    raw = msg.parts.filter(p => p.type === "text").map(p => p.text).join("");
  }
  if (!raw && typeof msg.content === "string" && msg.content.trim()) raw = msg.content;
  return stripMentionEncoding(raw);
}

function getToolInvocations(msg) {
  if (msg.parts && Array.isArray(msg.parts)) {
    return msg.parts.filter(p => p.type && p.type.startsWith("tool-"));
  }
  return msg.toolInvocations || [];
}

const TOOL_LABELS = {
  get_store_analytics: { label: "Fetching analytics...", doneLabel: "Analytics ready", icon: "📊" },
  get_sales_report: { label: "Generating sales report...", doneLabel: "Sales report ready", icon: "💰" },
  get_latest_sales: { label: "Fetching recent sales...", doneLabel: "Recent sales loaded", icon: "🛒" },
  get_top_products: { label: "Finding top products...", doneLabel: "Top products found", icon: "📦" },
  create_product: { label: "Creating product...", doneLabel: "Product created", icon: "✨" },
  update_product: { label: "Updating product...", doneLabel: "Product updated", icon: "✏️" },
  delete_product: { label: "Archiving product...", doneLabel: "Product archived", icon: "🗑️" },
  search_products: { label: "Searching products...", doneLabel: "Search complete", icon: "🔍" },
  get_inventory_alerts: { label: "Checking inventory...", doneLabel: "Inventory checked", icon: "⚠️" },
  get_order_details: { label: "Fetching order details...", doneLabel: "Order details ready", icon: "📋" },
  update_order_status: { label: "Updating order...", doneLabel: "Order updated", icon: "🚚" },
  get_customer_insights: { label: "Analyzing customers...", doneLabel: "Customer insights ready", icon: "👥" },
  message_customer: { label: "Sending message...", doneLabel: "Message sent", icon: "💬" },
  find_conversation: { label: "Finding conversation...", doneLabel: "Conversation found", icon: "🔎" },
  send_follow_up: { label: "Sending follow-up...", doneLabel: "Follow-up sent", icon: "📧" },
  create_coupon: { label: "Creating coupon...", doneLabel: "Coupon created", icon: "🏷️" },
  list_coupons: { label: "Listing coupons...", doneLabel: "Coupons listed", icon: "🏷️" },
  create_task: { label: "Creating task...", doneLabel: "Task created", icon: "✅" },
  assign_task: { label: "Assigning task...", doneLabel: "Task assigned", icon: "📌" },
  list_team_members: { label: "Listing team members...", doneLabel: "Team loaded", icon: "👥" },
  draft_reply: { label: "Drafting reply...", doneLabel: "Draft ready", icon: "✍️" },
  rewrite_reply: { label: "Rewriting...", doneLabel: "Rewritten", icon: "🔄" },
  translate_message: { label: "Translating...", doneLabel: "Translated", icon: "🌐" },
  navigate_to: { label: "Navigating...", doneLabel: "Navigated", icon: "🧭" },
  compare_plans: { label: "Comparing plans...", doneLabel: "Plans compared", icon: "⚖️" },
};

// ─── Prompt Templates ───
const PROMPT_TEMPLATES = [
  { icon: TrendingUp, label: "Sales Report", prompt: "Give me a detailed sales report for this week with revenue, top products, and trends." },
  { icon: Package, label: "Inventory Check", prompt: "Show me inventory alerts — what's low stock or out of stock?" },
  { icon: Users, label: "Customer Insights", prompt: "Who are my top 5 customers by total spent? Show their order history." },
  { icon: ShoppingBag, label: "Recent Orders", prompt: "Show me my latest 10 orders with status and customer names." },
  { icon: Zap, label: "AI Command Center", prompt: "What should I focus on today? Give me 3 priority recommendations based on my store data." },
  { icon: BotIcon, label: "Draft a Reply", prompt: "Help me draft a reply to a customer who asked about shipping times. Make it friendly and professional." },
];

// ─── Main Component ───
export default function CopilotPage() {
  const router = useRouter();
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);  // persisted messages for active chat
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingChatId, setEditingChatId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [input, setInput] = useState("");
  const [thinkingText, setThinkingText] = useState("");
  const messagesEndRef = useRef(null);

  // useChat hook — uses the active chat's messages as initial state
  const { messages, sendMessage, status, error, clearError, setMessages } = useChat({
    api: "/api/chat",
    onError: (err) => console.error("[Copilot] useChat error:", err),
    onFinish: (message) => {
      // Persist the assistant's response to the database
      if (activeChatId && message) {
        const text = getMessageText(message);
        if (text) {
          saveMessage(activeChatId, "assistant", text);
        }
        // Auto-title the chat from the first user message
        autoTitleChat(activeChatId);
      }
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  // ─── Fetch chat list ───
  const fetchChats = useCallback(async () => {
    setLoadingChats(true);
    try {
      const res = await fetch("/api/copilot/chats");
      const data = await res.json();
      setChats(data.chats || []);
    } catch (e) {
      console.error("[Copilot] Failed to fetch chats:", e);
    } finally {
      setLoadingChats(false);
    }
  }, []);

  useEffect(() => { fetchChats(); }, [fetchChats]);

  // ─── Create new chat ───
  const MAX_CHATS = 3; // Limit: 3 chats per account
  const createNewChat = async () => {
    try {
      // Check if we've hit the chat limit (excluding pinned chats)
      const nonPinnedChats = chats.filter(c => !c.pinned);
      if (nonPinnedChats.length >= MAX_CHATS) {
        // Delete the oldest non-pinned chat to make room
        const oldest = nonPinnedChats[nonPinnedChats.length - 1];
        if (oldest) {
          console.log(`[Copilot] Chat limit reached — deleting oldest chat: ${oldest.title}`);
          await fetch(`/api/copilot/chats/${oldest.id}`, { method: "DELETE" });
          setChats(prev => prev.filter(c => c.id !== oldest.id));
        }
      }

      const res = await fetch("/api/copilot/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      const data = await res.json();
      if (data.chat) {
        setChats(prev => [data.chat, ...prev.filter(c => c.id !== data.chat.id)]);
        setActiveChatId(data.chat.id);
        setChatMessages([]);
        setMessages([]);
      }
    } catch (e) {
      console.error("[Copilot] Failed to create chat:", e);
    }
  };

  // ─── Load a chat ───
  const loadChat = async (chatId) => {
    setLoadingMessages(true);
    setActiveChatId(chatId);
    try {
      const res = await fetch(`/api/copilot/chats/${chatId}`);
      const data = await res.json();
      if (data.messages) {
        setChatMessages(data.messages);
        // Load messages into useChat for continuation
        setMessages(data.messages.map(m => ({
          id: m.id,
          role: m.role,
          parts: [{ type: "text", text: m.content }],
        })));
      }
    } catch (e) {
      console.error("[Copilot] Failed to load chat:", e);
    } finally {
      setLoadingMessages(false);
    }
  };

  // ─── Save a message to DB ───
  const saveMessage = async (chatId, role, content) => {
    try {
      await fetch(`/api/copilot/chats/${chatId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, content }),
      });
    } catch (e) {
      console.warn("[Copilot] Failed to save message:", e);
    }
  };

  // ─── Auto-title chat from first message ───
  const autoTitleChat = async (chatId) => {
    const firstUserMsg = messages.find(m => m.role === "user");
    if (!firstUserMsg) return;
    const text = getMessageText(firstUserMsg);
    if (!text || text.length < 5) return;

    // Generate a title (first 50 chars of the user's first message)
    const title = text.slice(0, 50).trim() + (text.length > 50 ? "..." : "");
    try {
      await fetch(`/api/copilot/chats/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, title } : c));
    } catch (e) {
      // Non-critical
    }
  };

  // ─── Delete a chat ───
  const deleteChat = async (chatId, event) => {
    event.stopPropagation();
    if (!confirm("Delete this chat? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/copilot/chats/${chatId}`, { method: "DELETE" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      // Remove from local state immediately
      setChats(prev => prev.filter(c => c.id !== chatId));
      if (activeChatId === chatId) {
        setActiveChatId(null);
        setChatMessages([]);
        setMessages([]);
      }
      // Re-fetch to ensure local state matches DB
      setTimeout(() => fetchChats(), 500);
    } catch (err) {
      console.error("[Copilot] Failed to delete chat:", err);
      alert("Failed to delete chat: " + err.message);
    }
  };

  // ─── Pin/unpin a chat ───
  const togglePin = async (chatId, e) => {
    e.stopPropagation();
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;
    try {
      await fetch(`/api/copilot/chats/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !chat.pinned }),
      });
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, pinned: !c.pinned } : c));
      // Re-sort: pinned first
      setChats(prev => [...prev].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.updated_at) - new Date(a.updated_at);
      }));
    } catch (e) {
      console.error("[Copilot] Failed to pin chat:", e);
    }
  };

  // ─── Rename a chat ───
  const startRename = (chatId, e) => {
    e.stopPropagation();
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;
    setEditingChatId(chatId);
    setEditTitle(chat.title);
  };

  const confirmRename = async (chatId) => {
    if (!editTitle.trim()) return;
    try {
      await fetch(`/api/copilot/chats/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim() }),
      });
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: editTitle.trim() } : c));
    } catch (e) {
      console.error("[Copilot] Failed to rename chat:", e);
    }
    setEditingChatId(null);
  };

  // ─── Export chat as markdown ───
  const exportChat = () => {
    const allMessages = messages.length > 0 ? messages : chatMessages.map(m => ({
      role: m.role,
      parts: [{ type: "text", text: m.content }],
    }));
    if (allMessages.length === 0) return;

    const chat = chats.find(c => c.id === activeChatId);
    let md = `# ${chat?.title || "Copilot Chat"}\n\n`;
    md += `Exported: ${new Date().toLocaleString()}\n\n---\n\n`;

    for (const msg of allMessages) {
      const text = getMessageText(msg);
      const role = msg.role === "user" ? "🧑 You" : "🤖 Sellora AI";
      md += `### ${role}\n\n${text}\n\n`;
    }

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(chat?.title || "copilot-chat").replace(/[^a-zA-Z0-9]/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Submit handler ───
  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userInput = input;

    // Create a chat if none is active, then send the message
    let chatId = activeChatId;
    if (!chatId) {
      try {
        const res = await fetch("/api/copilot/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "New Chat" }),
        });
        const data = await res.json();
        if (data.chat) {
          setChats(prev => [data.chat, ...prev]);
          setActiveChatId(data.chat.id);
          chatId = data.chat.id;
        }
      } catch (err) {
        console.error("[Copilot] Failed to create chat:", err);
        return;
      }
    }

    if (!chatId) return;

    clearError?.();
    setThinkingText(getThinkingMessage(userInput));
    sendMessage({ text: userInput });

    // Save user message to DB
    saveMessage(chatId, "user", userInput);
    setInput("");
  };

  // ─── Thinking message ───
  const getThinkingMessage = (text) => {
    const lower = text.toLowerCase();
    if (lower.includes("sales report") || lower.includes("revenue")) return "Let me pull up your sales data...";
    if (lower.includes("customer")) return "Let me analyze your customer data...";
    if (lower.includes("product") && lower.includes("create")) return "Let me create that product...";
    if (lower.includes("inventory") || lower.includes("stock")) return "Let me check your inventory...";
    if (lower.includes("order")) return "Let me fetch your orders...";
    return "Thinking...";
  };

  // ─── Auto-scroll ───
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  // ─── Clear thinking text when done ───
  useEffect(() => {
    if (!isLoading && thinkingText) setThinkingText("");
  }, [isLoading]);

  // ─── Filter chats by search ───
  const filteredChats = chats.filter(c =>
    !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinnedChats = filteredChats.filter(c => c.pinned);
  const regularChats = filteredChats.filter(c => !c.pinned);

  // ─── Render ───
  return (
    <div style={{ display: "flex", height: "calc(100vh - 64px)", overflow: "hidden" }}>
      {/* ─── Chat History Sidebar ─── */}
      {sidebarOpen && (
        <div style={{
          width: 280, flexShrink: 0, background: "var(--bg-secondary)",
          borderRight: "1px solid var(--border-subtle)", display: "flex",
          flexDirection: "column", overflow: "hidden",
        }}>
          {/* New Chat button */}
          <div style={{ padding: "12px 12px 8px" }}>
            <button
              onClick={createNewChat}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 10,
                background: "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)",
                color: "#fff", border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 600, display: "flex",
                alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 4px 12px rgba(108, 92, 231, 0.3)",
              }}
            >
              <Plus size={16} /> New Chat
            </button>
          </div>

          {/* Search */}
          <div style={{ padding: "0 12px 8px" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "var(--bg-card)", borderRadius: 8, padding: "6px 10px",
              border: "1px solid var(--border-subtle)",
            }}>
              <Search size={14} color="var(--text-tertiary)" />
              <input
                type="text" placeholder="Search chats..."
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: "transparent", border: "none", outline: "none",
                  flex: 1, fontSize: 13, color: "var(--text-primary)",
                }}
              />
            </div>
          </div>

          {/* Chat list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "0 8px" }}>
            {loadingChats ? (
              <div style={{ padding: 20, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
                <Loader2 size={16} className="spin" style={{ display: "inline-block", marginRight: 8 }} />
                Loading chats...
              </div>
            ) : filteredChats.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>
                No chats yet. Click "New Chat" to start.
              </div>
            ) : (
              <>
                {pinnedChats.length > 0 && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5, padding: "8px 8px 4px" }}>
                    📌 Pinned
                  </div>
                )}
                {pinnedChats.map(chat => (
                  <ChatListItem
                    key={chat.id}
                    chat={chat}
                    active={chat.id === activeChatId}
                    editing={editingChatId === chat.id}
                    editTitle={editTitle}
                    onLoad={() => loadChat(chat.id)}
                    onDelete={(e) => deleteChat(chat.id, e)}
                    onPin={(e) => togglePin(chat.id, e)}
                    onRename={(e) => startRename(chat.id, e)}
                    onEditChange={setEditTitle}
                    onEditConfirm={() => confirmRename(chat.id)}
                    onEditCancel={() => setEditingChatId(null)}
                  />
                ))}
                {regularChats.length > 0 && pinnedChats.length > 0 && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5, padding: "12px 8px 4px" }}>
                    Recent
                  </div>
                )}
                {regularChats.map(chat => (
                  <ChatListItem
                    key={chat.id}
                    chat={chat}
                    active={chat.id === activeChatId}
                    editing={editingChatId === chat.id}
                    editTitle={editTitle}
                    onLoad={() => loadChat(chat.id)}
                    onDelete={(e) => deleteChat(chat.id, e)}
                    onPin={(e) => togglePin(chat.id, e)}
                    onRename={(e) => startRename(chat.id, e)}
                    onEditChange={setEditTitle}
                    onEditConfirm={() => confirmRename(chat.id)}
                    onEditCancel={() => setEditingChatId(null)}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Main Chat Area ─── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header bar */}
        <div style={{
          padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)",
          display: "flex", alignItems: "center", gap: 12, background: "var(--bg-card)",
        }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-secondary)", padding: 4, borderRadius: 6,
            }}
            title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          >
            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>

          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            fontWeight: 600, fontSize: 15, color: "var(--text-primary)",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Sparkles size={14} color="#fff" />
            </div>
            Sellora Agent
          </div>

          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            {activeChatId ? (chats.find(c => c.id === activeChatId)?.title || "New Chat") : "No chat selected"}
          </span>

          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {activeChatId && messages.length > 0 && (
              <button
                onClick={exportChat}
                style={{
                  background: "none", border: "1px solid var(--border-medium)",
                  borderRadius: 6, padding: "5px 10px", cursor: "pointer",
                  fontSize: 12, color: "var(--text-secondary)", display: "flex",
                  alignItems: "center", gap: 4,
                }}
                title="Export chat as markdown"
              >
                <Download size={13} /> Export
              </button>
            )}
          </div>
        </div>

        {/* Messages area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {!activeChatId ? (
            /* Empty state with prompt templates */
            <div style={{
              maxWidth: 800, margin: "0 auto", paddingTop: 40,
              display: "flex", flexDirection: "column", alignItems: "center",
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: 20,
                background: "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 20, boxShadow: "0 8px 24px rgba(108, 92, 231, 0.3)",
              }}>
                <Sparkles size={32} color="#fff" />
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>
                Welcome to Sellora Agent
              </h1>
              <p style={{ color: "var(--text-tertiary)", fontSize: 14, marginBottom: 32, textAlign: "center", maxWidth: 500 }}>
                Your AI business assistant. Ask anything, manage your store, draft messages, analyze data, and more.
              </p>

              <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 12, width: "100%", maxWidth: 700,
              }}>
                {PROMPT_TEMPLATES.map((tpl, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      // Create a new chat and send the prompt
                      if (!activeChatId) {
                        fetch("/api/copilot/chats", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ title: tpl.label }),
                        }).then(r => r.json()).then(data => {
                          if (data.chat) {
                            setChats(prev => [data.chat, ...prev]);
                            setActiveChatId(data.chat.id);
                            setThinkingText(getThinkingMessage(tpl.prompt));
                            sendMessage({ text: tpl.prompt });
                            saveMessage(data.chat.id, "user", tpl.prompt);
                          }
                        });
                      } else {
                        setThinkingText(getThinkingMessage(tpl.prompt));
                        sendMessage({ text: tpl.prompt });
                        saveMessage(activeChatId, "user", tpl.prompt);
                      }
                    }}
                    style={{
                      background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                      borderRadius: 12, padding: 16, cursor: "pointer",
                      display: "flex", flexDirection: "column", gap: 8,
                      textAlign: "left", transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "rgba(108, 92, 231, 0.3)";
                      e.currentTarget.style.background = "rgba(108, 92, 231, 0.03)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-subtle)";
                      e.currentTarget.style.background = "var(--bg-card)";
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: "rgba(108, 92, 231, 0.1)", color: "#6c5ce7",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <tpl.icon size={18} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                      {tpl.label}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.4 }}>
                      {tpl.prompt}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : loadingMessages ? (
            <div style={{ textAlign: "center", paddingTop: 40, color: "var(--text-tertiary)" }}>
              <Loader2 size={20} className="spin" /> Loading chat...
            </div>
          ) : (
            <div style={{ maxWidth: 900, margin: "0 auto" }}>
              {/* Render messages from useChat (live) — when loading a saved chat,
                  messages are loaded into useChat via setMessages() in loadChat() */}
              {/* If useChat is empty but we have persisted messages, render those */}
              {(() => {
                const displayMessages = messages.length > 0 ? messages : chatMessages.map(m => ({
                  id: m.id,
                  role: m.role,
                  parts: [{ type: "text", text: m.content }],
                }));
                return displayMessages.map((msg) => {
                const text = getMessageText(msg);
                const toolInvs = getToolInvocations(msg);

                if (msg.role === "user" && !text && toolInvs.length === 0) return null;

                return (
                  <div key={msg.id} style={{
                    display: "flex", gap: 12, marginBottom: 20,
                    flexDirection: msg.role === "user" ? "row-reverse" : "row",
                  }}>
                    {/* Avatar */}
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: msg.role === "user"
                        ? "var(--bg-hover)"
                        : "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {msg.role === "user"
                        ? <span style={{ fontSize: 14 }}>🧑</span>
                        : <Bot size={14} color="#fff" />
                      }
                    </div>

                    {/* Message bubble */}
                    <div style={{
                      maxWidth: "75%",
                      background: msg.role === "user" ? "var(--bg-hover)" : "var(--bg-card)",
                      border: msg.role === "user" ? "1px solid var(--border-subtle)" : "1px solid var(--border-subtle)",
                      borderRadius: 12, padding: 14, overflow: "hidden",
                    }}>
                      {/* Tool badges */}
                      {toolInvs.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                          {toolInvs.map((inv, idx) => {
                            const toolName = inv.type?.startsWith("tool-") ? inv.type.slice(5) : inv.toolName;
                            const info = TOOL_LABELS[toolName] || { label: `${toolName}...`, doneLabel: `${toolName} done`, icon: "🔧" };
                            const complete = inv.state === "output-available" || inv.state === "output-error" || inv.output || inv.result;
                            return (
                              <span key={idx} style={{
                                padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                                background: complete ? "rgba(0, 200, 83, 0.1)" : "rgba(108, 92, 231, 0.1)",
                                color: complete ? "#00c853" : "#6c5ce7",
                                display: "flex", alignItems: "center", gap: 4,
                              }}>
                                {complete ? "✓" : <Loader2 size={10} className="spin" />}
                                {info.icon} {complete ? info.doneLabel : info.label}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Markdown text */}
                      {text && (
                        <div className="copilot-text-content">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                            p: ({children}) => <p style={{ margin: "0 0 8px 0", lineHeight: 1.6, fontSize: 14 }}>{children}</p>,
                            h1: ({children}) => <h1 style={{ fontSize: 18, fontWeight: 700, margin: "12px 0 8px 0" }}>{children}</h1>,
                            h2: ({children}) => <h2 style={{ fontSize: 16, fontWeight: 700, margin: "10px 0 6px 0" }}>{children}</h2>,
                            h3: ({children}) => <h3 style={{ fontSize: 15, fontWeight: 600, margin: "8px 0 4px 0" }}>{children}</h3>,
                            ul: ({children}) => <ul style={{ margin: "4px 0 8px 0", paddingLeft: 20, lineHeight: 1.6, fontSize: 14 }}>{children}</ul>,
                            ol: ({children}) => <ol style={{ margin: "4px 0 8px 0", paddingLeft: 20, lineHeight: 1.6, fontSize: 14 }}>{children}</ol>,
                            li: ({children}) => <li style={{ marginBottom: 2 }}>{children}</li>,
                            strong: ({children}) => <strong style={{ fontWeight: 700, color: "var(--text-primary)" }}>{children}</strong>,
                            code: ({children}) => <code style={{ background: "rgba(108, 92, 231, 0.1)", color: "#6c5ce7", padding: "2px 6px", borderRadius: 4, fontSize: 13, fontFamily: "monospace" }}>{children}</code>,
                            pre: ({children}) => <pre style={{ background: "rgba(0,0,0,0.05)", padding: 12, borderRadius: 8, overflowX: "auto", fontSize: 13, margin: "8px 0" }}>{children}</pre>,
                            blockquote: ({children}) => <blockquote style={{ borderLeft: "3px solid #6c5ce7", paddingLeft: 12, margin: "8px 0", fontStyle: "italic", color: "var(--text-secondary)" }}>{children}</blockquote>,
                            a: ({children, href}) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "#6c5ce7", textDecoration: "underline" }}>{children}</a>,
                            table: ({children}) => (
                              <div style={{ overflowX: "auto", margin: "8px 0" }}>
                                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13, border: "1px solid var(--border-medium)" }}>{children}</table>
                              </div>
                            ),
                            thead: ({children}) => <thead style={{ background: "rgba(108, 92, 231, 0.08)" }}>{children}</thead>,
                            th: ({children}) => <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid var(--border-medium)" }}>{children}</th>,
                            td: ({children}) => <td style={{ padding: "6px 12px", borderBottom: "1px solid var(--border-subtle)" }}>{children}</td>,
                            hr: () => <hr style={{ border: "none", borderTop: "1px solid var(--border-subtle)", margin: "12px 0" }} />,
                          }}>
                            {text}
                          </ReactMarkdown>
                        </div>
                      )}

                      {/* Action buttons from tool outputs */}
                      {toolInvs.map((inv, idx) => {
                        const output = inv.output || inv.result;
                        const action = output?._action;
                        if (!action?.path) return null;
                        return (
                          <button
                            key={idx}
                            onClick={() => router.push(action.path)}
                            style={{
                              marginTop: 8, padding: "6px 12px", borderRadius: 8,
                              background: "var(--bg-hover)", border: "1px solid var(--border-medium)",
                              cursor: "pointer", fontSize: 12, fontWeight: 600,
                              color: "#6c5ce7", display: "flex", alignItems: "center", gap: 4,
                            }}
                          >
                            <ExternalLink size={12} /> {action.label || "Open"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              });
              })()}

              {/* Thinking indicator */}
              {isLoading && (
                <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Bot size={14} color="#fff" />
                  </div>
                  <div style={{
                    background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                    borderRadius: 12, padding: 14, fontSize: 13, color: "var(--text-tertiary)",
                  }}>
                    <Loader2 size={12} className="spin" style={{ marginRight: 8, verticalAlign: "middle" }} />
                    {thinkingText || "Thinking..."}
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div style={{
                  background: "rgba(255, 82, 82, 0.05)", border: "1px solid rgba(255, 82, 82, 0.2)",
                  borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: "var(--accent-red)",
                }}>
                  ⚠️ {error.message || "Something went wrong. Please try again."}
                  <button onClick={clearError} style={{ marginLeft: 12, background: "none", border: "none", cursor: "pointer", color: "var(--accent-red)", textDecoration: "underline" }}>
                    Dismiss
                  </button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div style={{
          padding: "12px 24px 20px", borderTop: "1px solid var(--border-subtle)",
          background: "var(--bg-card)",
        }}>
          <form
            onSubmit={handleSubmit}
            style={{
              maxWidth: 900, margin: "0 auto", display: "flex", gap: 10,
              alignItems: "flex-end",
              background: "var(--bg-secondary)", borderRadius: 16,
              border: "1px solid var(--border-subtle)", padding: "8px 8px 8px 16px",
            }}
          >
            <VoiceRecorder
              compact
              onTranscribe={(text) => setInput(text)}
              disabled={isLoading}
            />
            <MentionInput
              value={input}
              onChange={setInput}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Ask Sellora Agent anything... (type @ to mention)"
              disabled={isLoading}
              id="copilot-input"
              style={{ flex: 1 }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              style={{
                width: 40, height: 40, borderRadius: 12, border: "none",
                background: "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)",
                color: "#fff", cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center",
                opacity: (!input.trim() || isLoading) ? 0.4 : 1,
                flexShrink: 0,
              }}
            >
              {isLoading ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
            </button>
          </form>
          <div style={{ textAlign: "center", fontSize: 10, color: "var(--text-tertiary)", marginTop: 6 }}>
            Press Enter to send · Shift+Enter for new line · Type @ to mention team members or customers
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Chat List Item Component ───
function ChatListItem({ chat, active, editing, editTitle, onLoad, onDelete, onPin, onRename, onEditChange, onEditConfirm, onEditCancel }) {
  return (
    <div
      onClick={onLoad}
      style={{
        padding: "8px 10px", borderRadius: 8, marginBottom: 2, cursor: "pointer",
        background: active ? "rgba(108, 92, 231, 0.1)" : "transparent",
        border: active ? "1px solid rgba(108, 92, 231, 0.2)" : "1px solid transparent",
        transition: "all 0.15s ease",
        display: "flex", alignItems: "center", gap: 6,
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "var(--bg-hover)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      <MessageSquare size={13} color={active ? "#6c5ce7" : "var(--text-tertiary)"} style={{ flexShrink: 0 }} />

      {editing ? (
        <input
          type="text"
          value={editTitle}
          onChange={(e) => onEditChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onEditConfirm();
            if (e.key === "Escape") onEditCancel();
          }}
          onBlur={onEditConfirm}
          autoFocus
          style={{
            flex: 1, background: "var(--bg-card)", border: "1px solid var(--border-medium)",
            borderRadius: 4, padding: "2px 6px", fontSize: 12, color: "var(--text-primary)",
            outline: "none",
          }}
        />
      ) : (
        <span style={{
          flex: 1, fontSize: 12, fontWeight: active ? 600 : 400,
          color: active ? "var(--text-primary)" : "var(--text-secondary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {chat.title}
        </span>
      )}

      {!editing && (
        <div style={{ display: "flex", gap: 2, opacity: 0.6 }}>
          <button
            onClick={onPin}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: 2,
              color: chat.pinned ? "#6c5ce7" : "var(--text-tertiary)",
            }}
            title={chat.pinned ? "Unpin" : "Pin"}
          >
            <Pin size={11} fill={chat.pinned ? "#6c5ce7" : "none"} />
          </button>
          <button
            onClick={onRename}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--text-tertiary)" }}
            title="Rename"
          >
            <Edit3 size={11} />
          </button>
          <button
            onClick={onDelete}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--text-tertiary)" }}
            title="Delete"
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  );
}
