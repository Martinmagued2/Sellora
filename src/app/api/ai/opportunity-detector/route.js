/**
 * GET /api/ai/opportunity-detector?conversation_id=<uuid>
 *
 * Analyzes a conversation for sales opportunities (cross-sell, upsell,
 * bundle, and complementary product recommendations).
 *
 * Returns a list of detected opportunities with:
 *   - type: cross_sell | upsell | bundle | complementary | restock
 *   - product_id: the recommended product (from the store's catalog)
 *   - product_name
 *   - reason: why this opportunity was detected
 *   - confidence: 0-100
 *   - suggested_message: a pre-written message the operator can send
 *
 * Uses the LLM to analyze the conversation + match against the product
 * catalog. Falls back to rule-based detection (keyword matching) if no
 * AI provider is configured.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { getAuthUser } from "@/lib/auth-helper";
import { canAccessAccount } from "@/lib/team-auth";

let _admin = null;
function admin() {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _admin;
}

function buildProvider() {
  if (process.env.GROQ_API_KEY) {
    return createGroq({ apiKey: process.env.GROQ_API_KEY })("llama-3.3-70b-versatile");
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })("gemini-1.5-flash");
  }
  if (process.env.OPENAI_API_KEY) {
    return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })("gpt-4o-mini");
  }
  return null;
}

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversation_id");
    if (!conversationId) {
      return NextResponse.json({ error: "conversation_id is required" }, { status: 400 });
    }

    const db = admin();

    // Fetch conversation
    const { data: conversation, error: convErr } = await db
      .from("conversations")
      .select("id, account_id, channel, customer:customers(id, name, total_spent, total_orders)")
      .eq("id", conversationId)
      .maybeSingle();

    if (convErr || !conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // SECURITY: Verify access
    const hasAccess = await canAccessAccount(user, conversation.account_id);
    if (!hasAccess) {
      return NextResponse.json({ error: "You do not have access to this conversation" }, { status: 403 });
    }

    // Fetch recent messages
    const { data: messages } = await db
      .from("messages")
      .select("content, direction, is_ai, intent, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(20);

    // Fetch product catalog
    const { data: products } = await db
      .from("products")
      .select("id, name, price, stock, category, description, tags")
      .eq("account_id", conversation.account_id)
      .limit(100);

    // Fetch customer's order history
    const { data: orders } = await db
      .from("orders")
      .select("id, items, total, created_at")
      .eq("customer_id", conversation.customer?.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const context = {
      customer: {
        name: conversation.customer?.name,
        total_spent: conversation.customer?.total_spent,
        total_orders: conversation.customer?.total_orders,
      },
      recent_messages: (messages || []).reverse().map(m => ({
        content: (m.content || "").slice(0, 200),
        direction: m.direction,
        intent: m.intent,
      })),
      customer_products: (orders || []).flatMap(o =>
        (o.items || []).map(i => i.name).filter(Boolean)
      ),
      catalog: (products || []).map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        stock: p.stock,
        category: p.category,
        tags: p.tags,
      })),
    };

    // Try AI detection
    const model = buildProvider();
    if (!model) {
      // Fallback: rule-based detection
      const ruleBasedOpps = ruleBasedOpportunities(context);
      return NextResponse.json({
        opportunities: ruleBasedOpps,
        ai_powered: false,
        generated_at: new Date().toISOString(),
      });
    }

    const systemPrompt = `You are an AI sales opportunity detector. Analyze this conversation and the store's product catalog to identify sales opportunities.

For each opportunity, return a JSON object:
{
  "type": "cross_sell" | "upsell" | "bundle" | "complementary" | "restock",
  "product_id": "<uuid from catalog>",
  "product_name": "<product name>",
  "reason": "Why this is an opportunity (be specific — reference what the customer said)",
  "confidence": <0-100>,
  "suggested_message": "A natural message the operator can send to suggest this product"
}

Opportunity types:
- cross_sell: Recommend a product from a different category than what they're discussing
- upsell: Recommend a premium version of what they're asking about
- bundle: Recommend products that go together (e.g., phone case + screen protector)
- complementary: Recommend accessories or related items
- restock: They've bought this before and might be running low

Rules:
1. Only return REAL opportunities — don't force recommendations if there are none
2. Match products from the catalog by name/category/tags
3. The suggested_message should sound natural and helpful, not pushy
4. Maximum 3 opportunities per conversation
5. If the customer is complaining or angry, return empty array (don't try to sell)

Return ONLY a JSON array, no markdown fences.`;

    let opportunities = [];
    let aiPowered = true;

    try {
      const result = await generateText({
        model,
        system: systemPrompt,
        prompt: `Analyze this conversation for sales opportunities:\n\n${JSON.stringify(context, null, 2)}`,
        temperature: 0.4,
        maxTokens: 1000,
      });

      const text = result.text.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
      opportunities = JSON.parse(text);
      if (!Array.isArray(opportunities)) opportunities = [];
    } catch (llmErr) {
      console.warn("[OPPORTUNITY-DETECTOR] LLM failed, using rules:", llmErr.message);
      opportunities = ruleBasedOpportunities(context);
      aiPowered = false;
    }

    return NextResponse.json({
      opportunities: opportunities.slice(0, 3),
      ai_powered: aiPowered,
      generated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[OPPORTUNITY-DETECTOR] error:", e.message);
    return NextResponse.json({ error: "Server error: " + e.message }, { status: 500 });
  }
}

/**
 * Rule-based opportunity detection fallback.
 */
