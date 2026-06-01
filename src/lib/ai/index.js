import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { groq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { routeMessage } from "./router";
import { createSalesTools, createSupportTools } from "./tools";
import { getSalesAgentPrompt, getSupportAgentPrompt, getOrderTrackerAgentPrompt } from "./agents";

const google = process.env.GOOGLE_GENERATIVE_AI_API_KEY 
  ? createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })
  : null;

// Supabase client for fetching context (lazy-initialized)
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabase;
}

/**
 * Build the provider fallback chain from available API keys.
 */
function buildProviderChain() {
  const providers = [];

  if (process.env.VECTORENGINE_API_KEY) {
    const customOpenAI = createOpenAI({
      apiKey: process.env.VECTORENGINE_API_KEY,
      baseURL: process.env.VECTORENGINE_BASE_URL || "https://api.vectorengine.ai/v1",
      compatibility: "compatible",
    });
    providers.push({ name: 'vectorengine', model: customOpenAI("gpt-5.5-pro") });
  }

  if (process.env.GROQ_API_KEY) {
    providers.push({ name: 'groq', model: groq("llama-3.3-70b-versatile") });
  }

  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY && google) {
    providers.push({ name: 'google', model: google("gemini-2.0-flash") });
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const { openai } = require("@ai-sdk/openai");
      providers.push({ name: 'openai', model: openai("gpt-4o-mini") });
    } catch (e) {}
  }

  return providers;
}

/**
 * Generate an AI reply based on customer message and business context.
 * Uses a robust fallback strategy: try with tools first, then without tools.
 * Product/order data is embedded in the system prompt so the AI can answer
 * even when tool calls fail.
 */
