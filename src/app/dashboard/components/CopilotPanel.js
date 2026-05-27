"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, Send, Bot, Loader2, TrendingUp, Package, FileText, Users, DollarSign, ChevronRight, Trash2, AlertTriangle, ExternalLink } from "lucide-react";
import { useChat } from "@ai-sdk/react";

// ─── AI SDK v6 Message Helpers ───
// In AI SDK v6, messages use a `parts` array with specific types:
// - Text: { type: 'text', text: '...', state: 'streaming'|'done' }
// - Static tool: { type: 'tool-{toolName}', toolCallId, state, input, output? }
// - Dynamic tool: { type: 'dynamic-tool', toolName, toolCallId, state, input, output? }
// - Step start: { type: 'step-start' }
//
// Tool states: 'input-streaming' → 'input-available' → 'output-available' | 'output-error'

function isToolPart(part) {
  return part.type.startsWith("tool-") || part.type === "dynamic-tool";
}

function getToolName(part) {
  if (part.type === "dynamic-tool") return part.toolName;
  // Static tool: type is 'tool-{toolName}' — extract name after 'tool-'
  return part.type.slice(5);
}

function isToolComplete(part) {
  return part.state === "output-available" || part.state === "output-error" || part.state === "output-denied";
}

// Extract text from all text parts in a message
function getMessageText(msg) {
  if (msg.parts && Array.isArray(msg.parts)) {
    return msg.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("");
  }
  // Fallback for older format
  if (typeof msg.content === "string" && msg.content) return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("");
  }
  return "";
}

// Get all tool invocation parts from a message
function getToolInvocations(msg) {
  if (!msg.parts || !Array.isArray(msg.parts)) return [];
  return msg.parts.filter(isToolPart);
}

// Extract _action from tool output
function getToolAction(inv) {
  if (inv.output && inv.output._action) {
    return inv.output._action;
  }
  return null;
}

// Tool name to friendly label mapping
const TOOL_LABELS = {
  get_store_analytics: { label: "Fetching store analytics...", icon: "📊", doneLabel: "Store analytics loaded" },
  get_sales_report: { label: "Generating sales report...", icon: "📋", doneLabel: "Sales report generated" },
  get_latest_sales: { label: "Fetching recent sales...", icon: "💰", doneLabel: "Recent sales loaded" },
  get_top_products: { label: "Loading products...", icon: "📦", doneLabel: "Products loaded" },
  create_product: { label: "Creating product...", icon: "✨", doneLabel: "Product created" },
  update_product: { label: "Updating product...", icon: "✏️", doneLabel: "Product updated" },
  draft_product_description: { label: "Drafting description...", icon: "📝", doneLabel: "Description drafted" },
  delete_product: { label: "Archiving product...", icon: "🗑️", doneLabel: "Product archived" },
  search_products: { label: "Searching products...", icon: "🔍", doneLabel: "Search complete" },
  get_inventory_alerts: { label: "Checking inventory alerts...", icon: "⚠️", doneLabel: "Inventory alerts loaded" },
  update_order_status: { label: "Updating order status...", icon: "🚚", doneLabel: "Order status updated" },
  get_order_details: { label: "Loading order details...", icon: "🧾", doneLabel: "Order details loaded" },
  get_recent_conversations: { label: "Loading conversations...", icon: "💬", doneLabel: "Conversations loaded" },
  get_customer_insights: { label: "Analyzing customers...", icon: "👥", doneLabel: "Customer insights loaded" },
};

