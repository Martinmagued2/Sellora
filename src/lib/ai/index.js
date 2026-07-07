import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { routeMessage } from "./router";
import { createSalesTools, createSupportTools } from "./tools";
import { createCartTools, createCustomerMemoryTools } from "./cart-tools";
import { getSalesAgentPrompt, getSupportAgentPrompt, getOrderTrackerAgentPrompt, buildPersonalityFromSettings } from "./agents";
import { getZAIConfig } from "./z-ai-config";
import { buildFullProviderChain, recordKeyFailure, recordKeySuccess, getProviderChainSummary } from "./provider-chain";
import { getPlanLimits } from "@/lib/plan-limits";

// Google instance for vision analysis (kept here since buildFullProviderChain handles chat providers)
import { createGoogleGenerativeAI } from "@ai-sdk/google";
const google = process.env.GOOGLE_GENERATIVE_AI_API_KEY 
  ? createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })
  : null;

// ─── Vision AI: Analyze images sent by customers ───
// Uses vision-capable models to understand image content and generate
// contextual AI replies. Fallback chain: Google Gemini → NVIDIA NIM Vision

/**
 * Analyze an image URL and return a text description of what's in it.
 * This is used when customers send photos (products, issues, etc.)
 * so the AI can respond contextually instead of ignoring the image.
 * 
 * @param {string} imageUrl - URL of the image to analyze
 * @param {string} context - Optional context (e.g., "customer asking about this product")
 * @returns {string} - Description of the image content
 */
export async function analyzeImage(imageUrl, context = "") {
  try {
    // ─── Attempt 1: Google Gemini Vision ───
    // Gemini has native multimodal support and is fast
    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY && google) {
      try {
        console.log(`[Vision] Analyzing image with Gemini: ${imageUrl.substring(0, 80)}...`);
        const { generateText: geminiGenerate } = await import("ai");
        const result = await geminiGenerate({
          model: google("gemini-2.0-flash"),
          messages: [{
            role: "user",
            content: [
              { type: "text", text: `Analyze this image in detail. ${context ? `Context: ${context}.` : ""} Describe what you see — products, objects, people, text, issues, or anything relevant for a customer service chat. Be specific about product details (colors, sizes, types) if visible.` },
              { type: "image", image: imageUrl },
            ],
          }],
          maxTokens: 300,
        });
        if (result.text && result.text.trim()) {
          console.log(`[Vision] ✅ Gemini analyzed image: ${result.text.substring(0, 100)}...`);
          return result.text.trim();
        }
      } catch (geminiErr) {
        console.warn(`[Vision] Gemini failed: ${geminiErr.message?.substring(0, 150)}`);
      }
    }

    // ─── Attempt 2: NVIDIA NIM Vision (Llama 3.2 90B Vision) ───
    // Free on NVIDIA Build, excellent vision model
    if (process.env.NVIDIA_API_KEY) {
      try {
        console.log(`[Vision] Analyzing image with NVIDIA Llama 3.2 90B Vision...`);
        const nvidia = createOpenAI({
          apiKey: process.env.NVIDIA_API_KEY,
          baseURL: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
          compatibility: "compatible",
        });

        // Download image and convert to base64 for NVIDIA API
        const imgResp = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
        if (imgResp.ok) {
          const imgBuf = Buffer.from(await imgResp.arrayBuffer());
          const base64 = imgBuf.toString("base64");
          const mimeType = imgResp.headers.get("content-type") || "image/jpeg";

          const result = await generateText({
            model: nvidia("meta/llama-3.2-90b-vision-instruct"),
            messages: [{
              role: "user",
              content: [
                { type: "text", text: `Analyze this image in detail. ${context ? `Context: ${context}.` : ""} Describe what you see — products, objects, people, text, issues, or anything relevant for a customer service chat. Be specific about product details (colors, sizes, types) if visible.` },
                { type: "image", image: `data:${mimeType};base64,${base64}` },
              ],
            }],
            maxTokens: 300,
          });

          if (result.text && result.text.trim()) {
            console.log(`[Vision] ✅ NVIDIA Vision analyzed image: ${result.text.substring(0, 100)}...`);
            return result.text.trim();
          }
        }
      } catch (nvidiaErr) {
        console.warn(`[Vision] NVIDIA Vision failed: ${nvidiaErr.message?.substring(0, 150)}`);
      }
    }

    // ─── Attempt 3: Google Gemini REST API (fallback for vision) ───
    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      try {
        console.log(`[Vision] Trying Gemini REST API for image analysis...`);
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: `Analyze this image in detail. ${context ? `Context: ${context}.` : ""} Describe what you see — products, objects, people, text, issues, or anything relevant for a customer service chat.` },
                  { file_data: { mime_type: "image/jpeg", file_uri: imageUrl } },
                ],
              }],
              generationConfig: { maxOutputTokens: 300 },
            }),
            signal: AbortSignal.timeout(20000),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text && text.trim()) {
            console.log(`[Vision] ✅ Gemini REST analyzed image: ${text.substring(0, 100)}...`);
            return text.trim();
          }
        }
      } catch (restErr) {
        console.warn(`[Vision] Gemini REST failed: ${restErr.message?.substring(0, 150)}`);
      }
    }

    console.warn("[Vision] All vision models failed — no image analysis available");
    return null;
  } catch (err) {
    console.error("[Vision] Image analysis error:", err.message);
    return null;
  }
}

