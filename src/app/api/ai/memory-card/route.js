/**
 * GET /api/ai/memory-card?customer_id=<uuid>
 *
 * Generates (or returns cached) an AI-distilled memory card for a customer.
 *
 * A "memory card" is a structured summary that saves the operator from
 * reading 200+ messages. It includes:
 *   - Communication preferences (preferred channel, typical reply time)
 *   - Buying behavior (avg order value, purchase frequency, last order)
 *   - Product interests (mentioned products, categories)
 *   - Risk level (churn risk, satisfaction signals)
 *   - Lifetime value prediction
 *   - Next best action (AI recommendation)
 *
 * HOW IT WORKS:
 *   1. Fetches customer profile + orders + recent messages + notes
 *   2. Runs a single LLM call with a structured-output prompt
 *   3. Caches the result in customers.ai_memory_card (JSONB) with a timestamp
 *   4. Returns the cached card if it's < 24 hours old (avoid re-running LLM)
 *
 * SECURITY: Requires auth + canAccessAccount. The customer must belong to
 * the user's effective account.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { getAuthUser } from "@/lib/auth-helper";
import { canAccessAccount } from "@/lib/team-auth";
import { buildStandaloneProvider } from "@/lib/ai/standalone-provider";

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

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customer_id");
    if (!customerId) {
      return NextResponse.json({ error: "customer_id is required" }, { status: 400 });
    }

    const db = admin();

    // Fetch customer
    const { data: customer, error: cErr } = await db
      .from("customers")
      .select("id, account_id, name, email, phone, channel, tags, notes, ai_memory, ai_memory_card, ai_memory_card_at, total_orders, total_spent, last_active_at, created_at, lifecycle_stage")
      .eq("id", customerId)
      .maybeSingle();

    if (cErr || !customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // SECURITY: Verify the user can access this account
    const hasAccess = await canAccessAccount(user, customer.account_id);
    if (!hasAccess) {
      return NextResponse.json({ error: "You do not have access to this customer" }, { status: 403 });
    }

    // Check cache — return if < 24 hours old
    if (customer.ai_memory_card && customer.ai_memory_card_at) {
      const cacheAge = Date.now() - new Date(customer.ai_memory_card_at).getTime();
      if (cacheAge < CACHE_TTL_MS) {
        return NextResponse.json({
          memory_card: customer.ai_memory_card,
          cached: true,
          generated_at: customer.ai_memory_card_at,
        });
      }
    }

    // Fetch supporting data in parallel
    const [ordersResult, messagesResult, notesResult] = await Promise.all([
      db.from("orders")
        .select("id, total, currency, status, created_at, items")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(20),
      db.from("messages")
        .select("content, direction, is_ai, intent, created_at")
        .eq("account_id", customer.account_id)
        .order("created_at", { ascending: false })
        .limit(50),
      db.from("customer_notes")
        .select("note, created_at, author_name")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    // Filter messages to this customer's conversations
    // (messages table doesn't have customer_id directly; we approximate by
    // checking conversations for this customer)
    const { data: customerConvs } = await db
      .from("conversations")
      .select("id")
      .eq("customer_id", customerId);
    const convIds = (customerConvs || []).map(c => c.id);
    const customerMessages = (messagesResult.data || []).filter(m =>
      convIds.length === 0 || convIds.includes(m.conversation_id)
    );

    const context = {
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        channel: customer.channel,
        tags: customer.tags,
        notes: customer.notes,
        ai_memory: customer.ai_memory,
        lifecycle_stage: customer.lifecycle_stage,
        total_orders: customer.total_orders,
        total_spent: customer.total_spent,
        last_active_at: customer.last_active_at,
        created_at: customer.created_at,
      },
      orders: (ordersResult.data || []).map(o => ({
        total: o.total,
        currency: o.currency,
        status: o.status,
        date: o.created_at,
        items: o.items,
      })),
      recent_messages: customerMessages.slice(0, 30).map(m => ({
        content: (m.content || "").slice(0, 200),
        direction: m.direction,
        intent: m.intent,
        is_ai: m.is_ai,
        date: m.created_at,
      })),
      notes: (notesResult.data || []).map(n => ({
        note: n.note,
        author: n.author_name,
        date: n.created_at,
      })),
    };

    // Try AI generation
    const model = buildStandaloneProvider();
    if (!model) {
      // Fallback: rule-based memory card
      const fallbackCard = generateRuleBasedMemoryCard(context);
      // Save to DB
      await db.from("customers")
        .update({
          ai_memory_card: fallbackCard,
          ai_memory_card_at: new Date().toISOString(),
        })
        .eq("id", customerId);

      return NextResponse.json({
        memory_card: fallbackCard,
        cached: false,
        ai_powered: false,
        generated_at: new Date().toISOString(),
      });
    }

    const systemPrompt = `You are an AI customer analyst. Generate a structured "memory card" for this customer that helps a sales/support operator understand them at a glance — without reading 200 messages.

Return ONLY a JSON object with this exact schema:
{
  "summary": "One sentence describing this customer (e.g., 'Loyal repeat buyer who prefers WhatsApp and usually orders on weekends')",
  "communication_preferences": {
    "preferred_channel": "whatsapp|instagram|facebook|email|unknown",
    "typical_reply_time": "e.g., 'Usually replies within 2 hours', 'Replies after 8 PM'",
    "language": "e.g., 'English', 'Arabic', 'Mixed'"
  },
  "buying_behavior": {
    "avg_order_value": <number or null>,
    "purchase_frequency": "e.g., 'Orders every 2 weeks', 'One-time buyer', 'Irregular'",
    "last_order_date": "ISO date or null",
    "total_lifetime_value": <number>,
    "preferred_products": ["product names mentioned or ordered"]
  },
  "interests": ["Product categories or specific products they've asked about"],
  "sentiment": "positive|neutral|negative|mixed",
  "risk_level": {
    "churn_risk": "low|medium|high",
    "reason": "e.g., 'Hasn't ordered in 90 days despite being a regular buyer'"
  },
  "satisfaction_signals": ["e.g., 'Complained about shipping once', 'Praised product quality', 'Asked for refund']",
  "next_best_action": {
    "action": "e.g., 'Send win-back discount', 'Follow up on last order', 'Recommend complementary product'",
    "reason": "Why this action makes sense",
    "priority": "high|medium|low"
  },
  "key_facts": ["3-5 bullet points of important context the operator should know"]
}

Be SPECIFIC and CONCISE. Use data from orders and messages. If info is missing, use null or 'unknown' — don't guess.
Return ONLY the JSON, no markdown fences.`;

    let memoryCard;
    let aiPowered = true;

    try {
      const result = await generateText({
        model,
        system: systemPrompt,
        prompt: `Generate a memory card for this customer:\n\n${JSON.stringify(context, null, 2)}`,
        temperature: 0.3,
        maxTokens: 1000,
      });

      const text = result.text.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
      memoryCard = JSON.parse(text);
    } catch (llmErr) {
      console.warn("[MEMORY-CARD] LLM failed, using rule-based:", llmErr.message);
      memoryCard = generateRuleBasedMemoryCard(context);
      aiPowered = false;
    }

    // Save to DB (cache for 24 hours)
    await db.from("customers")
      .update({
        ai_memory_card: memoryCard,
        ai_memory_card_at: new Date().toISOString(),
      })
      .eq("id", customerId);

    return NextResponse.json({
      memory_card: memoryCard,
      cached: false,
      ai_powered: aiPowered,
      generated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[MEMORY-CARD] error:", e.message);
    return NextResponse.json({ error: "Server error: " + e.message }, { status: 500 });
  }
}

/**
 * Rule-based fallback memory card (used when no AI provider is configured).
 */
