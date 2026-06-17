/**
 * Conversation Summary API
 * POST /api/conversations/[id]/summary
 *
 * Generates an AI summary of a conversation (last ~50 messages).
 * Caches the summary on the conversations.summary column for 6 hours.
 * Auto-generates a summary when one doesn't exist or is stale (>6h).
 *
 * Also auto-triggers when a conversation has >20 messages and no summary yet.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { generateText } from "ai";
import { buildFullProviderChain } from "@/lib/ai/provider-chain";

let _adminClient = null;
function getAdminClient() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _adminClient;
}

const SUMMARY_STALE_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function POST(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: conversationId } = await params;
    const { force = false } = await req.json().catch(() => ({}));

    const admin = getAdminClient();

    // Verify ownership
    const { data: conv } = await admin
      .from("conversations")
      .select("id, account_id, summary, summary_generated_at, customer_id")
      .eq("id", conversationId)
      .single();

    if (!conv || conv.account_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Return cached summary if fresh
    if (!force && conv.summary && conv.summary_generated_at) {
      const age = Date.now() - new Date(conv.summary_generated_at).getTime();
      if (age < SUMMARY_STALE_MS) {
        return NextResponse.json({
          summary: conv.summary,
          generated_at: conv.summary_generated_at,
          cached: true,
        });
      }
    }

    // Fetch last 50 messages
    const { data: messages } = await admin
      .from("messages")
      .select("content, direction, is_ai, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(50);

    if (!messages || messages.length === 0) {
      return NextResponse.json({ summary: "No messages yet.", generated_at: new Date().toISOString() });
    }

    // Fetch customer name
    const { data: customer } = await admin
      .from("customers")
      .select("name")
      .eq("id", conv.customer_id)
      .single();

    // Build transcript
    const transcript = messages
      .map((m) => {
        const who = m.is_ai ? "AI" : m.direction === "outgoing" ? "Agent" : "Customer";
        return `${who}: ${m.content}`;
      })
      .join("\n");

    const prompt = `Summarize this customer conversation in 4-6 bullet points. Focus on:
- What the customer wanted
- Key decisions or commitments made
- Any unresolved issues or follow-ups needed
- Customer sentiment (positive/neutral/negative)
- Recommended next action for the operator

Customer: ${customer?.name || "Unknown"}

Conversation:
${transcript}

Reply with a concise summary in plain text (no markdown headers). Use • for bullets.`;

    // Try the provider chain
    let summary = "";
    try {
      const { text } = await generateText({
        model: buildFullProviderChain("fast"),
        system: "You are a helpful assistant that summarizes customer service conversations for human operators. Be concise and actionable.",
        prompt,
        maxTokens: 400,
      });
      summary = text || "";
    } catch (err) {
      console.error("[SUMMARY] AI failed:", err.message);
      // Fallback: simple template
      const incoming = messages.filter((m) => m.direction === "incoming").length;
      const aiCount = messages.filter((m) => m.is_ai).length;
      summary = `• ${messages.length} messages exchanged (${incoming} from customer, ${aiCount} AI replies)
• Conversation started ${new Date(messages[0].created_at).toLocaleString()}
• Last activity ${new Date(messages[messages.length - 1].created_at).toLocaleString()}
• Summary generation failed — please review the conversation manually.`;
    }

    // Cache the summary
    const now = new Date().toISOString();
    await admin
      .from("conversations")
      .update({
        summary,
        summary_generated_at: now,
      })
      .eq("id", conversationId);

    return NextResponse.json({
      summary,
      generated_at: now,
      cached: false,
    });
  } catch (err) {
    console.error("[SUMMARY] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