/**
 * Generate an AI reply when the customer sent an image.
 * Analyzes the image first, then generates a contextual reply.
 * 
 * @param {Object} params - Same as generateAIReply, plus:
 * @param {string[]} params.mediaUrls - URLs of images sent by customer
 * @returns {Object} - Same as generateAIReply
 */
export async function generateAIReplyWithVision({
  accountId,
  customerId,
  conversationId = null,
  customerMessage,
  customerName,
  personality,
  country = "Egypt",
  businessName = "My Store",
  conversationHistory = [],
  plan = "starter",
  mediaUrls = [],
}) {
  try {
    // 1. Analyze all images first
    const imageDescriptions = [];
    for (const url of mediaUrls) {
      const desc = await analyzeImage(url, `Customer "${customerName || "Unknown"}" sent this image in a chat with "${businessName}" store`);
      if (desc) {
        imageDescriptions.push(desc);
      }
    }

    // 2. Build enhanced message with image context
    let enhancedMessage = customerMessage || "";
    if (imageDescriptions.length > 0) {
      enhancedMessage += `\n\n[IMAGE ANALYSIS: The customer sent ${imageDescriptions.length === 1 ? "an image" : imageDescriptions.length + " images"}. Here is what the AI vision model detected:]\n${imageDescriptions.map((d, i) => `Image ${i + 1}: ${d}`).join("\n")}\n[Based on the image analysis above, respond to the customer appropriately. If they're asking about a product in the image, help them. If they're showing an issue, offer support.]`;
    }

    // 3. Generate AI reply using the enhanced message
    const result = await generateAIReply({
      accountId,
      customerId,
      conversationId,
      customerMessage: enhancedMessage,
      customerName,
      personality,
      country,
      businessName,
      conversationHistory,
      plan,
    });

    // Tag the result as having used vision
    if (imageDescriptions.length > 0) {
      result.usedVision = true;
      result.imageDescriptions = imageDescriptions;
    }

    return result;
  } catch (err) {
    console.error("[Vision] generateAIReplyWithVision error:", err.message);
    // Fallback to regular reply without vision
    return generateAIReply({
      accountId,
      customerId,
      customerMessage,
      customerName,
      personality,
      country,
      businessName,
      conversationHistory,
      plan,
    });
  }
}

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
 * Delegates to the unified provider-chain module which handles
 * multi-key support, health tracking, and smart failover for ALL providers.
 */
