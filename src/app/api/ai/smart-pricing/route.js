/**
 * POST /api/ai/smart-pricing
 *
 * AI Smart Pricing — recommends whether to offer a discount (and how much)
 * based on the customer's behavior, conversation history, and value.
 *
 * Instead of offering the same discount to everyone, AI considers:
 *   - Customer's lifetime value (LTV)
 *   - Order history (frequency, recency)
 *   - Current conversation signals (price sensitivity, urgency)
 *   - Cart abandonment pattern
 *   - Sentiment in the conversation
 *
 * Returns:
 *   - discount_percentage: 0-30 (0 = no discount needed)
 *   - reason: why this discount (or no discount)
 *   - confidence: 0-100
 *   - suggested_message: a message the operator can send offering the discount
 *   - alternative_offers: other options (free shipping, bundle, etc.)
 *
 * Body:
 *   {
 *     customer_id: "uuid",
 *     product_id: "uuid",       // optional
 *     cart_value: 150,          // optional
 *     conversation_context: "customer said it's too expensive..."
 *   }
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

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { customer_id, product_id, cart_value, conversation_context } = await req.json();

    if (!customer_id) {
      return NextResponse.json({ error: "customer_id is required" }, { status: 400 });
    }

    const db = admin();

    // Fetch customer
    const { data: customer, error: cErr } = await db
      .from("customers")
      .select("id, account_id, name, total_spent, total_orders, last_active_at, tags, lifecycle_stage, created_at")
      .eq("id", customer_id)
      .maybeSingle();

    if (cErr || !customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // SECURITY: Verify access
    const hasAccess = await canAccessAccount(user, customer.account_id);
    if (!hasAccess) {
      return NextResponse.json({ error: "You do not have access to this customer" }, { status: 403 });
    }

    // Fetch orders + conversations in parallel
    const [ordersResult, convsResult, productResult, cartResult] = await Promise.all([
      db.from("orders")
        .select("id, total, currency, status, created_at, items")
        .eq("customer_id", customer_id)
        .order("created_at", { ascending: false })
        .limit(10),
      db.from("conversations")
        .select("id, channel, status, last_message_at")
        .eq("customer_id", customer_id)
        .order("updated_at", { ascending: false })
        .limit(5),
      product_id ? db.from("products")
        .select("id, name, price, stock, category, cost")
        .eq("id", product_id)
        .eq("account_id", customer.account_id)
        .maybeSingle() : Promise.resolve({ data: null }),
      db.from("abandoned_carts")
        .select("id, cart_value, status, abandoned_at")
        .eq("customer_id", customer_id)
        .order("abandoned_at", { ascending: false })
        .limit(3),
    ]);

    // Fetch recent messages from the customer's conversations
    let recentMessages = [];
    if (convsResult.data && convsResult.data.length > 0) {
      const convIds = convsResult.data.map(c => c.id);
      const { data: msgs } = await db.from("messages")
        .select("content, direction, intent, created_at")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false })
        .limit(20);
      recentMessages = msgs || [];
    }

    const context = {
      customer: {
        name: customer.name,
        total_spent: customer.total_spent,
        total_orders: customer.total_orders,
        last_active_at: customer.last_active_at,
        tags: customer.tags,
        lifecycle_stage: customer.lifecycle_stage,
        customer_since: customer.created_at,
      },
      orders: (ordersResult.data || []).map(o => ({
        total: o.total,
        currency: o.currency,
        status: o.status,
        date: o.created_at,
        items: o.items,
      })),
      recent_messages: recentMessages.map(m => ({
        content: (m.content || "").slice(0, 150),
        direction: m.direction,
        intent: m.intent,
      })),
      product: productResult.data ? {
        name: productResult.data.name,
        price: productResult.data.price,
        stock: productResult.data.stock,
        category: productResult.data.category,
        cost: productResult.data.cost,
      } : null,
      cart_value: cart_value || null,
      abandoned_carts: (cartResult.data || []).map(c => ({
        value: c.cart_value,
        status: c.status,
        date: c.abandoned_at,
      })),
      conversation_context: conversation_context || null,
    };

    // Try AI analysis
    const model = buildProvider();
    if (!model) {
      const ruleBased = ruleBasedPricing(context);
      return NextResponse.json({ ...ruleBased, ai_powered: false });
    }

    const systemPrompt = `You are an AI pricing strategist for an e-commerce business. Recommend whether to offer a discount to this customer, and how much.

Consider:
1. Customer LTV and order frequency — VIPs don't need discounts to convert; new leads might
2. Price sensitivity signals in the conversation (e.g., "too expensive", "cheaper elsewhere")
3. Urgency — if they're ready to buy now, don't discount unnecessarily
4. Cart abandonment history — if they've abandoned before, a small discount might close the deal
5. Stock levels — if stock is low, don't discount (scarcity is better)
6. Margins — if you know the cost, don't discount below a profitable level

Return ONLY a JSON object:
{
  "discount_percentage": <0-30>,
  "reason": "why this discount (or 0 if no discount needed)",
  "confidence": <0-100>,
  "suggested_message": "a message the operator can send offering the discount (or no-discount message)",
  "alternative_offers": [
    { "type": "free_shipping" | "bundle" | "loyalty_credit" | "future_discount", "description": "what to offer", "value": "estimated value" }
  ]
}

Rules:
1. discount_percentage: 0 means no discount needed (customer will buy at full price)
2. For loyal customers (5+ orders), prefer no discount or alternative offers (free shipping, loyalty credit)
3. For new customers showing price sensitivity, 5-15% is usually enough
4. For at-risk customers (churned/negative sentiment), up to 20% to win them back
5. Never recommend more than 30% — devalues the brand
6. Always provide at least one alternative_offer
7. Return ONLY JSON, no markdown`;

    try {
      const result = await generateText({
        model,
        system: systemPrompt,
        prompt: `Recommend a discount for this customer:\n\n${JSON.stringify(context, null, 2)}`,
        temperature: 0.3,
        maxTokens: 600,
      });

      const text = result.text.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
      const pricing = JSON.parse(text);

      return NextResponse.json({
        ...pricing,
        ai_powered: true,
        generated_at: new Date().toISOString(),
      });
    } catch (llmErr) {
      console.warn("[SMART-PRICING] LLM failed, using rules:", llmErr.message);
      const ruleBased = ruleBasedPricing(context);
      return NextResponse.json({ ...ruleBased, ai_powered: false });
    }
  } catch (e) {
    console.error("[SMART-PRICING] error:", e.message);
    return NextResponse.json({ error: "Server error: " + e.message }, { status: 500 });
  }
}

/**
 * Rule-based pricing recommendation fallback.
 */
