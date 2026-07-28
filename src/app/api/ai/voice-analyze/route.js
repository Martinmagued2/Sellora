/**
 * POST /api/ai/voice-analyze
 *
 * AI Voice Calls — analyzes a voice note (already transcribed) to:
 *   - Summarize the content
 *   - Extract action items
 *   - Identify customer mood
 *   - Detect urgency
 *   - Suggest next steps
 *
 * Workflow:
 *   1. Customer sends a voice note in a conversation
 *   2. /api/messages/transcribe converts audio → text
 *   3. This endpoint takes that text + context and produces structured analysis
 *
 * Body:
 *   {
 *     transcription: "the transcribed text",
 *     conversation_id: "uuid",  // optional, for context
 *     customer_name: "Sarah",   // optional
 *     language: "en" | "ar"     // optional, auto-detected otherwise
 *   }
 *
 * Response:
 *   {
 *     summary: "1-2 sentence summary",
 *     action_items: [{ task, priority, due }],
 *     customer_mood: "positive" | "neutral" | "frustrated" | "angry" | "excited",
 *     urgency: "low" | "medium" | "high",
 *     key_topics: ["shipping", "refund", "product quality"],
 *     suggested_reply: "a text reply the operator can send",
 *     next_steps: ["specific action 1", "specific action 2"],
 *     ai_powered: true
 *   }
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

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { transcription, conversation_id, customer_name, language } = await req.json();

    if (!transcription || typeof transcription !== "string" || transcription.trim().length < 5) {
      return NextResponse.json({ error: "transcription is required (min 5 chars)" }, { status: 400 });
    }

    // Fetch conversation context if provided
    let context = null;
    if (conversation_id) {
      const db = admin();
      const { data: conv } = await db
        .from("conversations")
        .select("id, account_id, channel, customer:customers(id, name, total_orders, total_spent)")
        .eq("id", conversation_id)
        .maybeSingle();

      if (conv) {
        const hasAccess = await canAccessAccount(user, conv.account_id);
        if (!hasAccess) {
          return NextResponse.json({ error: "You do not have access to this conversation" }, { status: 403 });
        }
        context = conv;
      }
    }

    // Try AI analysis
    const model = buildStandaloneProvider();
    if (!model) {
      const ruleBased = ruleBasedAnalysis(transcription, customer_name, context);
      return NextResponse.json({ ...ruleBased, ai_powered: false });
    }

    const systemPrompt = `You are an AI voice note analyzer. The customer sent a voice note that has been transcribed. Analyze it and produce a structured summary.

Return ONLY a JSON object:
{
  "summary": "1-2 sentence summary of what the customer said",
  "action_items": [
    {
      "task": "specific action to take",
      "priority": "high" | "medium" | "low",
      "due": "when it should be done (e.g., 'today', 'tomorrow', 'within 24h', or null)"
    }
  ],
  "customer_mood": "positive" | "neutral" | "frustrated" | "angry" | "excited",
  "urgency": "low" | "medium" | "high",
  "key_topics": ["topic1", "topic2"],
  "suggested_reply": "a text reply the operator can send (acknowledging the voice note)",
  "next_steps": ["specific step 1", "specific step 2"]
}

Rules:
1. action_items: extract concrete tasks (e.g., "Check order #1234 status", "Call customer about refund")
2. customer_mood: based on tone words, not just content
3. urgency: high = needs response within hours, medium = today, low = whenever
4. key_topics: 2-5 main topics discussed
5. suggested_reply: should acknowledge they sent a voice note and address their concern
6. next_steps: actionable items for the operator
7. Return ONLY JSON, no markdown`;

    const contextStr = context ? `
Context:
- Customer: ${context.customer?.name || customer_name || "Unknown"}
- Channel: ${context.channel}
- Total orders: ${context.customer?.total_orders || 0}
- Total spent: ${context.customer?.total_spent || 0}
` : `
Context:
- Customer: ${customer_name || "Unknown"}
`;

    const userPrompt = `Analyze this voice note transcription:${contextStr}

Transcription:
"${transcription}"

${language ? `Language: ${language}` : "Language: auto-detect"}`;

    try {
      const result = await generateText({
        model,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.3,
        maxTokens: 700,
      });

      const text = result.text.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
      const analysis = JSON.parse(text);

      return NextResponse.json({
        ...analysis,
        ai_powered: true,
        generated_at: new Date().toISOString(),
      });
    } catch (llmErr) {
      console.warn("[VOICE-ANALYZE] LLM failed, using rules:", llmErr.message);
      const ruleBased = ruleBasedAnalysis(transcription, customer_name, context);
      return NextResponse.json({ ...ruleBased, ai_powered: false });
    }
  } catch (e) {
    console.error("[VOICE-ANALYZE] error:", e.message);
    return NextResponse.json({ error: "Server error: " + e.message }, { status: 500 });
  }
}

/**
 * Rule-based analysis fallback.
 */