export default function CopilotPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const router = useRouter();

  const { messages, sendMessage, status, error, clearError, setMessages } = useChat({
    api: "/api/chat",
    onError: (err) => {
      console.error("[Copilot] Stream error:", err);
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    clearError?.();
    sendMessage({ text: input });
    setInput("");
  };

  const handleSuggestionClick = (text) => {
    if (isLoading) return;
    clearError?.();
    sendMessage({ text });
  };

  const handleClearChat = () => {
    setMessages([]);
    clearError?.();
  };

  const handleActionClick = useCallback((path) => {
    setIsOpen(false);
    router.push(path);
  }, [router]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, status]);

  const suggestions = [
    { icon: DollarSign, text: "Give me a sales report for this month", color: "#6c5ce7" },
    { icon: Package, text: "Add a new product: Wireless Earbuds, $49.99", color: "#00b894" },
    { icon: TrendingUp, text: "What are my latest sales?", color: "#00d2ff" },
    { icon: AlertTriangle, text: "Show me inventory alerts", color: "#e17055" },
    { icon: Users, text: "Give me customer insights", color: "#a29bfe" },
  ];

  // ─── Render helpers ───

  const renderToolBadges = (toolInvocations) => {
    if (!toolInvocations.length) return null;
    return (
      <div className="copilot-tool-badges">
        {toolInvocations.map((inv, idx) => {
          const toolName = getToolName(inv);
          const toolInfo = TOOL_LABELS[toolName] || { label: `${toolName}...`, icon: "🔧", doneLabel: `${toolName} done` };
          const complete = isToolComplete(inv);
          const hasError = inv.state === "output-error";
          return (
            <span
              key={`${inv.toolCallId || idx}`}
              className={`copilot-tool-badge ${complete ? "complete" : "running"} ${hasError ? "error" : ""}`}
            >
              {complete ? (hasError ? "⚠" : "✓") : <Loader2 size={10} className="spin" />}
              {" "}{toolInfo.icon}{" "}
              {complete ? toolInfo.doneLabel : toolInfo.label}
            </span>
          );
        })}
      </div>
    );
  };

  const renderActionButtons = (toolInvocations) => {
    const actions = toolInvocations
      .map(getToolAction)
      .filter(Boolean)
      .filter((action, index, self) =>
        action.path && self.findIndex(a => a.path === action.path) === index
      );
    if (!actions.length) return null;
    return (
      <div className="copilot-actions">
        {actions.map((action, idx) => (
          <button
            key={idx}
            className="copilot-action-btn"
            onClick={() => handleActionClick(action.path)}
          >
            <ExternalLink size={12} />
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    );
  };

  const renderMessage = (msg) => {
    const text = getMessageText(msg);
    const toolInvs = getToolInvocations(msg);

    // Skip empty user messages
    if (msg.role === "user" && !text) return null;

    return (
      <div key={msg.id} className={`copilot-msg ${msg.role}`}>
        {msg.role === "assistant" && (
          <div className="copilot-msg-avatar">
            <Bot size={13} />
          </div>
        )}
        <div className="copilot-msg-bubble">
          {msg.role === "assistant" && renderToolBadges(toolInvs)}
          {text && <div className="copilot-text-content">{text}</div>}
          {msg.role === "assistant" && renderActionButtons(toolInvs)}
        </div>
      </div>
    );
  };

  return (
    <>
      <button
        className={`copilot-fab ${isOpen ? "active" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Sellora Agent"
        id="copilot-toggle"
      >
        <div className="copilot-fab-inner">
          <Sparkles size={22} />
        </div>
        <div className="copilot-fab-pulse" />
      </button>

      {isOpen && (
        <div className="copilot-panel">
          {/* Header */}
          <div className="copilot-header">
            <div className="copilot-header-info">
              <div className="copilot-avatar">
                <Sparkles size={16} />
              </div>
              <div>
                <span className="copilot-title">Sellora Agent</span>
                <span className="copilot-subtitle">
                  {isLoading ? "Working on it..." : "AI Business Assistant"}
                </span>
              </div>
            </div>
            <div className="copilot-header-actions">
              {messages.length > 0 && (
                <button className="copilot-clear-btn" onClick={handleClearChat} title="Clear chat">
                  <Trash2 size={14} />
                </button>
              )}
              <button className="copilot-close" onClick={() => setIsOpen(false)} id="copilot-close">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="copilot-messages">
            {messages.length === 0 ? (
              <div className="copilot-empty">
                <div className="copilot-empty-glow" />
                <div className="copilot-empty-icon">
                  <Sparkles size={28} />
                </div>
                <h3>Sellora Agent</h3>
                <p>Your AI business assistant. I can manage products, generate sales reports, analyze customers, and more.</p>
                <div className="copilot-suggestions">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(s.text)}
                      className="copilot-suggestion-btn"
                      id={`copilot-suggestion-${i}`}
                    >
                      <div className="copilot-suggestion-icon" style={{ "--suggestion-color": s.color }}>
                        <s.icon size={14} />
                      </div>
                      <span>{s.text}</span>
                      <ChevronRight size={14} className="copilot-suggestion-arrow" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map(renderMessage)
            )}
            {/* Typing indicator — only show when streaming and last message has no text yet */}
            {isLoading && messages.length > 0 && !getMessageText(messages[messages.length - 1]) && !getToolInvocations(messages[messages.length - 1]).length && (
              <div className="copilot-msg assistant">
                <div className="copilot-msg-avatar">
                  <Bot size={13} />
                </div>
                <div className="copilot-msg-bubble copilot-typing">
                  <span className="copilot-typing-dot" />
                  <span className="copilot-typing-dot" />
                  <span className="copilot-typing-dot" />
                </div>
              </div>
            )}
            {error && (
              <div className="copilot-error">
                <span>⚠</span> {error.message || "An error occurred. Please try again."}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form className="copilot-input-area" onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Ask Sellora Agent anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              id="copilot-input"
            />
            <button type="submit" disabled={!input || !input.trim() || isLoading} id="copilot-send">
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
