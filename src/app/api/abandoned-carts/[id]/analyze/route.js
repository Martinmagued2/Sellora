/**
 * GET /api/abandoned-carts/[id]/analyze
 *
 * AI-powered analysis of WHY a customer abandoned their cart.
 *
 * Feeds the conversation transcript + cart contents + customer history to
 * the LLM with a structured-output prompt. Returns:
 *   - likely_reason: price_objection | slow_response | stock_issue |
 *                    shipping_concern | unanswered_question | distraction |
 *                    found_better_deal | payment_issue | other
 *   - confidence: 0-100
 *   - explanation: 1-2 sentence explanation
 *   - suggested_recovery_angle: how to win them back
 *   - personalized_message: a recovery message tailored to this situation
 *
 * Falls back to rule-based analysis if no AI provider is configured.
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

export async function GET(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const cartId = params.id;
    if (!cartId) {
      return NextResponse.json({ error: "Cart ID is required" }, { status: 400 });
    }

    const db = admin();

    // Fetch the cart
    const { data: cart, error: cartErr } = await db
      .from("abandoned_carts")
      .select("id, account_id, customer_id, customer_name, cart_value, cart_items, status, abandoned_at, recovery_message_sent, reminded_at")
      .eq("id", cartId)
      .maybeSingle();

    if (cartErr || !cart) {
      return NextResponse.json({ error: "Cart not found" }, { status: 404 });
    }

    // SECURITY: Verify access
    const hasAccess = await canAccessAccount(user, cart.account_id);
    if (!hasAccess) {
      return NextResponse.json({ error: "You do not have access to this cart" }, { status: 403 });
    }

    // Fetch customer + conversation + messages
    const [customerResult, convResult] = await Promise.all([
      cart.customer_id ? db.from("customers")
        .select("id, name, email, phone, total_spent, total_orders, tags")
        .eq("id", cart.customer_id)
        .maybeSingle() : Promise.resolve({ data: null }),
      cart.customer_id ? db.from("conversations")
        .select("id, channel, status")
        .eq("customer_id", cart.customer_id)
        .eq("account_id", cart.account_id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle() : Promise.resolve({ data: null }),
    ]);

    let messages = [];
    if (convResult.data?.id) {
      const { data: msgs } = await db.from("messages")
        .select("content, direction, is_ai, intent, created_at")
        .eq("conversation_id", convResult.data.id)
        .order("created_at", { ascending: true })
        .limit(30);
      messages = msgs || [];
    }

    // Parse cart items
    let cartItems = cart.cart_items;
    if (typeof cartItems === "string") {
      try { cartItems = JSON.parse(cartItems); } catch { cartItems = []; }
    }

    const context = {
      cart: {
        id: cart.id,
        value: cart.cart_value,
        items: cartItems,
        abandoned_at: cart.abandoned_at,
        status: cart.status,
        recovery_message_sent: cart.recovery_message_sent,
      },
      customer: customerResult.data ? {
        name: customerResult.data.name,
        total_spent: customerResult.data.total_spent,
        total_orders: customerResult.data.total_orders,
        tags: customerResult.data.tags,
      } : null,
      conversation: convResult.data ? {
        channel: convResult.data.channel,
        status: convResult.data.status,
      } : null,
      messages: messages.map(m => ({
        content: (m.content || "").slice(0, 200),
        direction: m.direction,
        intent: m.intent,
        is_ai: m.is_ai,
      })),
    };

    // Try AI analysis
    const model = buildStandaloneProvider();
    if (!model) {
      const ruleBased = ruleBasedAnalysis(context);
      return NextResponse.json({
        analysis: ruleBased,
        ai_powered: false,
        generated_at: new Date().toISOString(),
      });
    }

    const systemPrompt = `You are an AI e-commerce analyst. Analyze WHY this customer abandoned their cart based on the conversation, cart contents, and customer history.

Return ONLY a JSON object:
{
  "likely_reason": "price_objection" | "slow_response" | "stock_issue" | "shipping_concern" | "unanswered_question" | "distraction" | "found_better_deal" | "payment_issue" | "other",
  "confidence": <0-100>,
  "explanation": "1-2 sentences explaining your reasoning",
  "suggested_recovery_angle": "How to win them back (e.g., 'Offer a 10% discount', 'Address shipping concern directly', 'Send product photos')",
  "personalized_message": "A recovery message tailored to this specific situation. Sound human and empathetic, not pushy. Reference their specific cart items if possible."
}

Rules:
1. Base your analysis on EVIDENCE from the messages — don't guess
2. If there are no messages, the reason is likely "distraction" or "unanswered_question"
3. The personalized_message should be ready to send (include greeting, context, and a clear call to action)
4. Keep the message under 150 words
5. Return ONLY the JSON, no markdown`;

    let analysis;
    let aiPowered = true;

    try {
      const result = await generateText({
        model,
        system: systemPrompt,
        prompt: `Analyze this abandoned cart:\n\n${JSON.stringify(context, null, 2)}`,
        temperature: 0.4,
        maxTokens: 600,
      });

      const text = result.text.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
      analysis = JSON.parse(text);
    } catch (llmErr) {
      console.warn("[CART-ANALYZE] LLM failed, using rules:", llmErr.message);
      analysis = ruleBasedAnalysis(context);
      aiPowered = false;
    }

    return NextResponse.json({
      analysis,
      ai_powered: aiPowered,
      generated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[CART-ANALYZE] error:", e.message);
    return NextResponse.json({ error: "Server error: " + e.message }, { status: 500 });
  }
}

/**
 * Rule-based analysis fallback.
 */
