"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, Send, Bot, Loader2, TrendingUp, Package, FileText, Users, DollarSign, ChevronRight, Trash2, AlertTriangle, ExternalLink, Mic, MicOff } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import VoiceRecorder from "./VoiceRecorder";
import MentionInput from "./MentionInput";

// Mention encoding regex — strips @[Display Name](type:uuid) → @Display Name
// for display in the chat UI. The full encoded form is preserved in the
// underlying message text so /api/chat/route.js can parse it for the LLM.
const MENTION_DISPLAY_REGEX = /@\[([^\]]+)\]\((?:team_member|customer):[a-f0-9-]+\)/g;
function stripMentionEncoding(text) {
  if (!text || typeof text !== "string") return text;
  return text.replace(MENTION_DISPLAY_REGEX, "@$1");
}

// Helper: extract text content from a UIMessage
// Handles ALL possible formats: parts array, content string, content array
// Also checks for text within tool-invocation steps (streamText format)
function getMessageText(msg) {
  let raw = "";
  // 1. Try parts first (AI SDK v6 format from streamText)
  if (msg.parts && Array.isArray(msg.parts)) {
    raw = msg.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("");
  }
  // 2. Content as a plain string (older format)
  if (!raw && typeof msg.content === "string" && msg.content.trim()) raw = msg.content;
  // 3. Content as array of content parts
  if (!raw && Array.isArray(msg.content)) {
    raw = msg.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("");
  }
  // Strip mention encoding for display (user sees @Display Name, not the encoded form)
  return stripMentionEncoding(raw);
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
        if (output.product) {
          lines.push(`  Price: ${output.product.price} | Stock: ${output.product.stock} | Category: ${output.product.category}`);
          if (output.product.variants && output.product.variants.length > 0) {
            lines.push(`  **Variants:**`);
            output.product.variants.forEach(v => lines.push(`    - ${v.name}: ${v.price} EGP (${v.stock} in stock)`));
          }
        }
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
      case 'get_order_details':
        // If the tool returned a formatted_response, use it directly
        if (output.formatted_response) {
          lines.push(output.formatted_response);
        } else if (output.success === false) {
          lines.push(`❌ ${output.error || 'Order not found'}`);
        } else if (output.order) {
          // Fallback: format it here if the tool didn't
          const o = output.order;
          const statusEmojis = { pending: "⏳", confirmed: "✅", shipped: "📦", delivered: "✅", cancelled: "❌", returned: "↩️" };
          const payEmojis = { paid: "💵", unpaid: "⏳", refunded: "💰" };
          lines.push(`**Order ${o.order_number}:**`);
          lines.push(`• Customer: ${o.customers?.name || 'Unknown'}${o.customers?.phone ? ` (${o.customers.phone})` : ''}`);
          lines.push(`• Status: ${statusEmojis[o.status] || '📋'} ${o.status || 'Unknown'}`);
          lines.push(`• Payment: ${payEmojis[o.payment_status] || '❓'} ${o.payment_status || 'Unknown'}`);
          lines.push(`• Total: ${Number(o.total || 0).toLocaleString()} ${o.currency || 'EGP'}`);
          if (Array.isArray(o.items) && o.items.length > 0) {
            lines.push(`• **Items:**`);
            o.items.forEach(item => {
              lines.push(`  - ${item.name}${item.variant ? ` (${item.variant})` : ''} × ${item.qty} — ${item.price}`);
            });
          }
          if (o.shipping_address) lines.push(`• Shipping: ${o.shipping_address}`);
          if (o.tracking_number) lines.push(`• Tracking: ${o.tracking_number}${o.carrier ? ` (${o.carrier})` : ''}`);
          if (o.created_at) lines.push(`• Ordered: ${new Date(o.created_at).toLocaleDateString()}`);
        }
        break;
      case 'compare_plans':
        if (output.plans) {
          const currentPlan = output.currentPlan || 'starter';
          lines.push(`**Plan Comparison** (You're on **${currentPlan}**):`);
          lines.push('');
          for (const [key, plan] of Object.entries(output.plans)) {
            const marker = key === currentPlan ? ' ← **Your plan**' : '';
            lines.push(`**${plan.name}** — ${plan.price}${marker}`);
            lines.push(`  Channels: ${plan.channels} | Products: ${plan.products} | AI: ${plan.aiRepliesPerDay}/day (${plan.aiModel})`);
            lines.push(`  Conversations: ${plan.conversationsPerMonth}/mo | Customers: ${plan.customers} | Stores: ${plan.stores}`);
            lines.push(`  Campaigns: ${plan.campaignsPerMonth}/mo | Coupons: ${plan.coupons} | Team: ${plan.teamMembers}`);
            lines.push(`  Analytics: ${plan.analyticsFull ? 'Full' : 'Basic'} | Webhooks: ${plan.webhooks ? 'Yes' : 'No'} | CSV Export: ${plan.csvExport ? 'Yes' : 'No'} | AI Personality: ${plan.customAIPersonality ? 'Yes' : 'No'}`);
            lines.push(`  Data Retention: ${plan.dataRetention} | Copilot: ${plan.copilotMessagesPerDay}/day`);
            lines.push('');
          }
        }
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
  compare_plans: { label: "Comparing plans...", doneLabel: "Plans comparison loaded", icon: "💎" },
  navigate_to: { label: "Opening page...", doneLabel: "Ready to navigate", icon: "🔗" },
};