function ruleBasedAnalysis(transcription, customerName, context) {
  const text = transcription.toLowerCase();
  const actionItems = [];
  const keyTopics = [];
  let mood = "neutral";
  let urgency = "low";

  // Mood detection
  if (/angry|frustrat|annoyed|ridiculous|unacceptable|fed up/.test(text)) {
    mood = "angry";
    urgency = "high";
  } else if (/disappointed|upset|concerned|worried|not happy/.test(text)) {
    mood = "frustrated";
    urgency = "medium";
  } else if (/excited|love|amazing|fantastic|great|awesome|thank/.test(text)) {
    mood = "excited";
  } else if (/happy|good|nice|pleased/.test(text)) {
    mood = "positive";
  }

  // Urgency keywords
  if (/urgent|asap|immediately|emergency|right now|today/.test(text)) {
    urgency = "high";
  } else if (/tomorrow|soon|this week|quickly/.test(text)) {
    urgency = "medium";
  }

  // Topic detection
  if (/order|deliver|shipp|track|package/.test(text)) keyTopics.push("order_delivery");
  if (/refund|return|money back|cancel/.test(text)) keyTopics.push("refund_return");
  if (/price|cost|discount|deal|offer|cheap/.test(text)) keyTopics.push("pricing");
  if (/product|item|quality|broken|damaged|defective/.test(text)) keyTopics.push("product_issue");
  if (/support|help|issue|problem|broken|not working/.test(text)) keyTopics.push("support");

  // Action items
  if (keyTopics.includes("order_delivery")) {
    actionItems.push({
      task: "Check order status and provide tracking info",
      priority: urgency,
      due: urgency === "high" ? "within 2h" : "today",
    });
  }
  if (keyTopics.includes("refund_return")) {
    actionItems.push({
      task: "Process refund/return request",
      priority: "high",
      due: "within 24h",
    });
  }
  if (keyTopics.includes("product_issue")) {
    actionItems.push({
      task: "Investigate product issue and offer replacement/fix",
      priority: urgency,
      due: urgency === "high" ? "today" : "within 48h",
    });
  }
  if (keyTopics.includes("pricing")) {
    actionItems.push({
      task: "Share pricing details and any available discounts",
      priority: "medium",
      due: "today",
    });
  }

  if (actionItems.length === 0) {
    actionItems.push({
      task: "Review voice note and respond to customer",
      priority: urgency,
      due: "today",
    });
  }

  // Suggested reply
  const greeting = customerName ? `Hi ${customerName.split(" ")[0]}` : "Hi";
  let reply = `${greeting}! Thanks for your voice note. I've listened to it and `;
  if (keyTopics.includes("order_delivery")) {
    reply += "I'm checking your order status right now. I'll get back to you with tracking info within the hour.";
  } else if (keyTopics.includes("refund_return")) {
    reply += "I understand you'd like a refund. I'm processing your request now and will confirm the details shortly.";
  } else if (keyTopics.includes("product_issue")) {
    reply += "I'm sorry about the product issue. I'm looking into this right now and will get back to you with a solution today.";
  } else if (keyTopics.includes("pricing")) {
    reply += "I'd be happy to help with pricing! Let me send you the details — what specific product are you interested in?";
  } else {
    reply += "I'll get back to you as soon as possible with a proper response.";
  }

  return {
    summary: transcription.slice(0, 150) + (transcription.length > 150 ? "..." : ""),
    action_items: actionItems,
    customer_mood: mood,
    urgency,
    key_topics: keyTopics.length > 0 ? keyTopics : ["general"],
    suggested_reply: reply,
    next_steps: actionItems.map(a => a.task),
  };
}
