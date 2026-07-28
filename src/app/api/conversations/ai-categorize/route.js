/**
 * GET /api/conversations/ai-categorize
 *
 * AI Inbox Smart Categorization — fetches open conversations, classifies each
 * into a business-grade category using an LLM, and returns them grouped.
 *
 * Categories:
 *   - hot_lead        — Customer showing buying signals (asking price, "how to order")
 *   - ready_to_buy    — High intent (asked about stock, shipping, payment)
 *   - angry           — Negative sentiment or complaint keywords
 *   - needs_attention — Escalated or waiting too long
 *   - loyal           — Repeat customer with positive history
 *   - cold            — No recent activity or low engagement
 *   - new_lead        — First-time contact, no purchase history
 *
 * The endpoint first tries an LLM batch classification. If no AI provider
 * is configured, it falls back to rule-based classification using message
 * intents, sentiment scores, and customer order history.
 *
 * Response:
 *   {
 *     categories: {
 *       hot_lead: [{ id, customer_name, channel, last_message, ... }],
 *       ready_to_buy: [...],
 *       angry: [...],
 *       ...
 *     },
 *     counts: { hot_lead: 3, ready_to_buy: 5, ... },
 *     ai_powered: true|false,
 *     generated_at: "..."
 *   }
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { getAuthUser } from "@/lib/auth-helper";
import { resolveEffectiveAccount } from "@/lib/team-auth";
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

    const { effectiveAccountId } = await resolveEffectiveAccount(user);
    if (!effectiveAccountId) return NextResponse.json({ error: "No account found" }, { status: 404 });

    const db = admin();

    // Fetch open conversations with customer + last message
    const { data: conversations, error } = await db
      .from("conversations")
      .select(`
        id, channel, status, last_message_at, created_at, summary,
        customer:customers(id, name, total_spent, total_orders, last_active_at, tags)
      `)
      .eq("account_id", effectiveAccountId)
      .in("status", ["new", "in_progress", "needs_attention", "waiting_customer"])
      .order("last_message_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({
        categories: {},
        counts: {},
        ai_powered: false,
        generated_at: new Date().toISOString(),
        message: "No open conversations to categorize.",
      });
    }

    // Fetch last message for each conversation
    const conversationsWithMessages = await Promise.all(
      (conversations || []).slice(0, 50).map(async (conv) => {
        const { data: lastMsg } = await db
          .from("messages")
          .select("content, direction, is_ai, intent, created_at")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(3);
        return {
          ...conv,
          recent_messages: (lastMsg || []).map(m => ({
            content: (m.content || "").slice(0, 200),
            direction: m.direction,
            intent: m.intent,
          })),
        };
      })
    );

    // Try AI categorization
    const model = buildStandaloneProvider();
    let categoryMap = {};  // conversation_id → category
    let aiPowered = false;

    if (model && conversationsWithMessages.length > 0) {
      try {
        const batch = conversationsWithMessages.map(c => ({
          id: c.id,
          customer: c.customer?.name || "Unknown",
          channel: c.channel,
          status: c.status,
          total_orders: c.customer?.total_orders || 0,
          total_spent: c.customer?.total_spent || 0,
          recent_messages: c.recent_messages,
        }));

        const systemPrompt = `You are an AI sales assistant that categorizes customer conversations for a business inbox.

Categorize each conversation into EXACTLY ONE of these categories:
- hot_lead: Customer is actively showing buying signals (asking price, "how to order", "I want this")
- ready_to_buy: High intent but needs a nudge (asked about stock, shipping, payment options)
- angry: Negative sentiment, complaint, or frustration
- needs_attention: Escalated, waiting too long, or marked needs_attention
- loyal: Repeat customer (total_orders > 1) with positive tone
- cold: No recent activity or very low engagement
- new_lead: First-time contact with no purchase history

Return ONLY a JSON object mapping conversation_id → category. No markdown, no explanation.
Example: {"uuid1": "hot_lead", "uuid2": "angry"}`;

        const result = await generateText({
          model,
          system: systemPrompt,
          prompt: `Categorize these conversations:\n\n${JSON.stringify(batch.slice(0, 30), null, 2)}`,
          temperature: 0.2,
          maxTokens: 1500,
        });

        const text = result.text.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
        categoryMap = JSON.parse(text);
        aiPowered = true;
      } catch (llmErr) {
        console.warn("[AI-CATEGORIZE] LLM failed, using rules:", llmErr.message);
      }
    }

    // Fall back to rule-based categorization if AI failed or wasn't available
    if (!aiPowered || Object.keys(categoryMap).length === 0) {
      categoryMap = ruleBasedCategorize(conversationsWithMessages);
    }

    // Group conversations by category
    const categories = {};
    const counts = {};
    for (const cat of CATEGORIES) {
      categories[cat] = [];
      counts[cat] = 0;
    }

    for (const conv of conversationsWithMessages) {
      const cat = categoryMap[conv.id] || "new_lead";
      if (!categories[cat]) {
        categories[cat] = [];
        counts[cat] = 0;
      }
      categories[cat].push({
        id: conv.id,
        customer_name: conv.customer?.name || "Unknown",
        channel: conv.channel,
        status: conv.status,
        last_message_at: conv.last_message_at,
        total_orders: conv.customer?.total_orders || 0,
        total_spent: conv.customer?.total_spent || 0,
        recent_message: conv.recent_messages?.[0]?.content?.slice(0, 100) || "",
      });
      counts[cat] = (counts[cat] || 0) + 1;
    }

    // Remove empty categories
    const filteredCategories = {};
    for (const [cat, items] of Object.entries(categories)) {
      if (items.length > 0) {
        filteredCategories[cat] = items;
      }
    }

    return NextResponse.json({
      categories: filteredCategories,
      counts,
      category_meta: CATEGORY_META,
      ai_powered: aiPowered,
      generated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[AI-CATEGORIZE] error:", e.message);
    return NextResponse.json({ error: "Server error: " + e.message }, { status: 500 });
  }
}

/**
 * Rule-based categorization fallback.
 * Uses message intents, customer order history, and conversation status.
 */