function ruleBasedAnalysis(context) {
  const messages = context.messages || [];
  const allText = messages.map(m => (m.content || "").toLowerCase()).join(" ");

  let likelyReason = "distraction";
  let explanation = "No specific signals in the conversation — the customer likely got distracted.";
  let recoveryAngle = "Send a friendly reminder with a small discount to re-engage.";
  let confidence = 40;

  // Check for price concerns
  if (/expensive|too much|cheaper|price|cost|budget|afford/.test(allText)) {
    likelyReason = "price_objection";
    explanation = "Customer mentioned price or budget concerns in the conversation.";
    recoveryAngle = "Offer a 10-15% discount or a payment plan option.";
    confidence = 70;
  }
  // Check for shipping concerns
  else if (/shipping|delivery|how long|when.*arrive|shipping cost/.test(allText)) {
    likelyReason = "shipping_concern";
    explanation = "Customer asked about shipping or delivery times.";
    recoveryAngle = "Address shipping directly — offer free shipping or faster delivery.";
    confidence = 65;
  }
  // Check for stock issues
  else if (/out of stock|available|in stock|when.*back/.test(allText)) {
    likelyReason = "stock_issue";
    explanation = "Customer was concerned about product availability.";
    recoveryAngle = "Confirm restock date or suggest an alternative product.";
    confidence = 65;
  }
  // Check for slow response (last message from customer, no reply)
  else if (messages.length > 0 && messages[messages.length - 1].direction === "incoming") {
    likelyReason = "slow_response";
    explanation = "The customer's last message wasn't answered — they may have left due to slow response.";
    recoveryAngle = "Apologize for the delay and answer their question directly.";
    confidence = 60;
  }
  // Check for unanswered questions
  else if (messages.some(m => m.content?.endsWith("?"))) {
    likelyReason = "unanswered_question";
    explanation = "Customer asked a question that wasn't fully answered.";
    recoveryAngle = "Answer their question directly and offer to help complete the purchase.";
    confidence = 55;
  }

  const itemCount = Array.isArray(context.cart?.items) ? context.cart.items.length : 0;
  const itemList = Array.isArray(context.cart?.items)
    ? context.cart.items.map(i => i.name || i).join(", ")
    : "your items";

  const customerName = context.customer?.name || "there";
  const personalizedMessage = `Hi ${customerName}! I noticed you were interested in ${itemList} but didn't complete your order. ${recoveryAngle} Would you like me to help you finish checkout? I'm here if you have any questions!`;

  return {
    likely_reason: likelyReason,
    confidence,
    explanation,
    suggested_recovery_angle: recoveryAngle,
    personalized_message: personalizedMessage,
  };
}
