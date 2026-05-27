"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send, Bot, Loader2, TrendingUp, Package, FileText, Users, DollarSign, ChevronRight, Wrench, Trash2, AlertTriangle } from "lucide-react";
import { useChat } from "@ai-sdk/react";

// Helper: extract text content from a UIMessage's parts array
function getMessageText(msg) {
  if (!msg.parts || !Array.isArray(msg.parts)) return msg.content || "";
  return msg.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("");
}

// Helper: get tool invocations from a message
function getToolInvocations(msg) {
  if (!msg.parts || !Array.isArray(msg.parts)) return [];
  return msg.parts.filter((p) => p.type === "tool-invocation");
}

// Tool name to friendly label mapping
const TOOL_LABELS = {
  get_store_analytics: { label: "Fetching store analytics...", icon: "📊" },
  get_sales_report: { label: "Generating sales report...", icon: "📋" },
  get_latest_sales: { label: "Fetching recent sales...", icon: "💰" },
  get_top_products: { label: "Loading products...", icon: "📦" },
  create_product: { label: "Creating product...", icon: "✨" },
  update_product: { label: "Updating product...", icon: "✏️" },
  draft_product_description: { label: "Drafting description...", icon: "📝" },
  delete_product: { label: "Archiving product...", icon: "🗑️" },
  search_products: { label: "Searching products...", icon: "🔍" },
  get_inventory_alerts: { label: "Checking inventory alerts...", icon: "⚠️" },
  update_order_status: { label: "Updating order status...", icon: "🚚" },
  get_order_details: { label: "Loading order details...", icon: "🧾" },
  get_recent_conversations: { label: "Loading conversations...", icon: "💬" },
  get_customer_insights: { label: "Analyzing customers...", icon: "👥" },
};

export default function CopilotPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  const { messages, sendMessage, status, error, clearError, setMessages } = useChat({
    api: "/api/chat",
    onError: (err) => {
      console.error("Agent Error:", err);
    }
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
              messages.map((msg) => {
                const text = getMessageText(msg);
                const toolInvocations = getToolInvocations(msg);

                return (
                  <div key={msg.id} className={`copilot-msg ${msg.role}`}>
                    {msg.role === "assistant" && (
                      <div className="copilot-msg-avatar">
                        <Bot size={13} />
                      </div>
                    )}
                    <div className="copilot-msg-bubble">
                      {/* Show tool invocations as status badges */}
                      {toolInvocations.length > 0 && (
                        <div className="copilot-tool-badges">
                          {toolInvocations.map((inv, idx) => {
                            const toolInfo = TOOL_LABELS[inv.toolName] || { label: inv.toolName, icon: "🔧" };
                            const isComplete = inv.state === "result" || inv.state === "partial";
                            return (
                              <span key={idx} className={`copilot-tool-badge ${isComplete ? "complete" : "running"}`}>
                                {isComplete ? "✓" : <Loader2 size={10} className="spin" />} {toolInfo.icon} {toolInfo.label}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {/* Show text content */}
                      {text && <div className="copilot-text-content">{text}</div>}
                    </div>
                  </div>
                );
              })
            )}
            {isLoading && messages.length > 0 && !messages[messages.length - 1]?.parts?.some(p => p.type === "tool-invocation") && (
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
