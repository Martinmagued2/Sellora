"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, Send, Bot, Loader2, TrendingUp, Package, FileText, Users, DollarSign, ChevronRight, Trash2, AlertTriangle, ExternalLink, Mic, MicOff } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import VoiceRecorder from "./VoiceRecorder";

// Helper: extract text content from a UIMessage
// Handles ALL possible formats: parts array, content string, content array
// Also checks for text within tool-invocation steps (streamText format)
function getMessageText(msg) {
  // 1. Try parts first (AI SDK v6 format from streamText)
  if (msg.parts && Array.isArray(msg.parts)) {
    const textFromParts = msg.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("");
    if (textFromParts) return textFromParts;
  }
  // 2. Content as a plain string (older format)
  if (typeof msg.content === "string" && msg.content.trim()) return msg.content;
  // 3. Content as array of content parts
  if (Array.isArray(msg.content)) {
    const textParts = msg.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("");
    if (textParts) return textParts;
  }
  return "";
}

// Helper: generate fallback text from tool outputs when no text part exists
// This ensures users always see useful output even if the stream format is wrong
function getFallbackTextFromTools(toolInvs) {
  const lines = [];
  for (const inv of toolInvs) {
    const output = inv.output || inv.result;
    if (!output) continue;

    const toolName = inv.type?.startsWith('tool-') ? inv.type.slice(5) : inv.toolName;

    if (output.success === false) {
      lines.push(`❌ ${toolName}: ${output.error || 'Operation failed'}`);
      continue;
    }

    switch (toolName) {
      case 'get_customer_insights':
        lines.push(`**Customer Insights:**`);
        lines.push(`• Total Customers: ${output.totalCustomers || 0}`);
        lines.push(`• Returning Customers: ${output.returningCustomers || 0}`);
        lines.push(`• Average Spend: ${output.avgSpend || 0}`);
        if (output.topSpenders?.length > 0) {
          lines.push(`• **Top Spenders:**`);
          output.topSpenders.forEach(s => lines.push(`  - ${s.name}: ${s.total_spent} (${s.total_orders} orders)`));
        }
        if (output.channelDistribution) {
          lines.push(`• **Channels:** ${Object.entries(output.channelDistribution).map(([k,v]) => `${k}: ${v}`).join(', ')}`);
        }
        break;
      case 'get_sales_report':
        lines.push(`**Sales Report (${output.period || 'N/A'}):**`);
        if (output.revenue) lines.push(`• Total Revenue: ${output.revenue.total} | Completed: ${output.revenue.completed} | Pending: ${output.revenue.pending}`);
        if (output.orders) lines.push(`• Orders: ${output.orders.total} total | ${output.orders.completed} completed | ${output.orders.pending} pending | ${output.orders.cancelled} cancelled`);
        if (output.orders?.avgValue) lines.push(`• Average Order Value: ${output.orders.avgValue}`);
        if (output.topProducts?.length > 0) {
          lines.push(`• **Top Products:**`);
          output.topProducts.forEach(p => lines.push(`  - ${p.name}: ${p.revenue} revenue (${p.qty} sold)`));
        }
        if (output.inventory) lines.push(`• Inventory: ${output.inventory.activeProducts} active, ${output.inventory.outOfStock} out of stock, ${output.inventory.lowStock} low stock`);
        break;
      case 'get_store_analytics':
        lines.push(`**Store Analytics (${output.days || 30} days):**`);
        lines.push(`• Revenue: ${output.totalRevenue} | Orders: ${output.orderCount} | Avg: ${output.avgOrderValue}`);
        lines.push(`• Pending: ${output.pendingCount} | Delivered: ${output.deliveredCount} | Cancelled: ${output.cancelledCount}`);
        break;
      case 'create_product':
        lines.push(`✅ **Product Created:** ${output.product?.name || output.message || 'Success'}`);
        if (output.product) lines.push(`  Price: ${output.product.price} | Stock: ${output.product.stock} | Category: ${output.product.category}`);
        break;
      case 'generate_product_image':
        if (output.success) {
          lines.push(`🎨 **Image Generated:** ${output.message || 'Success'}`);
        } else {
          lines.push(`❌ Image generation failed: ${output.error}`);
        }
        break;
      case 'get_latest_sales':
        lines.push(`**Recent Sales:** ${output.sales?.length || 0} orders found`);
        if (output.sales?.slice(0, 3).forEach(s => lines.push(`  - Order #${s.order_number || s.id}: ${s.total} (${s.status})`)));
        break;
      case 'get_inventory_alerts':
        if (output.outOfStock?.length > 0) {
          lines.push(`🔴 **Out of Stock:** ${output.outOfStock.map(p => p.name).join(', ')}`);
        }
        if (output.lowStock?.length > 0) {
          lines.push(`🟡 **Low Stock:** ${output.lowStock.map(p => `${p.name} (${p.stock} left)`).join(', ')}`);
        }
        lines.push(`✅ Healthy: ${output.healthyCount} products`);
        break;
      case 'find_conversation':
        if (output.conversations?.length > 0) {
          lines.push(`**Found ${output.conversations.length} conversation(s):**`);
          output.conversations.forEach(c => lines.push(`  - ${c.customer_name} (${c.channel}) — ID: ${c.id}`));
        } else {
          lines.push(`No conversations found matching your search.`);
        }
        break;
      case 'send_message_to_customer':
        if (output.success) {
          lines.push(`✅ **Message delivered!** ${output.message || 'Sent successfully'}`);
          if (output.channel) lines.push(`  Channel: ${output.channel}`);
        } else {
          lines.push(`❌ **Message not delivered:** ${output.error || 'Unknown error'}`);
        }
        break;
      case 'send_follow_up':
        if (output.sent > 0) {
          lines.push(`✅ **Follow-up sent** to ${output.sent} customer(s)`);
        } else {
          lines.push(output.message || 'No unpaid orders to follow up on');
        }
        break;
      default:
        if (output.message) lines.push(output.message);
        break;
    }
  }
  return lines.join('\n');
}

