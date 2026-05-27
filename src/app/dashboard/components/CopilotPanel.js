"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, Send, Bot, Loader2, TrendingUp, Package, FileText, Users, DollarSign, ChevronRight, Trash2, AlertTriangle, ExternalLink } from "lucide-react";
import { useChat } from "@ai-sdk/react";

// Helper: extract text content from a UIMessage
// Handles ALL possible formats: parts array, content string, content array
function getMessageText(msg) {
  // 1. Try parts first (AI SDK v6 format from createUIMessageStream)
  if (msg.parts && Array.isArray(msg.parts)) {
    const textFromParts = msg.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("");
    if (textFromParts) return textFromParts;
  }
  // 2. Content as a plain string
  if (typeof msg.content === "string" && msg.content.trim()) return msg.content;
  // 3. Content as array of content parts
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("");
  }
  return "";
}

// Helper: get tool invocations from a message
// Checks both parts array and toolInvocations array (older format)
function getToolInvocations(msg) {
  // AI SDK v6: parts with type starting with 'tool-'
  if (msg.parts && Array.isArray(msg.parts)) {
    const toolParts = msg.parts.filter((p) => p.type.startsWith("tool-") || p.type === "dynamic-tool");
    if (toolParts.length > 0) return toolParts;
  }
  // Older format: toolInvocations array
  if (msg.toolInvocations && Array.isArray(msg.toolInvocations)) {
    return msg.toolInvocations.map((inv) => ({
      type: `tool-${inv.toolName}`,
      toolCallId: inv.toolCallId,
      toolName: inv.toolName,
      state: inv.state,
      input: inv.args,
      output: inv.result,
    }));
  }
  return [];
}

// Extract _action from tool invocation results
function getToolAction(inv) {
  // Check output field (AI SDK v6)
  const output = inv.output || inv.result;
  if (output && output._action) {
    return output._action;
  }
  return null;
}

// Tool name to friendly label mapping
const TOOL_LABELS = {
  get_store_analytics: { label: "Fetching store analytics...", doneLabel: "Store analytics loaded", icon: "📊" },
  get_sales_report: { label: "Generating sales report...", doneLabel: "Sales report generated", icon: "📋" },
  get_latest_sales: { label: "Fetching recent sales...", doneLabel: "Recent sales loaded", icon: "💰" },
  get_top_products: { label: "Loading products...", doneLabel: "Products loaded", icon: "📦" },
  create_product: { label: "Creating product...", doneLabel: "Product created", icon: "✨" },
  update_product: { label: "Updating product...", doneLabel: "Product updated", icon: "✏️" },
  draft_product_description: { label: "Drafting description...", doneLabel: "Description drafted", icon: "📝" },
  delete_product: { label: "Archiving product...", doneLabel: "Product archived", icon: "🗑️" },
  search_products: { label: "Searching products...", doneLabel: "Search complete", icon: "🔍" },
  get_inventory_alerts: { label: "Checking inventory alerts...", doneLabel: "Inventory alerts loaded", icon: "⚠️" },
  update_order_status: { label: "Updating order status...", doneLabel: "Order updated", icon: "🚚" },
  get_order_details: { label: "Loading order details...", doneLabel: "Order details loaded", icon: "🧾" },
  get_recent_conversations: { label: "Loading conversations...", doneLabel: "Conversations loaded", icon: "💬" },
  get_customer_insights: { label: "Analyzing customers...", doneLabel: "Customer insights ready", icon: "👥" },
};

export default function CopilotPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [thinkingText, setThinkingText] = useState(""); // optimistic thinking message
  const messagesEndRef = useRef(null);
  const router = useRouter();

  const { messages, sendMessage, status, error, clearError, setMessages } = useChat({
    api: "/api/chat",
    onError: (err) => {
      console.error("Agent Error:", err);
    }
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Generate a thinking message based on what the user asked
  const getThinkingMessage = (text) => {
    const lower = text.toLowerCase();
    if (lower.includes("sales report") || lower.includes("revenue") || lower.includes("income"))
      return "Let me pull up your sales data and generate a report...";
    if (lower.includes("customer") || lower.includes("insight"))
      return "Let me analyze your customer data...";
    if (lower.includes("product") && (lower.includes("add") || lower.includes("create")))
      return "Let me create that product for you...";
    if (lower.includes("inventory") || lower.includes("stock"))
      return "Let me check your inventory for alerts...";
    if (lower.includes("order") || lower.includes("latest sale"))
      return "Let me fetch your recent orders...";
    if (lower.includes("conversation") || lower.includes("message"))
      return "Let me load your conversations...";
    return "Let me look into that for you...";
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    clearError?.();
    setThinkingText(getThinkingMessage(input));
    sendMessage({ text: input });
    setInput("");
  };

  const handleSuggestionClick = (text) => {
    if (isLoading) return;
    clearError?.();
    setThinkingText(getThinkingMessage(text));
    sendMessage({ text });
  };

  const handleClearChat = () => {
    setMessages([]);
    setThinkingText("");
    clearError?.();
  };

  const handleActionClick = useCallback((path) => {
    setIsOpen(false);
    router.push(path);
  }, [router]);

  // Clear thinking text once response arrives
  useEffect(() => {
    if (!isLoading && thinkingText) {
      setThinkingText("");
    }
  }, [isLoading]);

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
            {messages.length === 0 && !thinkingText ? (
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
              <>
                {messages.map((msg) => {
                  const text = getMessageText(msg);
                  const toolInvs = getToolInvocations(msg);

                  // Collect action buttons from completed tool invocations
                  const actionButtons = toolInvs
                    .map((inv) => getToolAction(inv))
                    .filter(Boolean)
                    .filter((action, index, self) =>
                      action.path && self.findIndex(a => a.path === action.path) === index
                    );

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
                        {/* Show tool badges */}
                        {toolInvs.length > 0 && (
                          <div className="copilot-tool-badges">
                            {toolInvs.map((inv, idx) => {
                              const toolName = inv.type.startsWith('tool-') ? inv.type.slice(5) : inv.toolName;
                              const toolInfo = TOOL_LABELS[toolName] || { label: `${toolName}...`, doneLabel: `${toolName} done`, icon: "🔧" };
                              const output = inv.output || inv.result;
                              const isComplete = output !== undefined || inv.state === "result";
                              return (
                                <span key={idx} className={`copilot-tool-badge ${isComplete ? "complete" : "running"}`}>
                                  {isComplete ? "✓" : <Loader2 size={10} className="spin" />} {toolInfo.icon} {isComplete ? toolInfo.doneLabel : toolInfo.label}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {/* Show text content */}
                        {text && <div className="copilot-text-content">{text}</div>}
                        {/* Show action buttons */}
                        {actionButtons.length > 0 && (
                          <div className="copilot-actions">
                            {actionButtons.map((action, idx) => (
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
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Optimistic thinking message — appears instantly while server processes */}
                {isLoading && thinkingText && (
                  <div className="copilot-msg assistant">
                    <div className="copilot-msg-avatar">
                      <Bot size={13} />
                    </div>
                    <div className="copilot-msg-bubble">
                      <div className="copilot-thinking-text">
                        <Loader2 size={12} className="spin" style={{ marginRight: 6, verticalAlign: "middle" }} />
                        {thinkingText}
                      </div>
                    </div>
                  </div>
                )}

                {/* Typing dots when loading but no thinking text */}
                {isLoading && !thinkingText && (
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
              </>
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
