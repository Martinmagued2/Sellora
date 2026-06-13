import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { routeMessage } from "./router";
import { createSalesTools, createSupportTools } from "./tools";
import { getSalesAgentPrompt, getSupportAgentPrompt, getOrderTrackerAgentPrompt } from "./agents";
import { buildFullProviderChain, recordKeyFailure, recordKeySuccess } from "./provider-chain";



// Init Supabase with Service Role to bypass RLS for internal API calls (lazy-initialized)
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
 * Delegates to the unified provider-chain module which handles
 * multi-key support, health tracking, and smart failover for ALL providers.
 */
function buildProviderChain() {
  return buildFullProviderChain();
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
  if (!process.env.GROQ_API_KEY && !process.env.GROQ_API_KEYS && !process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.GOOGLE_API_KEYS && !process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEYS && !process.env.NVIDIA_API_KEY && !process.env.NVIDIA_API_KEYS && !process.env.VECTORENGINE_API_KEY) {
    return "AI is not configured yet. Please add your API keys in settings.";
  }

  try {
    const { data: account, error: accountError } = await getSupabase()
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
      const { data: products } = await getSupabase()
        .from("products")
        .select("name, price, description, category, stock, variants")
        .eq("account_id", accountId)
        .eq("status", "active")
        .limit(30);

      if (products && products.length > 0) {
        productContext = `\n\nYOUR CURRENT PRODUCT CATALOG:\n${products.map(p => {
          let line = `• ${p.name} — ${p.price} ${currency} (Stock: ${p.stock}, Category: ${p.category || 'General'})`;
          if (p.description) line += `\n  Description: ${p.description.slice(0, 150)}`;
          if (p.variants && p.variants.length > 0) {
            line += `\n  Variants: ${p.variants.map(v => `${v.name} (${v.price} ${currency}, ${v.stock} in stock)`).join(' | ')}`;
          }
          return line;
        }).join('\n')}\n\nIMPORTANT: When customers ask what you sell or about products, reference this catalog directly. Do NOT say you need to check — you already have this information. If a product has variants (sizes, colors, etc.), ALWAYS mention the available options to the customer.`;
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
        const { data: orders } = await getSupabase()
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
      // ─── Smart Failover: Track success/failure per key ───
      
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
          if (provider._provider !== undefined) recordKeySuccess(provider._provider, provider._keyIndex);
          break;
        }
        console.warn(`[simulateChat] ${provider.name} with tools returned empty text, will retry without tools`);
      } catch (providerError) {
        lastError = providerError;
        console.warn(`[simulateChat] ${provider.name} with tools failed: ${providerError.message}`);
        if (provider._provider !== undefined) recordKeyFailure(provider._provider, provider._keyIndex, providerError);
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
          if (provider._provider !== undefined) recordKeySuccess(provider._provider, provider._keyIndex);
          break;
        }
        console.warn(`[simulateChat] ${provider.name} without tools also returned empty text`);
      } catch (providerError) {
        lastError = providerError;
        console.warn(`[simulateChat] ${provider.name} without tools failed: ${providerError.message}`);
        if (provider._provider !== undefined) recordKeyFailure(provider._provider, provider._keyIndex, providerError);
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