// Convert raw API errors into user-friendly messages
function getFriendlyError(err) {
  const msg = (err?.message || "").toLowerCase();

  // Groq rate limit
  if (msg.includes("rate limit") && msg.includes("tokens per day")) {
    return "Daily AI usage limit reached. Please try again in a few minutes, or upgrade your Groq plan for more capacity.";
  }
  // Generic rate limit
  if (msg.includes("rate limit") || msg.includes("too many requests") || msg.includes("429")) {
    return "AI is busy right now. Please wait a moment and try again.";
  }
  // API key / auth issues
  if (msg.includes("invalid api key") || msg.includes("unauthorized") || msg.includes("authentication")) {
    return "AI service configuration issue. Please check your API keys in Settings.";
  }
  // Network / timeout
  if (msg.includes("timeout") || msg.includes("network") || msg.includes("fetch failed") || msg.includes("econnrefused")) {
    return "Connection issue. Please check your internet and try again.";
  }
  // All providers failed
  if (msg.includes("all ai providers failed") || msg.includes("all providers")) {
    return "All AI providers are currently unavailable. Please try again in a few minutes.";
  }
  // Model overload
  if (msg.includes("overloaded") || msg.includes("capacity") || msg.includes("server error")) {
    return "AI service is overloaded. Please try again shortly.";
  }

  // Fallback: show a cleaned-up version of the error
  const rawMsg = err?.message || "An error occurred. Please try again.";
  // Trim very long error messages
  if (rawMsg.length > 150) {
    return rawMsg.substring(0, 150) + "... Please try again.";
  }
  return rawMsg;
}