function generateRuleBasedMemoryCard(context) {
  const { customer, orders, recent_messages, notes } = context;
  const now = Date.now();

  // Communication preferences
  const incomingMessages = recent_messages.filter(m => m.direction === "incoming");
  const channels = {};
  for (const m of incomingMessages) {
    // We don't have channel per message, use customer's channel
    channels[customer.channel] = (channels[customer.channel] || 0) + 1;
  }
  const preferredChannel = customer.channel || "unknown";

  // Reply time analysis
  let replyTimeStr = "Unknown";
  if (incomingMessages.length > 0) {
    const hours = incomingMessages.map(m => new Date(m.date).getHours());
    const avgHour = hours.reduce((s, h) => s + h, 0) / hours.length;
    if (avgHour >= 18 || avgHour <= 2) replyTimeStr = "Usually active in the evening/night";
    else if (avgHour >= 9 && avgHour <= 17) replyTimeStr = "Usually active during business hours";
    else replyTimeStr = "Irregular activity times";
  }

  // Buying behavior
  const orderValues = orders.map(o => Number(o.total) || 0);
  const avgOrderValue = orderValues.length > 0
    ? orderValues.reduce((s, v) => s + v, 0) / orderValues.length
    : null;
  const lastOrderDate = orders.length > 0 ? orders[0].date : null;

  let purchaseFrequency = "One-time buyer";
  if (orders.length >= 5) purchaseFrequency = "Frequent buyer";
  else if (orders.length >= 2) purchaseFrequency = "Repeat buyer";
  else if (orders.length === 0) purchaseFrequency = "No purchases yet";

  // Churn risk
  let churnRisk = "low";
  let churnReason = "";
  if (customer.last_active_at) {
    const daysSinceActive = Math.floor((now - new Date(customer.last_active_at).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceActive > 90 && orders.length > 0) {
      churnRisk = "high";
      churnReason = `No activity in ${daysSinceActive} days despite being a customer`;
    } else if (daysSinceActive > 60) {
      churnRisk = "medium";
      churnReason = `No activity in ${daysSinceActive} days`;
    }
  }

  // Sentiment from intents
  const intents = incomingMessages.map(m => m.intent).filter(Boolean);
  const hasComplaint = intents.includes("complaint") || intents.includes("return");
  const sentiment = hasComplaint ? "negative" : (orders.length > 0 ? "positive" : "neutral");

  // Next best action
  let nextAction = "Follow up to re-engage";
  let nextReason = "No specific trigger — general check-in";
  let nextPriority = "low";
  if (churnRisk === "high") {
    nextAction = "Send win-back message with discount";
    nextReason = churnReason;
    nextPriority = "high";
  } else if (orders.length === 0 && incomingMessages.length > 0) {
    nextAction = "Recommend products based on their inquiries";
    nextReason = "Has shown interest but hasn't purchased yet";
    nextPriority = "medium";
  } else if (lastOrderDate) {
    const daysSinceOrder = Math.floor((now - new Date(lastOrderDate).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceOrder > 30 && orders.length >= 2) {
      nextAction = "Follow up on last order — ask if they need anything else";
      nextReason = `It's been ${daysSinceOrder} days since their last order`;
      nextPriority = "medium";
    }
  }

  // Key facts
  const keyFacts = [];
  if (customer.tags && customer.tags.length > 0) keyFacts.push(`Tagged: ${customer.tags.join(", ")}`);
  if (orders.length > 0) keyFacts.push(`${orders.length} order${orders.length === 1 ? "" : "s"} totaling ${customer.total_spent}`);
  if (incomingMessages.length > 0) keyFacts.push(`${incomingMessages.length} messages exchanged`);
  if (notes && notes.length > 0) keyFacts.push(`${notes.length} internal note${notes.length === 1 ? "" : "s"}`);
  if (customer.lifecycle_stage) keyFacts.push(`Lifecycle stage: ${customer.lifecycle_stage}`);
  if (customer.ai_memory) keyFacts.push(`Previous AI memory: ${customer.ai_memory.slice(0, 100)}`);

  return {
    summary: `${customer.name || "This customer"} is a ${purchaseFrequency.toLowerCase()} ${customer.lifecycle_stage || "customer"} who prefers ${preferredChannel}.`,
    communication_preferences: {
      preferred_channel: preferredChannel,
      typical_reply_time: replyTimeStr,
      language: "unknown",
    },
    buying_behavior: {
      avg_order_value: avgOrderValue ? Math.round(avgOrderValue * 100) / 100 : null,
      purchase_frequency: purchaseFrequency,
      last_order_date: lastOrderDate,
      total_lifetime_value: Number(customer.total_spent) || 0,
      preferred_products: [],
    },
    interests: (customer.tags || []),
    sentiment: sentiment,
    risk_level: {
      churn_risk: churnRisk,
      reason: churnReason || "No significant risk factors detected",
    },
    satisfaction_signals: hasComplaint ? ["Has complained or requested a return"] : [],
    next_best_action: {
      action: nextAction,
      reason: nextReason,
      priority: nextPriority,
    },
    key_facts: keyFacts.length > 0 ? keyFacts : ["No significant data available yet"],
  };
}
