/**
 * GET /api/ai/inbox-zero
 *
 * AI Inbox Zero — analyzes all unread/waiting conversations and groups them
 * by similarity so the operator can clear their inbox in minutes.
 *
 * Groups conversations that can be answered with the SAME reply (e.g.,
 * 5 customers all asking "what are your business hours?" → one bulk reply).
 *
 * For each group, generates:
 *   - group_label: "5 customers asking about shipping"
 *   - suggested_reply: a single reply that works for all of them
 *   - conversation_ids: list of conversation IDs in the group
 *   - customer_names: list of customer names
 *
 * Also returns a "morning plan":
 *   - total_conversations: N
 *   - estimated_time: "12 minutes"
 *   - groups: [...]
 *   - individual: [conversations that need unique replies]
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { getAuthUser } from "@/lib/auth-helper";
import { resolveEffectiveAccount } from "@/lib/team-auth";

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

    const { effectiveAccountId } = await resolveEffectiveAccount(user);
    if (!effectiveAccountId) return NextResponse.json({ error: "No account found" }, { status: 404 });

    const db = admin();

    // Fetch waiting + unread conversations
    const { data: conversations, error } = await db
      .from("conversations")
      .select(`
        id, channel, status, last_message_at,
        customer:customers(id, name, total_orders)
      `)
      .eq("account_id", effectiveAccountId)
      .in("status", ["new", "in_progress", "waiting_customer", "needs_attention"])
      .order("last_message_at", { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({
        total_conversations: 0,
        estimated_time: "0 minutes",
        groups: [],
        individual: [],
        message: "Inbox is already clear! 🎉",
      });
    }

    // Fetch last message for each conversation
    const convsWithMessages = await Promise.all(
      conversations.slice(0, 30).map(async (conv) => {
        const { data: lastMsg } = await db
          .from("messages")
          .select("content, direction, intent, created_at")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(2);
        const lastIncoming = (lastMsg || []).find(m => m.direction === "incoming") || (lastMsg || [])[0];
        return {
          ...conv,
          last_message: lastIncoming ? {
            content: (lastIncoming.content || "").slice(0, 200),
            intent: lastIncoming.intent,
          } : null,
        };
      })
    );

    // Group conversations
    const model = buildProvider();
    let groups = [];
    let individual = [];
    let aiPowered = false;

    if (model && convsWithMessages.length > 0) {
      try {
        const batch = convsWithMessages.map(c => ({
          id: c.id,
          customer: c.customer?.name || "Unknown",
          channel: c.channel,
          last_message: c.last_message?.content || "",
          intent: c.last_message?.intent,
        }));

        const systemPrompt = `You are an AI inbox organizer. Group conversations that can be answered with the SAME reply.

Return ONLY a JSON object:
{
  "groups": [
    {
      "label": "5 customers asking about shipping",
      "suggested_reply": "Hi! We offer free shipping on orders over $50. Delivery takes 2-3 business days. Let me know if you'd like to place an order!",
      "conversation_ids": ["uuid1", "uuid2", ...],
      "reason": "All asking similar questions about shipping/delivery"
    }
  ],
  "individual": [
    {
      "conversation_id": "uuid",
      "customer_name": "Sarah",
      "reason": "Unique question about her specific order — needs a personalized reply"
    }
  ]
}

Rules:
1. Only group conversations with genuinely similar intents (same question, same need)
2. Minimum 2 conversations per group
3. The suggested_reply should work for ALL conversations in the group — no personalization
4. Conversations that need unique replies go in "individual"
5. Maximum 5 groups (don't over-fragment)
6. Return ONLY JSON, no markdown`;

        const result = await generateText({
          model,
          system: systemPrompt,
          prompt: `Organize these conversations:\n\n${JSON.stringify(batch, null, 2)}`,
          temperature: 0.3,
          maxTokens: 1200,
        });

        const text = result.text.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
        const parsed = JSON.parse(text);
        groups = parsed.groups || [];
        individual = parsed.individual || [];
        aiPowered = true;
      } catch (llmErr) {
        console.warn("[INBOX-ZERO] LLM failed, using rules:", llmErr.message);
        const ruleBased = ruleBasedGrouping(convsWithMessages);
        groups = ruleBased.groups;
        individual = ruleBased.individual;
      }
    } else {
      const ruleBased = ruleBasedGrouping(convsWithMessages);
      groups = ruleBased.groups;
      individual = ruleBased.individual;
    }

    // Estimate time: 30 seconds per group + 2 minutes per individual
    const totalSeconds = groups.length * 30 + individual.length * 120;
    const estimatedTime = totalSeconds < 60
      ? `${totalSeconds} seconds`
      : `${Math.ceil(totalSeconds / 60)} minutes`;

    return NextResponse.json({
      total_conversations: convsWithMessages.length,
      estimated_time: estimatedTime,
      groups,
      individual,
      ai_powered: aiPowered,
      generated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[INBOX-ZERO] error:", e.message);
    return NextResponse.json({ error: "Server error: " + e.message }, { status: 500 });
  }
}

/**
 * Rule-based grouping fallback.
 */
function ruleBasedGrouping(conversations) {
  const groups = [];
  const individual = [];
  const grouped = new Set();

  // Group by intent
  const byIntent = new Map();
  for (const conv of conversations) {
    const intent = conv.last_message?.intent || "general";
    if (!byIntent.has(intent)) byIntent.set(intent, []);
    byIntent.get(intent).push(conv);
  }

  const intentReplies = {
    price_inquiry: {
      label: "Customers asking about pricing",
      reply: "Hi! Thanks for your interest. Our prices are listed on our website. Would you like me to send you the link or help you place an order?",
    },
    order_status: {
      label: "Customers asking about order status",
      reply: "Hi! I'd be happy to check your order status. Could you share your order number so I can look it up for you?",
    },
    product_info: {
      label: "Customers asking about products",
      reply: "Hi! I'd love to help you find what you're looking for. Could you tell me a bit more about what you need so I can recommend the best option?",
    },
    shipping: {
      label: "Customers asking about shipping",
      reply: "Hi! We offer shipping with delivery in 2-3 business days. Free shipping on orders over $50. Would you like to place an order?",
    },
    general: {
      label: "General inquiries",
      reply: "Hi! Thanks for reaching out. How can I help you today?",
    },
  };

  for (const [intent, convs] of byIntent) {
    if (convs.length >= 2) {
      const template = intentReplies[intent] || intentReplies.general;
      groups.push({
        label: `${convs.length} ${template.label.toLowerCase()}`,
        suggested_reply: template.reply,
        conversation_ids: convs.map(c => c.id),
        customer_names: convs.map(c => c.customer?.name || "Unknown"),
        reason: `All have intent: ${intent}`,
      });
      convs.forEach(c => grouped.add(c.id));
    }
  }

  // Add ungrouped to individual
  for (const conv of conversations) {
    if (!grouped.has(conv.id)) {
      individual.push({
        conversation_id: conv.id,
        customer_name: conv.customer?.name || "Unknown",
        last_message: conv.last_message?.content?.slice(0, 80) || "",
        reason: "Unique question — needs a personalized reply",
      });
    }
  }

  return { groups, individual };
}
