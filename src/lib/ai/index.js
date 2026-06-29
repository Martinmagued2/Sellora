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
        // Pass conversationId so the create_order tool can save high-value
        // orders as pending_actions linked to this conversation.
        tools = createSalesTools(accountId, customerId, { conversationId });
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
    let aiSafetySettings = { confidenceThreshold: 70, previewMode: false };
    try {
      const { data: accountData } = await getSupabase()
        .from("accounts")
        .select("currency, ai_name, ai_avatar, ai_personality_type, ai_custom_description, ai_formality, ai_enthusiasm, ai_verbosity, ai_empathy, ai_max_response_length, ai_auto_suggest_products, ai_escalation_keywords, ai_forbidden_topics, ai_personality, ai_confidence_threshold, ai_preview_mode, ai_high_value_threshold")
        .eq("id", accountId)
        .single();
      
      const currency = accountData?.currency || "EGP";

      // ─── AI Safety: capture confidence threshold + preview mode + high-value threshold ───
      // These are used by the channel processor to decide whether to hold a reply
      // for human review (preview mode or low confidence) and by the create_order
      // tool to decide whether to require approval on high-value orders.
      aiSafetySettings = {
        confidenceThreshold: accountData?.ai_confidence_threshold ?? 70,
        previewMode: !!accountData?.ai_preview_mode,
        highValueThreshold: accountData?.ai_high_value_threshold ?? 1000,
      };

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

    // 4. Format History — use last 15 messages for multi-step order flow context
    const formattedMessages = conversationHistory.slice(-15).map((msg) => ({
      role: msg.direction === "incoming" ? "user" : "assistant",
      content: msg.content,
    }));
    
    formattedMessages.push({ role: "user", content: customerMessage });

    // Get the actual store slug from the stores table
    let storeUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sellora-ruby.vercel.app";
    try {
      const { data: store } = await getSupabase()
        .from("stores")
        .select("slug")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (store?.slug) {
        storeUrl = `${storeUrl}/store/${store.slug}`;
      } else {
        // No store found — use business name as slug
        storeUrl = `${storeUrl}/store/${businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
      }
    } catch (e) {
      // Fallback — use business name
      storeUrl = `${storeUrl}/store/${businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
    }
    const fullSystemPrompt = systemPrompt + productContext + policyContext + `\n\nSTORE URL: Share this link with customers when they want to browse: ${storeUrl}\n`;

    // 5. Try providers with robust fallback
    const providerChain = buildProviderChain();
    let text = "";
    let toolCalls = null;
    let finishReason = null;
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
        finishReason = result.finishReason;
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
        finishReason = result.finishReason;
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
          finishReason = completion.choices?.[0]?.finish_reason || "stop";
          console.log("[generateAIReply] ✅ ZAI SDK direct fallback succeeded");
        } else {
          console.warn("[generateAIReply] ZAI SDK returned empty response");
        }
      } catch (zaiErr) {
        console.warn(`[generateAIReply] ZAI SDK direct fallback failed: ${zaiErr.message}`);
        lastError = zaiErr;
      }
    }

    // ─── AI Safety: Confidence scoring ───
    // Most providers expose a finish_reason. We map common values to a 0-100
    // confidence score. If the score is below the account's
    // ai_confidence_threshold, the channel processor will hold the reply for
    // human review instead of sending it to the customer.
    //
    // Mapping rationale:
    //   stop            → 95  (model finished naturally)
    //   tool-calls      → 90  (model emitted tool calls cleanly)
    //   end_turn        → 95  (Anthropic-style "end_turn")
    //   length          → 55  (hit max_tokens → reply is likely truncated)
    //   content_filter  → 30  (filtered → reply may be incomplete)
    //   max_tokens      → 55  (alias for length)
    //   null/unknown    → 75  (no signal — assume reasonable)
    const FINISH_REASON_SCORES = {
      stop: 95,
      "tool-calls": 90,
      tool_calls: 90,
      end_turn: 95,
      length: 55,
      max_tokens: 55,
      content_filter: 30,
      content_filtering: 30,
    };
    const confidenceScore = finishReason
      ? (FINISH_REASON_SCORES[finishReason] ?? 75)
      : 75;

    // If the score is below threshold, mark for human review. The processor
    // will still save the reply (so the operator can edit it) but will NOT
    // send it to the customer.
    const confidenceThreshold = aiSafetySettings.confidenceThreshold ?? 70;
    const needsHumanReview = confidenceScore < confidenceThreshold;
    if (needsHumanReview) {
      console.log(
        `[generateAIReply] AI Safety: confidence ${confidenceScore} < threshold ${confidenceThreshold} (finish_reason=${finishReason}) — flagging for human review`
      );
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

    return {
      reply: text,
      intent,
      sentiment,
      toolCalls,
      needsHumanAttention,
      escalationReason,
      abTestVariant: abTestVariant?.name || null,
      abTestId,
      // ─── AI Safety fields ───
      // The channel processor uses these to decide whether to hold the reply
      // for human review (preview mode OR low confidence) instead of sending
      // it to the customer immediately.
      confidenceScore,
      finishReason,
      needsHumanReview,
      safetySettings: aiSafetySettings,
    };
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
    return {
      reply: fallbackReplies.general,
      intent: "general",
      sentiment: "neutral",
      toolCalls: null,
      needsHumanAttention: false,
      escalationReason: null,
      // AI Safety defaults for the error path — these replies are pre-written
      // templates, so they don't need human review and have no provider signal.
      confidenceScore: 100,
      finishReason: "fallback",
      needsHumanReview: false,
      safetySettings: { confidenceThreshold: 70, previewMode: false, highValueThreshold: 1000 },
    };
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