// Helper: get tool invocations from a message
// Checks both parts array (AI SDK v6) and toolInvocations array (older format)
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

// Check if a tool invocation is complete (has output)
function isToolComplete(inv) {
  // AI SDK v6 states: input-streaming, input-available, output-available, output-error, output-denied
  if (inv.state === "output-available" || inv.state === "output-error" || inv.state === "result") {
    return true;
  }
  // Fallback: check if output exists
  const output = inv.output || inv.result;
  return output !== undefined && output !== null;
}

// Extract _action from tool invocation results
function getToolAction(inv) {
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
  generate_product_image: { label: "Generating product image...", doneLabel: "Product image generated", icon: "🎨" },
  update_product: { label: "Updating product...", doneLabel: "Product updated", icon: "✏️" },
  draft_product_description: { label: "Drafting description...", doneLabel: "Description drafted", icon: "📝" },
  delete_product: { label: "Archiving product...", doneLabel: "Product archived", icon: "🗑️" },
  search_products: { label: "Searching products...", doneLabel: "Search complete", icon: "🔍" },
  get_inventory_alerts: { label: "Checking inventory alerts...", doneLabel: "Inventory alerts loaded", icon: "⚠️" },
  update_order_status: { label: "Updating order status...", doneLabel: "Order updated", icon: "🚚" },
  get_order_details: { label: "Loading order details...", doneLabel: "Order details loaded", icon: "🧾" },
  get_recent_conversations: { label: "Loading conversations...", doneLabel: "Conversations loaded", icon: "💬" },
  get_customer_insights: { label: "Analyzing customers...", doneLabel: "Customer insights ready", icon: "👥" },
  find_conversation: { label: "Finding conversation...", doneLabel: "Conversation found", icon: "🔍" },
  send_message_to_customer: { label: "Sending message to customer...", doneLabel: "Message sent to customer", icon: "💬" },
  send_follow_up: { label: "Sending follow-up messages...", doneLabel: "Follow-ups sent", icon: "📧" },
  recommend_products: { label: "Finding recommendations...", doneLabel: "Recommendations ready", icon: "💡" },
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
      console.error("[Copilot] useChat error:", err);
    },
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
    if (lower.includes("image") || lower.includes("photo") || lower.includes("picture"))
      return "Let me generate a product image for you...";
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
    { icon: Package, text: "Add a new product with image: Wireless Earbuds, $49.99", color: "#00b894" },
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

                  // Collect generated images from tool outputs
                  const generatedImages = toolInvs
                    .map((inv) => {
                      const output = inv.output || inv.result;
                      if (output && output.image_url) return output.image_url;
                      return null;
                    })
                    .filter(Boolean);

                  // Skip empty user messages
                  if (msg.role === "user" && !text) return null;

                  // Fallback: if no text from stream but tools completed, generate text from tool output
                  const displayText = text || (toolInvs.some(isToolComplete) ? getFallbackTextFromTools(toolInvs) : "");

                  // Skip completely empty assistant messages (no text, no tools, no fallback)
                  if (msg.role === "assistant" && !displayText && toolInvs.length === 0) return null;

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
                              const complete = isToolComplete(inv);
                              return (
                                <span key={idx} className={`copilot-tool-badge ${complete ? "complete" : "running"}`}>
                                  {complete ? "✓" : <Loader2 size={10} className="spin" />} {toolInfo.icon} {complete ? toolInfo.doneLabel : toolInfo.label}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {/* Show text content (from stream or fallback from tool output) */}
                        {displayText && <div className="copilot-text-content">{displayText}</div>}
                        {/* Show generated product images */}
                        {generatedImages.length > 0 && (
                          <div className="copilot-images">
                            {generatedImages.map((imgUrl, idx) => (
                              <div key={idx} className="copilot-generated-image">
                                <img src={imgUrl} alt="Generated product image" />
                              </div>
                            ))}
                          </div>
                        )}
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
            <VoiceRecorder
              compact
              onTranscribe={(text) => {
                setInput(text);
                // Auto-focus the input after transcription
                document.getElementById("copilot-input")?.focus();
              }}
              disabled={isLoading}
            />
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
