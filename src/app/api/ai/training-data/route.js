/**
 * GET /api/ai/training-data
 *
 * Exports positive-feedback AI message pairs as JSONL for fine-tuning.
 *
 * Returns conversation turns where the AI's reply received positive feedback
 * (thumbs up). These can be used to fine-tune a model on the business's
 * specific tone and knowledge.
 *
 * Response format: JSONL (one JSON object per line)
 *   {"messages": [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { resolveEffectiveAccount } from "@/lib/team-auth";

let _admin = null;
function admin() {
  if (!_admin) _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { effectiveAccountId } = await resolveEffectiveAccount(user);
    if (!effectiveAccountId) return NextResponse.json({ error: "No account found" }, { status: 404 });

    const db = admin();

    // Fetch AI messages with positive feedback
    const { data: feedback, error: fbErr } = await db
      .from("ai_message_feedback")
      .select("message_id, rating, reason")
      .eq("rating", "up")
      .limit(500);

    if (fbErr || !feedback || feedback.length === 0) {
      return NextResponse.json({
        training_examples: [],
        count: 0,
        message: "No positive feedback found. Encourage your team to rate AI replies to build training data.",
      });
    }

    const messageIds = feedback.map(f => f.message_id);

    // Fetch the AI messages + preceding user messages
    const { data: aiMessages } = await db
      .from("messages")
      .select("id, content, conversation_id, created_at, account_id")
      .in("id", messageIds)
      .eq("is_ai", true);

    const trainingExamples = [];
    for (const aiMsg of (aiMessages || [])) {
      // Fetch the preceding user message
      const { data: userMsgs } = await db
        .from("messages")
        .select("content, created_at")
        .eq("conversation_id", aiMsg.conversation_id)
        .eq("direction", "incoming")
        .lt("created_at", aiMsg.created_at)
        .order("created_at", { ascending: false })
        .limit(1);

      const userMsg = userMsgs?.[0];
      if (!userMsg || !userMsg.content) continue;

      // Fetch account context for system prompt
      const { data: account } = await db
        .from("accounts")
        .select("business_name, ai_personality, country, currency")
        .eq("id", aiMsg.account_id)
        .maybeSingle();

      const systemContent = `You are the AI assistant for ${account?.business_name || "a store"}. ${account?.ai_personality || "Be helpful and professional."} Country: ${account?.country || "Egypt"}. Currency: ${account?.currency || "EGP"}.`;

      trainingExamples.push({
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userMsg.content },
          { role: "assistant", content: aiMsg.content },
        ],
      });
    }

    // Return as JSONL (for OpenAI fine-tuning API)
    const jsonl = trainingExamples.map(ex => JSON.stringify(ex)).join("\n");

    return new Response(jsonl, {
      status: 200,
      headers: {
        "Content-Type": "application/jsonl",
        "Content-Disposition": `attachment; filename="sellora_training_data_${Date.now()}.jsonl"`,
      },
    });
  } catch (e) {
    console.error("[TRAINING-DATA] error:", e.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
