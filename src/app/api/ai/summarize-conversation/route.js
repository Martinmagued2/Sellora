import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { getAuthUser } from "@/lib/auth-helper";
import { checkRateLimit, createRateLimitKey } from "@/lib/rate-limit";

// Service role client (lazy-initialized)
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
 * Build provider chain for text generation
 */
function buildProviderChain() {
  const providers = [];

  if (process.env.VECTORENGINE_API_KEY) {
    const customOpenAI = createOpenAI({
      apiKey: process.env.VECTORENGINE_API_KEY,
      baseURL: process.env.VECTORENGINE_BASE_URL || "https://api.vectorengine.ai/v1",
      compatibility: "compatible",
    });
    providers.push({ name: 'vectorengine', model: customOpenAI("gpt-5.5-pro") });
  }

  if (process.env.GROQ_API_KEY) {
    const groqProvider = createGroq();
    providers.push({ name: 'groq', model: groqProvider("qwen-qwq-32b") });
  }

  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    try {
      const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
      providers.push({ name: 'google', model: google("gemini-2.0-flash") });
    } catch (e) {}
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const { openai } = require("@ai-sdk/openai");
      providers.push({ name: 'openai', model: openai("gpt-4o-mini") });
    } catch (e) {}
  }

  return providers;
}

/**
 * POST /api/ai/summarize-conversation
 * Generates a summary of a conversation with a customer.
 */
export async function POST(req) {
  try {
    // 🔒 SECURITY: Auth required — was previously public (IDOR + AI credit drain)
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 🔒 Rate limit: 5 summaries per minute per user
    const rlKey = `ai-summarize:${user.id}`;
    const rl = checkRateLimit(rlKey, 5, 60_000);
    if (rl.limited) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const { conversation_id } = body;

    if (!conversation_id) {
      return NextResponse.json({ error: "conversation_id is required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Fetch conversation with messages — 🔒 filtered by account_id to prevent IDOR
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("id, channel, status, tags, summary, customer:customers(name)")
      .eq("id", conversation_id)
      .eq("account_id", user.id)  // 🔒 IDOR fix
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Fetch messages for the conversation
    const { data: messages, error: msgsError } = await supabase
      .from("messages")
      .select("content, direction, is_ai, created_at, intent")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: true })
      .limit(50);

    if (msgsError || !messages || messages.length === 0) {
      return NextResponse.json({ error: "No messages found in this conversation" }, { status: 404 });
    }

    // Format conversation for the AI
    const conversationText = messages
      .map((msg) => {
        const role = msg.direction === "incoming" ? "Customer" : msg.is_ai ? "AI" : "Agent";
        return `${role}: ${msg.content}`;
      })
      .join("\n");

    const prompt = `Summarize this customer conversation in a concise, actionable format. Include:
1. What the customer asked about
2. What products they were interested in or ordered
3. Current order status (if any)
4. Any unresolved issues or pending actions

Customer: ${conversation.customer?.name || "Unknown"}
Channel: ${conversation.channel}
Status: ${conversation.status}
Tags: ${(conversation.tags || []).join(", ") || "None"}

Conversation:
${conversationText}

Provide a brief summary (2-3 sentences) like: "This customer asked about X, ordered Y, hasn't paid yet" or "Customer inquired about product Z, AI recommended options, no order placed."`;

    const providers = buildProviderChain();

    if (providers.length === 0) {
      return NextResponse.json({ error: "No AI providers configured" }, { status: 500 });
    }

    let summary = null;
    let lastError = null;

    for (const provider of providers) {
      try {
        const result = await generateText({
          model: provider.model,
          prompt,
          maxTokens: 200,
        });
        summary = result.text;
        if (summary && summary.trim()) break;
      } catch (providerError) {
        lastError = providerError;
        console.warn(`[summarize-conversation] ${provider.name} failed:`, providerError.message);
      }
    }

    if (!summary) {
      return NextResponse.json({ error: "Failed to generate summary", details: lastError?.message }, { status: 500 });
    }

    // Save summary to conversation
    await supabase
      .from("conversations")
      .update({ summary: summary.trim() })
      .eq("id", conversation_id);

    return NextResponse.json({
      success: true,
      summary: summary.trim(),
      conversation_id,
      customer_name: conversation.customer?.name,
    });
  } catch (error) {
    console.error("Summarize conversation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
