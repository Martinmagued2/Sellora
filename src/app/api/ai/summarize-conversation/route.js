import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { generateText } from "ai";
import { getAuthUser } from "@/lib/auth-helper";
import { resolveEffectiveAccount } from "@/lib/team-auth";
import { buildStandaloneProvider } from "@/lib/ai/standalone-provider";

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

export async function POST(req) {
  try {
    // SECURITY: Require auth + verify the conversation belongs to the user's account.
    // Without this, ANY user could enumerate conversation UUIDs and read private
    // customer chats by calling this endpoint.
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve effective account (works for both owners and team members).
    const { effectiveAccountId } = await resolveEffectiveAccount(user);
    if (!effectiveAccountId) {
      return NextResponse.json({ error: "No account found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { conversation_id } = body;

    if (!conversation_id) {
      return NextResponse.json({ error: "conversation_id is required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Fetch conversation with messages — scoped to the user's account to prevent IDOR.
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("id, channel, status, tags, summary, customer:customers(name)")
      .eq("id", conversation_id)
      .eq("account_id", effectiveAccountId)  // SECURITY: ownership check
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