function ruleBasedPricing(context) {
  const customer = context.customer;
  const orders = context.orders || [];
  const messages = context.recent_messages || [];
  const allText = messages.map(m => (m.content || "").toLowerCase()).join(" ");

  const totalOrders = customer.total_orders || 0;
  const totalSpent = Number(customer.total_spent) || 0;
  const isVIP = totalOrders >= 5 || totalSpent >= 500;
  const isNew = totalOrders === 0;
  const isAtRisk = customer.lifecycle_stage === "churned" ||
    (customer.last_active_at && (Date.now() - new Date(customer.last_active_at).getTime()) > 90 * 24 * 60 * 60 * 1000);

  // Detect price sensitivity
  const priceSensitive = /expensive|too much|cheaper|price|cost|budget|afford|can't afford|overpriced/.test(allText);
  const isReady = /buy|order|checkout|pay|purchase|ship/.test(allText);
  const isAngry = /angry|frustrat|disappointed|refund|return|complaint/.test(allText);

  let discount = 0;
  let reason = "";
  let confidence = 60;
  const alternativeOffers = [];

  if (isVIP && !priceSensitive) {
    // VIP ready to buy — no discount needed
    discount = 0;
    reason = "Loyal VIP customer with no price sensitivity — no discount needed. They'll buy at full price.";
    confidence = 85;
    alternativeOffers.push({
      type: "loyalty_credit",
      description: "Offer loyalty points/credit for future purchase",
      value: `${Math.round(totalSpent * 0.02)} loyalty credit`,
    });
  } else if (isVIP && priceSensitive) {
    // VIP but price-sensitive — small discount
    discount = 5;
    reason = "Loyal customer showing price sensitivity — small 5% discount to maintain relationship.";
    confidence = 75;
    alternativeOffers.push({
      type: "free_shipping",
      description: "Offer free shipping instead of discount",
      value: "Free shipping (saves customer ~$10)",
    });
  } else if (isNew && priceSensitive) {
    // New customer, price-sensitive — moderate discount to convert
    discount = 10;
    reason = "New customer showing price sensitivity — 10% discount to convert first purchase.";
    confidence = 70;
    alternativeOffers.push({
      type: "future_discount",
      description: "Offer 15% off their next purchase instead",
      value: "15% off next order",
    });
  } else if (isNew && !priceSensitive) {
    // New customer, no price sensitivity — small discount to encourage first purchase
    discount = 5;
    reason = "New customer with no price sensitivity — small 5% welcome discount to encourage first purchase.";
    confidence = 65;
    alternativeOffers.push({
      type: "free_shipping",
      description: "Offer free shipping on first order",
      value: "Free first shipping",
    });
  } else if (isAtRisk) {
    // At-risk customer — larger discount to win back
    discount = 15;
    reason = "At-risk customer (churned or inactive) — 15% discount to win them back.";
    confidence = 75;
    alternativeOffers.push({
      type: "bundle",
      description: "Offer a bundle deal with complimentary product",
      value: "Buy one get one 50% off",
    });
  } else if (isAngry) {
    // Angry customer — discount as goodwill
    discount = 10;
    reason = "Customer is upset — 10% goodwill discount to de-escalate and rebuild trust.";
    confidence = 70;
    alternativeOffers.push({
      type: "loyalty_credit",
      description: "Offer store credit as apology",
      value: "$10 store credit",
    });
  } else if (isReady && !priceSensitive) {
    // Ready to buy, no price sensitivity — no discount
    discount = 0;
    reason = "Customer is ready to buy and shows no price sensitivity — no discount needed.";
    confidence = 80;
    alternativeOffers.push({
      type: "free_shipping",
      description: "Offer free shipping as a bonus",
      value: "Free shipping",
    });
  } else {
    // Default: small discount
    discount = 5;
    reason = "Standard 5% discount to encourage conversion.";
    confidence = 55;
    alternativeOffers.push({
      type: "bundle",
      description: "Offer a bundle with related products",
      value: "10% off bundle",
    });
  }

  // Generate suggested message
  const firstName = (customer.name || "there").split(" ")[0];
  let message;
  if (discount === 0) {
    message = `Hi ${firstName}! Great choice — I can process your order right away. Would you like me to set that up for you?`;
  } else {
    message = `Hi ${firstName}! I'd love to help you with your order. I can offer you ${discount}% off as a ${isVIP ? "thank you for being a loyal customer" : isNew ? "welcome discount" : isAtRisk ? "welcome-back offer" : "special offer"}. Would you like to proceed?`;
  }

  return {
    discount_percentage: discount,
    reason,
    confidence,
    suggested_message: message,
    alternative_offers: alternativeOffers,
  };
}