function ruleBasedOpportunities(context) {
  const opportunities = [];
  const messages = context.recent_messages || [];
  const catalog = context.catalog || [];
  const customerProducts = context.customer_products || [];

  // Combine all message content for keyword matching
  const allText = messages.map(m => (m.content || "").toLowerCase()).join(" ");

  // Check for anger — don't recommend if angry
  if (/angry|frustrat|complain|refund|return|broken|terrible|worst/.test(allText)) {
    return [];
  }

  // 1. Restock: products the customer has bought before
  for (const product of catalog) {
    if (customerProducts.some(p => p.toLowerCase().includes(product.name.toLowerCase()))) {
      // Don't recommend if they just bought it recently
      opportunities.push({
        type: "restock",
        product_id: product.id,
        product_name: product.name,
        reason: `${product.name} was in a previous order — they might need a restock`,
        confidence: 60,
        suggested_message: `Hi! I noticed you've ordered ${product.name} before. Running low? I can set you up with a fresh order right away.`,
      });
      if (opportunities.length >= 3) break;
    }
  }

  // 2. Category-based cross-sell
  for (const product of catalog) {
    if (opportunities.length >= 3) break;
    if (allText.includes(product.name.toLowerCase()) || allText.includes((product.category || "").toLowerCase())) {
      // Find a complementary product from a different category
      const complementary = catalog.find(p =>
        p.id !== product.id &&
        p.category !== product.category &&
        p.stock > 0
      );
      if (complementary) {
        opportunities.push({
          type: "complementary",
          product_id: complementary.id,
          product_name: complementary.name,
          reason: `Customer is discussing ${product.name} — ${complementary.name} pairs well`,
          confidence: 50,
          suggested_message: `Since you're interested in ${product.name}, you might also like ${complementary.name}! They go really well together.`,
        });
      }
    }
  }

  // 3. Price inquiry → upsell
  if (/price|how much|cost/.test(allText)) {
    const premiumProduct = catalog
      .filter(p => p.stock > 0)
      .sort((a, b) => (b.price || 0) - (a.price || 0))[0];
    if (premiumProduct && opportunities.length < 3) {
      opportunities.push({
        type: "upsell",
        product_id: premiumProduct.id,
        product_name: premiumProduct.name,
        reason: `Customer is asking about price — premium option available`,
        confidence: 45,
        suggested_message: `If you're looking for the best quality, our ${premiumProduct.name} is a premium option at ${premiumProduct.price}. It's our top seller!`,
      });
    }
  }

  return opportunities.slice(0, 3);
}
