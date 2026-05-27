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

// Init Supabase with Service Role to bypass RLS for internal API calls
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Build the provider fallback chain from available API keys.
 * Order: Groq (primary) → Google Gemini → OpenAI
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

  // Groq as primary (fast and reliable)
  if (process.env.GROQ_API_KEY) {
    providers.push({ name: 'groq', model: groq("llama-3.3-70b-versatile") });
  }

  // Google Gemini as fallback
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY && google) {
    providers.push({ name: 'google', model: google("gemini-2.0-flash") });
  }

  // OpenAI as last resort
  if (process.env.OPENAI_API_KEY) {
    try {
      const { openai } = require("@ai-sdk/openai");
      providers.push({ name: 'openai', model: openai("gpt-4o-mini") });
    } catch (e) {}
  }

  return providers;
}

/**
 * Handles a simulated chat with plan-aware model selection and agent routing.
 * 
 * Strategy: Embed product catalog directly in the system prompt so the AI
 * can answer product questions WITHOUT relying on tool calls. Tools are still
 * available but not required for basic responses. This makes the simulator
 * much more reliable since tool-call failures won't result in empty replies.
 */
export async function simulateChat(accountId, messages) {
  if (!process.env.GROQ_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.OPENAI_API_KEY) {
    return "AI is not configured yet. Please add your API keys in settings.";
  }

  try {
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("business_name, ai_personality, country, plan, currency")
      .eq("id", accountId)
      .single();

    if (accountError || !account) {
      throw new Error("Account not found");
    }

    const plan = account?.plan || "starter";
    const currency = account?.currency || "EGP";

    const formattedMessages = messages
      .filter((msg) => msg.content && msg.content.trim())
      .map((msg) => ({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      }));

    if (formattedMessages.length === 0) {
      return "I didn't catch that. Could you please send your message again?";
    }

    const latestMessage = formattedMessages[formattedMessages.length - 1].content;
    
    // Default to sales for simulator
    const intent = plan === "starter" ? "sales" : await routeMessage(latestMessage, formattedMessages);

    let systemPrompt = "";
    switch(intent) {
      case "support":
        systemPrompt = getSupportAgentPrompt(account.business_name, account.ai_personality);
        break;
      case "order_tracking":
        systemPrompt = getOrderTrackerAgentPrompt(account.business_name, account.ai_personality);
        break;
      case "sales":
      default:
        systemPrompt = getSalesAgentPrompt(account.business_name, account.country, account.ai_personality);
        break;
    }

    // Fetch product catalog and embed it directly in the system prompt
    // This is the KEY fix: the AI can answer product questions from context
    // without needing tool calls to work
    let productContext = "";
    try {
      const { data: products } = await supabase
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
        productContext = "\n\nNOTE: Your store currently has no products added yet. If the customer asks about products, let them know the store is still being set up and new products will be available soon. Be friendly and encouraging.";
      }
    } catch (e) {
      console.warn("[simulateChat] Failed to fetch products for context:", e.message);
      productContext = "\n\nNOTE: Could not load product catalog right now. Answer based on general knowledge.";
    }

    // Also fetch recent orders for context (for support/order_tracking intents)
    let orderContext = "";
    if (intent === "support" || intent === "order_tracking") {
      try {
        const { data: orders } = await supabase
          .from("orders")
          .select("order_number, total, status, created_at")
          .eq("account_id", accountId)
          .order("created_at", { ascending: false })
          .limit(5);

        if (orders && orders.length > 0) {
          orderContext = `\n\nRECENT ORDERS:\n${orders.map(o => 
            `• Order #${o.order_number} — ${o.total} ${currency} — Status: ${o.status} — Date: ${new Date(o.created_at).toLocaleDateString()}`
          ).join('\n')}`;
        } else {
          orderContext = "\n\nNOTE: No orders found in the system yet.";
        }
      } catch (e) {
        console.warn("[simulateChat] Failed to fetch orders for context:", e.message);
      }
    }

    const fullSystemPrompt = systemPrompt + productContext + orderContext;

    const providerChain = buildProviderChain();

    if (providerChain.length === 0) {
      throw new Error("No AI providers available. Set GROQ_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY.");
    }

    let text = "";
    let lastError = null;

    for (const provider of providerChain) {
      // Attempt 1: With tools (for advanced interactions like order creation)
      try {
        console.log(`[simulateChat] Trying ${provider.name} with tools...`);
        const dummyCustomerId = "00000000-0000-0000-0000-000000000000";
        let tools = {};
        if (intent === "support" || intent === "order_tracking") {
          tools = createSupportTools(accountId, dummyCustomerId);
        } else {
          tools = createSalesTools(accountId, dummyCustomerId);
        }

        const result = await generateText({
          model: provider.model,
          system: fullSystemPrompt,
          messages: formattedMessages,
          tools: tools,
          maxSteps: plan === "starter" ? 2 : 4,
        });
        text = result.text;
        if (text && text.trim()) {
          console.log(`[simulateChat] ${provider.name} with tools succeeded`);
          break;
        }
        console.warn(`[simulateChat] ${provider.name} with tools returned empty text, will retry without tools`);
      } catch (providerError) {
        lastError = providerError;
        console.warn(`[simulateChat] ${provider.name} with tools failed: ${providerError.message}`);
      }

      // Attempt 2: WITHOUT tools — guaranteed text response since all
      // product/order data is already in the system prompt
      try {
        console.log(`[simulateChat] Retrying ${provider.name} WITHOUT tools...`);
        const result = await generateText({
          model: provider.model,
          system: fullSystemPrompt,
          messages: formattedMessages,
          maxSteps: 1,
        });
        text = result.text;
        if (text && text.trim()) {
          console.log(`[simulateChat] ${provider.name} without tools succeeded`);
          break;
        }
        console.warn(`[simulateChat] ${provider.name} without tools also returned empty text`);
      } catch (providerError) {
        lastError = providerError;
        console.warn(`[simulateChat] ${provider.name} without tools failed: ${providerError.message}`);
      }
    }

    if (!text || !text.trim()) {
      console.error("[simulateChat] All providers failed. Last error:", lastError?.message);
      return "I'm having trouble connecting right now. Please try again in a moment.";
    }

    return text;
  } catch (error) {
    console.error("AI simulateChat error:", error.message);
    if (error.message?.includes("Account not found")) return "Your account is still being set up. Please try again in a moment.";
    if (error.message?.includes("SAFETY")) return "I can't process that message. Please try asking something else.";
    if (error.message?.includes("quota") || error.message?.includes("429")) return "We're experiencing high demand right now. Please try again in a few minutes.";
    return "I'm having trouble connecting right now. A team member will follow up with you shortly.";
  }
}