export default function CopilotPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [thinkingText, setThinkingText] = useState(""); // optimistic thinking message
  const messagesEndRef = useRef(null);
  const router = useRouter();

  const [aiStatusDetail, setAiStatusDetail] = useState(null);
  const [showStatusDetail, setShowStatusDetail] = useState(false);

  const { messages, sendMessage, status, error, clearError, setMessages } = useChat({
    api: "/api/chat",
    onError: (err) => {
      console.error("[Copilot] useChat error:", err);
    },
  });

  // Fetch AI status when an error occurs
  const checkAiStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/status");
      const data = await res.json();
      setAiStatusDetail(data);
      setShowStatusDetail(true);
    } catch (e) {
      setAiStatusDetail({ error: "Could not reach status endpoint" });
      setShowStatusDetail(true);
    }
  }, []);

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

  // Rotating "thinking" messages — shown while the AI is processing.
  // Cycles through these every 2.5 seconds to give the user feedback that
  // the AI is actively working on their request.
  const THINKING_ROTATION = [
    "Thinking...",
    "Getting the best answer...",
    "Analyzing your data...",
    "Crafting a response...",
    "Almost there...",
  ];
  const [thinkingRotationIndex, setThinkingRotationIndex] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setThinkingRotationIndex(0);
      return;
    }
    // Rotate the thinking message every 2.5 seconds
    const interval = setInterval(() => {
      setThinkingRotationIndex(idx => (idx + 1) % THINKING_ROTATION.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isLoading]);

  // The full thinking text: either the contextual message OR the rotating
  // message, whichever feels more natural. We show the contextual message
  // first, then rotate to generic "Thinking..." messages after a few seconds.
  const [thinkingStage, setThinkingStage] = useState(0);
  useEffect(() => {
    if (!isLoading) {
      setThinkingStage(0);
      return;
    }
    // After 4 seconds, switch from the specific message to the rotating messages
    const stageTimer = setTimeout(() => setThinkingStage(1), 4000);
    return () => clearTimeout(stageTimer);
  }, [isLoading]);

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
        onClick={() => router.push("/dashboard/copilot")}
        title="Open Sellora Agent"
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
                        {/* Markdown rendering supports bold, italic, tables, lists, headers, code */}
                        {displayText && (
                          <div className="copilot-text-content">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                              // Custom renderers for better styling in the chat bubble
                              p: ({children}) => <p style={{ margin: "0 0 8px 0", lineHeight: 1.6, fontSize: 14 }}>{children}</p>,
                              h1: ({children}) => <h1 style={{ fontSize: 18, fontWeight: 700, margin: "12px 0 8px 0", color: "var(--text-primary)" }}>{children}</h1>,
                              h2: ({children}) => <h2 style={{ fontSize: 16, fontWeight: 700, margin: "10px 0 6px 0", color: "var(--text-primary)" }}>{children}</h2>,
                              h3: ({children}) => <h3 style={{ fontSize: 15, fontWeight: 600, margin: "8px 0 4px 0", color: "var(--text-primary)" }}>{children}</h3>,
                              ul: ({children}) => <ul style={{ margin: "4px 0 8px 0", paddingLeft: 20, lineHeight: 1.6, fontSize: 14 }}>{children}</ul>,
                              ol: ({children}) => <ol style={{ margin: "4px 0 8px 0", paddingLeft: 20, lineHeight: 1.6, fontSize: 14 }}>{children}</ol>,
                              li: ({children}) => <li style={{ marginBottom: 2 }}>{children}</li>,
                              strong: ({children}) => <strong style={{ fontWeight: 700, color: "var(--text-primary)" }}>{children}</strong>,
                              em: ({children}) => <em style={{ fontStyle: "italic" }}>{children}</em>,
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
                              th: ({children}) => <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid var(--border-medium)", color: "var(--text-primary)" }}>{children}</th>,
                              td: ({children}) => <td style={{ padding: "6px 12px", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>{children}</td>,
                              tr: ({children}) => <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>{children}</tr>,
                              hr: () => <hr style={{ border: "none", borderTop: "1px solid var(--border-subtle)", margin: "12px 0" }} />,
                            }}>
                              {displayText}
                            </ReactMarkdown>
                          </div>
                        )}
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
                {/* Shows the contextual message first, then rotates through */}
                {/* "Thinking...", "Getting the best answer...", etc. after 4s */}
                {isLoading && thinkingText && (
                  <div className="copilot-msg assistant">
                    <div className="copilot-msg-avatar">
                      <Bot size={13} />
                    </div>
                    <div className="copilot-msg-bubble">
                      <div className="copilot-thinking-text">
                        <Loader2 size={12} className="spin" style={{ marginRight: 6, verticalAlign: "middle" }} />
                        {thinkingStage === 0
                          ? thinkingText
                          : THINKING_ROTATION[thinkingRotationIndex]
                        }
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
                <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                  <span>⚠</span>
                  <div style={{ flex: 1 }}>
                    <div>{getFriendlyError(error)}</div>
                    <button
                      onClick={checkAiStatus}
                      style={{
                        marginTop: "6px",
                        fontSize: "11px",
                        background: "rgba(255,255,255,0.15)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        color: "inherit",
                        borderRadius: "4px",
                        padding: "2px 8px",
                        cursor: "pointer",
                      }}
                    >
                      🔍 Check AI Status
                    </button>
                  </div>
                </div>
              </div>
            )}
            {showStatusDetail && aiStatusDetail && (
              <div style={{
                background: "rgba(0,0,0,0.3)",
                borderRadius: "8px",
                padding: "10px",
                fontSize: "11px",
                fontFamily: "monospace",
                color: "#ccc",
                maxHeight: "200px",
                overflowY: "auto",
                margin: "4px 0",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <strong style={{ color: "#fff" }}>AI Status Check</strong>
                  <button
                    onClick={() => setShowStatusDetail(false)}
                    style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: "12px" }}
                  >✕</button>
                </div>
                {aiStatusDetail.error ? (
                  <div style={{ color: "#ff6b6b" }}>{aiStatusDetail.error}</div>
                ) : (
                  <>
                    <div style={{ marginBottom: "6px" }}>
                      <strong>Environment:</strong>
                      {Object.entries(aiStatusDetail.env_check || {}).map(([k, v]) => (
                        <div key={k} style={{ color: v === "SET" ? "#6bcb77" : "#ff6b6b" }}>
                          {v === "SET" ? "✓" : "✗"} {k}
                        </div>
                      ))}
                    </div>
                    <div style={{ marginBottom: "6px" }}>
                      <strong>Providers:</strong> {aiStatusDetail.provider_chain?.streaming?.total || 0} streaming, {aiStatusDetail.provider_chain?.full?.total || 0} full
                    </div>
                    {(aiStatusDetail.diagnosis || []).length > 0 && (
                      <div>
                        <strong>Diagnosis:</strong>
                        {(aiStatusDetail.diagnosis || []).map((d, i) => (
                          <div key={i} style={{ color: d.startsWith("CRITICAL") ? "#ff6b6b" : d.startsWith("WARNING") ? "#ffa94d" : "#6bcb77" }}>
                            {d}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
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
            <MentionInput
              value={input}
              onChange={setInput}
              onKeyDown={(e) => {
                // Enter (without Shift) submits the form
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Ask Sellora Agent anything... (type @ to mention a team member or customer)"
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