function ruleBasedCategorize(conversations) {
  const map = {};
  const now = Date.now();

  for (const conv of conversations) {
    const lastMsg = conv.recent_messages?.[0];
    const intent = lastMsg?.intent;
    const content = (lastMsg?.content || "").toLowerCase();
    const totalOrders = conv.customer?.total_orders || 0;
    const status = conv.status;
    const lastMsgTime = conv.last_message_at ? new Date(conv.last_message_at).getTime() : 0;
    const hoursSinceLastMsg = (now - lastMsgTime) / (1000 * 60 * 60);

    // Angry: complaint intent or negative keywords
    if (intent === "complaint" || intent === "return" ||
        /angry|frustrat|terrible|worst|hate|refund|cancel|broken|never again|disappointed/.test(content)) {
      map[conv.id] = "angry";
      continue;
    }

    // Needs attention: escalated status or waiting > 6 hours
    if (status === "needs_attention" || (status === "waiting_customer" && hoursSinceLastMsg > 6)) {
      map[conv.id] = "needs_attention";
      continue;
    }

    // Hot lead: price inquiry + order intent keywords
    if (intent === "price_inquiry" || intent === "order" ||
        /how (do|to) (order|buy)|i want (this|to buy)|place (an? )?order|how much|price|ready to (buy|order)|send (me )?(the )?(invoice|details)/.test(content)) {
      map[conv.id] = totalOrders > 0 ? "ready_to_buy" : "hot_lead";
      continue;
    }

    // Ready to buy: product info + stock/shipping questions
    if (intent === "product_info" || intent === "order_status" ||
        /stock|available|shipping|delivery|payment|cash on deliver|cod/.test(content)) {
      map[conv.id] = "ready_to_buy";
      continue;
    }

    // Loyal: repeat customer
    if (totalOrders >= 2) {
      map[conv.id] = "loyal";
      continue;
    }

    // Cold: no activity in 7+ days
    if (hoursSinceLastMsg > 24 * 7) {
      map[conv.id] = "cold";
      continue;
    }

    // New lead: first contact, no orders
    if (totalOrders === 0) {
      map[conv.id] = "new_lead";
      continue;
    }

    // Default
    map[conv.id] = "new_lead";
  }

  return map;
}