export async function generateAIReply({
  accountId,
  customerId,
  customerMessage,
  customerName,
  personality,
  country = "Egypt",
  businessName = "My Store",
  conversationHistory = [],
  plan = "starter",
}) {
  try {
    // 1. Route the message (now returns { intent, sentiment })
    const routingResult = plan === "starter" ? { intent: "sales", sentiment: "neutral" } : await routeMessage(customerMessage, conversationHistory);
    const intent = typeof routingResult === "string" ? routingResult : routingResult.intent;
    const sentiment = typeof routingResult === "string" ? "neutral" : (routingResult.sentiment || "neutral");

    // 2. Setup Agent Prompt
    let systemPrompt = "";
    let tools = {};

    switch(intent) {
      case "support":
        systemPrompt = getSupportAgentPrompt(businessName, personality);
        tools = createSupportTools(accountId, customerId);
        break;
      case "order_tracking":
        systemPrompt = getOrderTrackerAgentPrompt(businessName, personality);
        tools = createSupportTools(accountId, customerId);
        break;
      case "sales":
      default:
        systemPrompt = getSalesAgentPrompt(businessName, country, personality);
        tools = createSalesTools(accountId, customerId);
        break;
    }

    // 3. Fetch and embed product catalog directly in the system prompt
    // This ensures the AI can answer product questions even if tool calls fail
    let productContext = "";
    try {
      const { data: accountData } = await getSupabase()
        .from("accounts")
        .select("currency")
        .eq("id", accountId)
        .single();
      
      const currency = accountData?.currency || "EGP";

      const { data: products } = await getSupabase()
        .from("products")
        .select("name, price, description, category, stock")
        .eq("account_id", accountId)
        .eq("status", "active")
        .limit(30);

      if (products && products.length > 0) {
        productContext = `\n\nYOUR CURRENT PRODUCT CATALOG:\n${products.map(p => 
          `• ${p.name} — ${p.price} ${currency} (Stock: ${p.stock}, Category: ${p.category || 'General'})${p.description ? `\n  Description: ${p.description.slice(0, 150)}` : ''}`
        ).join('\n')}\n\nIMPORTANT: When customers ask what you sell or about products, reference this catalog directly. Do NOT say you need to check — you already have this information.`;
      } else {
        productContext = "\n\nNOTE: Your store currently has no products added yet. If the customer asks about products, let them know the store is still being set up.";
      }
    } catch (e) {
      console.warn("[generateAIReply] Failed to fetch products for context:", e.message);
    }

    // 3.5. Fetch and embed business policies in the system prompt
    // This ensures the AI always knows the store's policies even if tool calls fail
    let policyContext = "";
    try {
      const { data: policies } = await getSupabase()
        .from("business_policies")
        .select("title, content, category")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (policies && policies.length > 0) {
        policyContext = `\n\nYOUR STORE POLICIES (YOU MUST FOLLOW THESE):\n${policies.map(p =>
          `\u2022 [${p.category}] ${p.title}: ${p.content}`
        ).join('\n')}\n\nIMPORTANT: When customers ask about returns, shipping, exchanges, refunds, payment methods, cancellations, warranties, or any policy-related question, you MUST answer based on the policies above. Do NOT make up your own policies. If a customer asks about something not covered in the policies, say you'll check with the store owner and get back to them.`;
      } else {
        policyContext = "\n\nNOTE: Your store has no policies configured yet. If the customer asks about returns, shipping, or policies, let them know you'll check with the store owner and get back to them. Do NOT make up policies.";
      }
    } catch (e) {
      console.warn("[generateAIReply] Failed to fetch policies for context:", e.message);
    }

    // 4. Format History
    const formattedMessages = conversationHistory.slice(-6).map((msg) => ({
      role: msg.direction === "incoming" ? "user" : "assistant",
      content: msg.content,
    }));
    
    formattedMessages.push({ role: "user", content: customerMessage });

    const fullSystemPrompt = systemPrompt + productContext + policyContext;

    // 5. Try providers with robust fallback
    const providerChain = buildProviderChain();
    let text = "";
    let toolCalls = null;
    let lastError = null;

    if (providerChain.length === 0) {
      throw new Error("No AI providers configured. Set GROQ_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY.");
    }

    for (const provider of providerChain) {
      // Attempt 1: With tools (for advanced interactions like order creation)
      try {
        const result = await generateText({
          model: provider.model,
          system: fullSystemPrompt,
          messages: formattedMessages,
          tools: tools,
          maxSteps: plan === "starter" ? 2 : 4,
        });
        text = result.text;
        toolCalls = result.toolCalls;
        if (text && text.trim()) break;
        console.warn(`[generateAIReply] ${provider.name} with tools returned empty text`);
      } catch (providerError) {
        lastError = providerError;
        console.warn(`[generateAIReply] ${provider.name} with tools failed: ${providerError.message}`);
      }

      // Attempt 2: Without tools — guaranteed text response
      try {
        const result = await generateText({
          model: provider.model,
          system: fullSystemPrompt,
          messages: formattedMessages,
          maxSteps: 1,
        });
        text = result.text;
        if (text && text.trim()) break;
      } catch (providerError) {
        lastError = providerError;
        console.warn(`[generateAIReply] ${provider.name} without tools failed: ${providerError.message}`);
      }
    }

    // 5.5. Check for escalation tag in AI reply
    let needsHumanAttention = false;
    let escalationReason = null;
    if (text) {
      const escalateMatch = text.match(/\[ESCALATE:\s*(.+?)\]/i);
      if (escalateMatch) {
        needsHumanAttention = true;
        escalationReason = escalateMatch[1].trim();
        // Remove the escalation tag from the customer-facing reply
        text = text.replace(/\[ESCALATE:\s*.+?\]/gi, '').trim();
        console.log(`[generateAIReply] AI escalated: ${escalationReason}`);
      }
    }

    return { reply: text || null, intent, sentiment, toolCalls, needsHumanAttention, escalationReason };
  } catch (err) {
    console.error("Error generating AI reply:", err);
    return { reply: null, intent: "general", sentiment: "neutral", toolCalls: null, needsHumanAttention: false, escalationReason: null };
  }
}

/**
 * Analyze customer intent from their message using fast routing
 */
export async function analyzeIntent(message) {
  try {
     const result = await routeMessage(message);
     const intent = typeof result === "string" ? result : result.intent;
     const sentiment = typeof result === "string" ? "neutral" : (result.sentiment || "neutral");
     return { intent, sentiment };
  } catch {
    return { intent: "general", sentiment: "neutral" };
  }
}