function buildProviderChain() {
  const providers = buildFullProviderChain();

  // Check if ZAI SDK is available as last-resort fallback
  try {
    const zaiConfig = getZAIConfig();
    if (zaiConfig?.baseUrl && zaiConfig?.apiKey) {
      console.log("[AI] ZAI SDK config found — will be used as fallback if all providers fail");
    }
  } catch (e) {
    console.log("[AI] ZAI SDK not configured, skipping:", e?.message);
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
  conversationId = null,
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

    // Plan-gated: Pro+ gets cart + customer memory tools
    const planLimits = getPlanLimits(plan);
    const canUseAgentTools = planLimits.agent_tools === true || planLimits.agent_tools === -1;

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

    // ─── B6: Customer memory tools (Pro+) ───
    // AI can read/write per-customer preferences and memory
    if (canUseAgentTools && customerId) {
      const memoryTools = createCustomerMemoryTools(accountId, customerId);
      tools = { ...tools, ...memoryTools };
    }

    // ─── H4: Cart tools (Pro+) ───
    // AI can build multi-item carts and convert to orders
    if (canUseAgentTools) {
      const cartTools = createCartTools(accountId, customerId, conversationId);
      tools = { ...tools, ...cartTools };
    }

    // 2.5. A/B Test: Check for running tests and assign variant
    let abTestVariant = null;
    let abTestId = null;
    try {
      const { data: runningTests } = await getSupabase()
        .from("ab_tests")
        .select("id, variants, status")
        .eq("account_id", accountId)
        .eq("status", "running")
        .limit(1);

      if (runningTests && runningTests.length > 0 && customerId) {
        const test = runningTests[0];
        abTestId = test.id;

        // Consistent hash: customer_id + test_id → bucket
        const hashInput = `${customerId}:${test.id}`;
        let hash = 0;
        for (let i = 0; i < hashInput.length; i++) {
          const char = hashInput.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        const bucket = Math.abs(hash) % 100;

        let cumulative = 0;
        for (const variant of test.variants) {
          cumulative += variant.weight || 0;
          if (bucket < cumulative) {
            abTestVariant = variant;
            break;
          }
        }

        // If variant has custom system prompt, override the default
        if (abTestVariant?.system_prompt) {
          systemPrompt = abTestVariant.system_prompt;
          console.log(`[generateAIReply] A/B Test: Using variant ${abTestVariant.name} prompt for customer ${customerId}`);
        }

        // If variant has greeting, prepend it
        if (abTestVariant?.greeting && conversationHistory.length === 0) {
          // This is a new conversation — the greeting will be handled by auto-greeting
          // But we store it for the impression tracking
        }
      }
    } catch (e) {
      console.warn("[generateAIReply] A/B test check failed:", e.message);
    }

    // 3. Fetch and embed product catalog directly in the system prompt
    // This ensures the AI can answer product questions even if tool calls fail
    let productContext = "";
    try {
      const { data: accountData } = await getSupabase()
        .from("accounts")
        .select("currency, ai_name, ai_avatar, ai_personality_type, ai_custom_description, ai_formality, ai_enthusiasm, ai_verbosity, ai_empathy, ai_max_response_length, ai_auto_suggest_products, ai_escalation_keywords, ai_forbidden_topics, ai_personality, ai_dialect, scarcity_threshold, scarcity_enabled, business_hours, after_hours_auto_pilot, timezone")
        .eq("id", accountId)
        .single();
      
      const currency = accountData?.currency || "EGP";

      // Use structured personality settings if available, otherwise fall back to simple text
      let effectivePersonality = personality;
      if (accountData && (accountData.ai_personality_type || accountData.ai_formality !== null)) {
        effectivePersonality = buildPersonalityFromSettings(accountData);
      } else if (accountData?.ai_personality) {
        effectivePersonality = accountData.ai_personality;
      }

      // Re-generate the system prompt with the enhanced personality if we have structured settings
      if (effectivePersonality !== personality) {
        switch(intent) {
          case "support":
            systemPrompt = getSupportAgentPrompt(businessName, effectivePersonality);
            break;
          case "order_tracking":
            systemPrompt = getOrderTrackerAgentPrompt(businessName, effectivePersonality);
            break;
          case "sales":
          default:
            systemPrompt = getSalesAgentPrompt(businessName, country, effectivePersonality);
            break;
        }
      }

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
        }).join('\n')}\n\nIMPORTANT: When customers ask what you sell or about products, reference this catalog directly. Do NOT say you need to check — you already have this information. If a product has variants (sizes, colors, etc.), ALWAYS mention the available options to the customer. For example, if they ask 'what colors do you have?', check the variants and list them.`;
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

    // ─── Feature 9: After-Hours Auto-Pilot Switch ───
    let afterHoursContext = "";
    try {
      if (accountData?.after_hours_auto_pilot && accountData?.business_hours) {
        const { isBusinessOpen } = await import("@/app/api/settings/business-hours/route");
        const isOpen = isBusinessOpen(accountData.business_hours, accountData.timezone || "Africa/Cairo");

        if (!isOpen) {
          afterHoursContext = "\n\n⚠️ AFTER-HOURS MODE: The store is currently CLOSED and no human agents are available. You are in full AUTO-PILOT mode. Handle everything yourself — answer questions, recommend products, create orders, and process payments autonomously. If a customer asks to speak to a human, politely explain that the team is currently away but will follow up tomorrow during business hours, and you can help them with anything they need right now. Be extra helpful and proactive to compensate for the absence of human agents.";
          console.log("[generateAIReply] After-hours auto-pilot ACTIVE — store is closed");
        }
      }
    } catch (e) {
      console.warn("[generateAIReply] Business hours check failed:", e.message);
    }

    // ─── Feature 4: Arabic Dialect Injection ───
    let dialectContext = "";
    try {
      const { data: acctDialect } = await getSupabase()
        .from("accounts")
        .select("ai_dialect")
        .eq("id", accountId)
        .maybeSingle();

      const dialect = acctDialect?.ai_dialect || "auto";
      const dialectInstructions = {
        egyptian: "\n\n⚠️ CRITICAL LANGUAGE RULE: You MUST speak in Egyptian Arabic dialect (مصري عامي). Use Egyptian slang and expressions naturally: 'يا هلا', 'منورنا', 'يا فندم', 'خالص', 'ماشي', 'تمام', 'إحنا', 'دي', 'ده', 'عشان'. Be warm, friendly, and casual — like a helpful Egyptian shop owner chatting with a customer on WhatsApp. Never use stiff formal Arabic unless the customer explicitly speaks Fusha.",
        gulf: "\n\n⚠️ CRITICAL LANGUAGE RULE: You MUST speak in Gulf Arabic dialect (خليجي). Use Gulf expressions naturally: 'حياك الله', 'طويل العمر', 'ياللا', 'وايد', 'شسالفة', 'زين'. Be respectful, warm, and hospitable — like a premium Gulf brand concierge. Use 'أنتم' for plural address.",
        levantine: "\n\n⚠️ CRITICAL LANGUAGE RULE: You MUST speak in Levantine Arabic dialect (شامي). Use Levantine expressions naturally: 'أهلاً وسهلاً', 'تكرم عينك', 'لك', 'شو', 'هيك', 'منيح'. Be warm, friendly, and helpful — like a friendly Levantine shop owner.",
        formal: "\n\n⚠️ CRITICAL LANGUAGE RULE: You MUST speak in Formal Arabic (الفصحى). Use proper Modern Standard Arabic with correct grammar. Be professional, polite, and respectful — like a corporate customer service representative. Use 'حضرتك' for polite address.",
        english: "\n\n⚠️ CRITICAL LANGUAGE RULE: You MUST respond in English. Be professional and friendly. If the customer writes in Arabic, respond in English but acknowledge their message.",
        auto: "", // Auto = detect customer's language and match it
      };

      if (dialect !== "auto" && dialectInstructions[dialect]) {
        dialectContext = dialectInstructions[dialect];
      }
    } catch (e) {
      console.warn("[generateAIReply] Dialect fetch failed:", e.message);
    }

    // ─── Feature 6: Low Stock Scarcity Trigger ───
    let scarcityContext = "";
    try {
      const { data: acctScarcity } = await getSupabase()
        .from("accounts")
        .select("scarcity_threshold, scarcity_enabled")
        .eq("id", accountId)
        .maybeSingle();

      if (acctScarcity?.scarcity_enabled !== false) {
        const threshold = acctScarcity?.scarcity_threshold || 5;
        scarcityContext = `\n\n⚠️ SCARCITY MARKETING RULE: When recommending or discussing ANY product that has stock ≤ ${threshold} units, you MUST proactively mention scarcity to create urgency. Examples: "🔥 Note: Only ${threshold} pieces left in stock! I recommend reserving yours today." or "Hurry! This item is selling fast — only ${threshold} remaining." This applies to both Arabic and English. Be natural — don't sound pushy, but DO mention it every time a low-stock product comes up.`;
      }
    } catch (e) {
      console.warn("[generateAIReply] Scarcity fetch failed:", e.message);
    }

    const fullSystemPrompt = systemPrompt + productContext + policyContext + afterHoursContext + dialectContext + scarcityContext;

    // 5. Try providers with robust fallback
    const providerChain = buildProviderChain();
    let text = "";
    let toolCalls = null;
    let lastError = null;

    if (providerChain.length === 0) {
      console.warn("[generateAIReply] No AI providers in chain — will try ZAI SDK direct fallback");
    }

    for (const provider of providerChain) {
      // ─── Smart Failover: Track success/failure per key ───
      // If a key is rate-limited or broken, we record it and the next
      // buildProviderChain() call will skip it automatically.
      
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
        if (text && text.trim()) {
          // ✅ Success — record it so this key stays healthy
          if (provider._provider !== undefined) recordKeySuccess(provider._provider, provider._keyIndex);
          break;
        }
        console.warn(`[generateAIReply] ${provider.name} with tools returned empty text`);
      } catch (providerError) {
        lastError = providerError;
        console.warn(`[generateAIReply] ${provider.name} with tools failed: ${providerError.message}`);
        // ❌ Failure — record it so this key gets deprioritized
        if (provider._provider !== undefined) recordKeyFailure(provider._provider, provider._keyIndex, providerError);
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
        if (text && text.trim()) {
          // ✅ Success
          if (provider._provider !== undefined) recordKeySuccess(provider._provider, provider._keyIndex);
          break;
        }
      } catch (providerError) {
        lastError = providerError;
        console.warn(`[generateAIReply] ${provider.name} without tools failed: ${providerError.message}`);
        if (provider._provider !== undefined) recordKeyFailure(provider._provider, provider._keyIndex, providerError);
      }
    }

    // ─── ZAI SDK Direct Fallback ───
    // If all providers in the chain failed (or chain is empty),
    // use the z-ai-web-dev-sdk directly for chat completions.
    // This is the guaranteed fallback that always works in this environment.
    if (!text || !text.trim()) {
      try {
        console.log("[generateAIReply] All providers failed — trying ZAI SDK direct fallback");
        const ZAI = (await import("z-ai-web-dev-sdk")).default;
        
        // Try to create ZAI instance — it auto-discovers config from env vars or /etc/.z-ai-config
        let zai;
        try {
          zai = await ZAI.create();
        } catch (createErr) {
          // If ZAI.create() fails (no config found), try constructing with explicit config
          console.log("[generateAIReply] ZAI.create() failed, trying explicit config from getZAIConfig()");
          const zaiConfig = getZAIConfig();
          if (zaiConfig?.baseUrl && zaiConfig?.apiKey) {
            zai = new ZAI({ baseUrl: zaiConfig.baseUrl, apiKey: zaiConfig.apiKey });
          } else {
            throw new Error("No ZAI config available — neither env vars nor config file found");
          }
        }
        
        const completion = await zai.chat.completions.create({
          messages: [
            { role: "system", content: fullSystemPrompt },
            ...formattedMessages,
          ],
          temperature: 0.7,
          max_tokens: 500,
        });
        const fallbackText = completion.choices?.[0]?.message?.content;
        if (fallbackText && fallbackText.trim()) {
          text = fallbackText.trim();
          console.log("[generateAIReply] ✅ ZAI SDK direct fallback succeeded");
        } else {
          console.warn("[generateAIReply] ZAI SDK returned empty response");
        }
      } catch (zaiErr) {
        console.warn(`[generateAIReply] ZAI SDK direct fallback failed: ${zaiErr.message}`);
        lastError = zaiErr;
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

    // 6. Track A/B test impression if applicable
    if (abTestId && abTestVariant && text) {
      try {
        const currentResults = await getSupabase()
          .from("ab_tests")
          .select("results")
          .eq("id", abTestId)
          .single();

        if (currentResults.data?.results) {
          const results = { ...currentResults.data.results };
          if (!results[abTestVariant.name]) {
            results[abTestVariant.name] = { impressions: 0, conversions: 0, revenue: 0 };
          }
          results[abTestVariant.name].impressions += 1;
          await getSupabase()
            .from("ab_tests")
            .update({ results })
            .eq("id", abTestId);
          console.log(`[generateAIReply] A/B Test: Tracked impression for variant ${abTestVariant.name}`);
        }
      } catch (e) {
        console.warn("[generateAIReply] A/B test impression tracking failed:", e.message);
      }
    }

    // If all providers failed, generate a polite fallback reply
    // instead of returning null (which means the customer gets NO response)
    if (!text || !text.trim()) {
      console.error("[generateAIReply] All providers failed. Last error:", lastError?.message);
      const fallbackReplies = {
        sales: `Thank you for your interest! I'm currently experiencing high demand. A team member will follow up with you shortly to help you with your request.`,
        support: `I appreciate your patience! I'm having trouble connecting right now. Our support team has been notified and will get back to you shortly.`,
        order_tracking: `I'm having trouble accessing order information right now. Our team has been notified and will update you on your order status shortly.`,
        general: `Thanks for reaching out! I'm experiencing some connectivity issues right now, but our team has been notified and will respond to you shortly.`,
      };
      text = fallbackReplies[intent] || fallbackReplies.general;
      console.log(`[generateAIReply] Using fallback reply for intent: ${intent}`);
    }

    return { reply: text, intent, sentiment, toolCalls, needsHumanAttention, escalationReason, abTestVariant: abTestVariant?.name || null, abTestId };
  } catch (err) {
    console.error("Error generating AI reply:", err);
    // CRITICAL: Never return null reply — the customer must always get some response.
    // Previously this returned reply: null which meant the processor silently skipped
    // the reply, leaving the customer with NO response at all.
    const fallbackReplies = {
      sales: `Thank you for your interest! I'm currently experiencing high demand. A team member will follow up with you shortly to help you with your request.`,
      support: `I appreciate your patience! I'm having trouble connecting right now. Our support team has been notified and will get back to you shortly.`,
      order_tracking: `I'm having trouble accessing order information right now. Our team has been notified and will update you on your order status shortly.`,
      general: `Thanks for reaching out! I'm experiencing some connectivity issues right now, but our team has been notified and will respond to you shortly.`,
    };
    return { reply: fallbackReplies.general, intent: "general", sentiment: "neutral", toolCalls: null, needsHumanAttention: false, escalationReason: null };
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
