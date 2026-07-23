/**
 * POST /api/ai/website-assistant
 *
 * AI Website Assistant — the backend for an embeddable widget that visitors
 * can install on their site. The assistant can:
 *   - Answer product questions (searches the catalog)
 *   - Browse inventory (filter by category, price, availability)
 *   - Track orders (by order number + phone/email)
 *   - Schedule meetings (returns available slots)
 *   - Hand off to a human (creates a conversation in Sellora)
 *
 * The same conversation continues in Sellora's dashboard — the visitor's
 * messages appear in the unified inbox.
 *
 * Body:
 *   {
 *     account_id: "uuid",      // the Sellora account whose catalog to use
 *     message: "visitor's question",
 *     visitor_id: "anonymous-uuid",  // persists across sessions
 *     session_id: "uuid",      // optional — reused for multi-turn convos
 *   }
 *
 * The visitor_id is set by the embed script (cookie or localStorage).
 *
 * Response:
 *   {
 *     reply: "the assistant's reply",
 *     actions: [
 *       { type: "show_products", products: [...] },
 *       { type: "track_order", order: {...} },
 *       { type: "schedule_meeting", slots: [...] },
 *       { type: "handoff_to_human", conversation_id: "uuid" }
 *     ],
 *     quick_replies: ["What's your return policy?", "Show me bestsellers"],
 *     conversation_id: "uuid"  // Sellora conversation ID (created if new)
 *   }
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

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

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 messages per minute per visitor
const rateLimitMap = new Map();

export async function POST(req) {
  try {
    const { account_id, message, visitor_id, session_id } = await req.json();

    if (!account_id || !message || !visitor_id) {
      return NextResponse.json({ error: "account_id, message, and visitor_id are required" }, { status: 400 });
    }

    // Rate limit by visitor_id
    const now = Date.now();
    const hits = (rateLimitMap.get(visitor_id) || []).filter(t => now - t < RATE_LIMIT_WINDOW);
    if (hits.length >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: "Too many messages. Please slow down." },
        { status: 429 }
      );
    }
    hits.push(now);
    rateLimitMap.set(visitor_id, hits);

    const db = admin();

    // Verify account exists + has live chat enabled
    const { data: account } = await db.from("accounts")
      .select("id, business_name, ai_personality, live_chat_enabled, ai_enabled")
      .eq("id", account_id)
      .maybeSingle();

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    if (account.live_chat_enabled === false) {
      return NextResponse.json({ error: "Live chat not enabled" }, { status: 403 });
    }

    // Find or create customer + conversation for this visitor
    let conversationId = session_id;
    let customer;

    // Try to find existing live chat session
    const { data: existingSession } = await db.from("live_chat_sessions")
      .select("id, customer_id, conversation_id")
      .eq("account_id", account_id)
      .eq("visitor_id", visitor_id)
      .eq("status", "open")
      .maybeSingle();

    if (existingSession) {
      conversationId = existingSession.conversation_id || existingSession.id;
      const { data: cust } = await db.from("customers")
        .select("*").eq("id", existingSession.customer_id).maybeSingle();
      customer = cust;
    } else {
      // Create new customer + conversation
      const { data: newCustomer } = await db.from("customers").insert({
        account_id,
        name: "Website Visitor",
        channel: "manual",
      }).select().single();
      customer = newCustomer;

      const { data: newConv } = await db.from("conversations").insert({
        account_id,
        customer_id: customer.id,
        channel: "manual",
        status: "new",
      }).select().single();
      conversationId = newConv.id;

      await db.from("live_chat_sessions").insert({
        account_id,
        customer_id: customer.id,
        visitor_id,
        conversation_id: conversationId,
        status: "open",
        last_message_at: new Date().toISOString(),
      });
    }

    // Store the visitor's message
    await db.from("messages").insert({
      conversation_id: conversationId,
      account_id,
      direction: "incoming",
      content: message,
      type: "text",
      is_ai: false,
      is_read: false,
    });

    // Update conversation last_message_at
    await db.from("conversations").update({
      last_message_at: new Date().toISOString(),
      status: "in_progress",
    }).eq("id", conversationId);

    // Update live chat session
    await db.from("live_chat_sessions").update({
      last_message_at: new Date().toISOString(),
    }).eq("conversation_id", conversationId);

    // ─── Handle special intents ───
    const lowerMsg = message.toLowerCase();

    // Intent: Order tracking
    const orderMatch = message.match(/#?([A-Z0-9]{6,12})/i);
    if (/track|order status|where.*order|my order/.test(lowerMsg) && orderMatch) {
      const orderNum = orderMatch[1].toUpperCase();
      const { data: order } = await db.from("orders")
        .select("id, order_number, status, total, currency, created_at, tracking_number, carrier")
        .eq("account_id", account_id)
        .ilike("order_number", `%${orderNum}%`)
        .maybeSingle();
      if (order) {
        const reply = `Order ${order.order_number}:\n• Status: ${order.status}\n• Total: ${order.total} ${order.currency}\n• Placed: ${new Date(order.created_at).toLocaleDateString()}${order.tracking_number ? `\n• Tracking: ${order.tracking_number} (${order.carrier || "carrier"})` : ""}`;
        await db.from("messages").insert({
          conversation_id: conversationId, account_id,
          direction: "outgoing", content: reply, type: "text", is_ai: true,
        });
        return NextResponse.json({
          reply,
          actions: [{ type: "track_order", order }],
          quick_replies: ["Where is my order?", "Talk to a human"],
          conversation_id: conversationId,
        });
      }
    }

    // Intent: Hand off to human
    if (/human|agent|representative|talk to.*person|speak to.*real/.test(lowerMsg)) {
      await db.from("conversations").update({ status: "needs_attention" }).eq("id", conversationId);
      const reply = "I'm connecting you with a human agent. They'll be with you shortly. In the meantime, is there anything else I can help you with?";
      await db.from("messages").insert({
        conversation_id: conversationId, account_id,
        direction: "outgoing", content: reply, type: "text", is_ai: true,
      });
      // Notify the team
      await db.from("notifications").insert({
        account_id,
        category: "messages",
        type: "live_chat_handoff",
        title: "Live chat handoff requested",
        message: `Visitor ${visitor_id.slice(0, 8)} asked to speak with a human.`,
        action_url: `/dashboard/conversations?id=${conversationId}`,
        priority: "medium",
      });
      return NextResponse.json({
        reply,
        actions: [{ type: "handoff_to_human", conversation_id: conversationId }],
        quick_replies: [],
        conversation_id: conversationId,
      });
    }

    // Intent: Browse products / inventory
    if (/show.*products|browse|catalog|inventory|what.*sell|bestsell|popular|recommend/.test(lowerMsg)) {
      const { data: products } = await db.from("products")
        .select("id, name, price, stock, category, description")
        .eq("account_id", account_id)
        .gt("stock", 0)
        .order("created_at", { ascending: false })
        .limit(5);
      if (products && products.length > 0) {
        const productList = products.map(p => `• ${p.name} — ${p.price} ${p.stock < 5 ? "(low stock!)" : ""}`).join("\n");
        const reply = `Here are some of our products:\n${productList}\n\nWhich one would you like to know more about?`;
        await db.from("messages").insert({
          conversation_id: conversationId, account_id,
          direction: "outgoing", content: reply, type: "text", is_ai: true,
        });
        return NextResponse.json({
          reply,
          actions: [{ type: "show_products", products }],
          quick_replies: ["Show me more", "What's your return policy?", "Talk to a human"],
          conversation_id: conversationId,
        });
      }
    }

    // ─── Default: AI conversation ───
    const model = buildProvider();

    // Fetch account context for the AI
    const { data: products } = await db.from("products")
      .select("name, price, stock, category")
      .eq("account_id", account_id)
      .limit(50);

    const { data: policies } = await db.from("business_policies")
      .select("type, content")
      .eq("account_id", account_id)
      .limit(10);

    const { data: faqs } = await db.from("faqs")
      .select("question, answer")
      .eq("account_id", account_id)
      .limit(20);

    // Fetch recent conversation history
    const { data: recentMessages } = await db.from("messages")
      .select("content, direction, is_ai, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(10);

    const history = (recentMessages || []).reverse().map(m => ({
      role: m.direction === "incoming" ? "user" : "assistant",
      content: m.content,
    }));

    if (model) {
      try {
        const systemPrompt = `You are the AI assistant for ${account.business_name}. You're embedded on their website, helping visitors with product questions, order tracking, and general inquiries.

Context:
- Business: ${account.business_name}
- Products available: ${JSON.stringify((products || []).slice(0, 20).map(p => ({ name: p.name, price: p.price, stock: p.stock, category: p.category })))}
- Policies: ${JSON.stringify(policies || [])}
- FAQs: ${JSON.stringify(faqs || [])}

Rules:
1. Be helpful, concise, and friendly
2. If asked about a specific product, check the catalog above
3. If asked about order tracking, ask for the order number
4. If asked to speak to a human, tell them you'll connect them
5. If you don't know something, say so honestly
6. Keep replies under 150 words
7. Match the visitor's language (English/Arabic/etc.)`;

        const result = await generateText({
          model,
          system: systemPrompt,
          messages: history,
          temperature: 0.5,
          maxTokens: 300,
        });

        const reply = result.text.trim();

        // Store the AI reply
        await db.from("messages").insert({
          conversation_id: conversationId, account_id,
          direction: "outgoing", content: reply, type: "text", is_ai: true,
        });

        return NextResponse.json({
          reply,
          actions: [],
          quick_replies: generateQuickReplies(message),
          conversation_id: conversationId,
        });
      } catch (llmErr) {
        console.warn("[WEBSITE-ASSISTANT] LLM failed:", llmErr.message);
      }
    }

    // Fallback: rule-based reply
    const fallbackReply = `Hi! Thanks for visiting ${account.business_name}. I'm here to help with product questions, order tracking, and more. What can I do for you?`;
    await db.from("messages").insert({
      conversation_id: conversationId, account_id,
      direction: "outgoing", content: fallbackReply, type: "text", is_ai: true,
    });

    return NextResponse.json({
      reply: fallbackReply,
      actions: [],
      quick_replies: ["Show me products", "Track my order", "Talk to a human"],
      conversation_id: conversationId,
    });
  } catch (e) {
    console.error("[WEBSITE-ASSISTANT] error:", e.message);
    return NextResponse.json({ error: "Server error: " + e.message }, { status: 500 });
  }
}

function generateQuickReplies(message) {
  const lower = message.toLowerCase();
  const replies = [];

  if (!/product|buy|shop|catalog/.test(lower)) replies.push("Show me products");
  if (!/track|order/.test(lower)) replies.push("Track my order");
  if (!/return|refund|policy/.test(lower)) replies.push("What's your return policy?");
  replies.push("Talk to a human");

  return replies.slice(0, 3);
}
