/**
 * AI Feedback Stats API
 * GET /api/ai-feedback/stats?range=7d
 *
 * Returns:
 *   - Total up/down ratings
 *   - Top 10 worst-rated AI messages (for weekly review)
 *   - Trend over time (last N days)
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";

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

const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90 };

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const rangeKey = searchParams.get("range") || "7d";
    const days = RANGE_DAYS[rangeKey] || 7;
    const since = new Date(Date.now() - days * 86400_000).toISOString();

    const admin = getAdminClient();

    // Aggregate counts
    const { data: stats } = await admin
      .from("ai_message_feedback")
      .select("rating, created_at")
      .eq("account_id", user.id)
      .gte("created_at", since);

    const totalUp = (stats || []).filter((s) => s.rating === "up").length;
    const totalDown = (stats || []).filter((s) => s.rating === "down").length;
    const total = totalUp + totalDown;
    const satisfactionRate = total > 0 ? Math.round((totalUp / total) * 100) : null;

    // Daily trend
    const trend = {};
    (stats || []).forEach((s) => {
      const day = s.created_at.slice(0, 10);
      trend[day] = trend[day] || { up: 0, down: 0 };
      trend[day][s.rating]++;
    });
    const trendArray = Object.entries(trend)
      .map(([day, v]) => ({ day, ...v }))
      .sort((a, b) => a.day.localeCompare(b.day));

    // Top 10 worst-rated AI messages with full context
    const { data: worst } = await admin
      .from("ai_message_feedback")
      .select("id, rating, reason, created_at, message_id, conversation_id")
      .eq("account_id", user.id)
      .eq("rating", "down")
      .order("created_at", { ascending: false })
      .limit(10);

    // Fetch the message content for each
    const messageIds = (worst || []).map((w) => w.message_id);
    let messagesById = {};
    if (messageIds.length > 0) {
      const { data: msgs } = await admin
        .from("messages")
        .select("id, content, created_at, conversation_id")
        .in("id", messageIds);
      messagesById = Object.fromEntries((msgs || []).map((m) => [m.id, m]));
    }

    // Fetch preceding customer message for context
    const worstWithContext = await Promise.all(
      (worst || []).map(async (w) => {
        const aiMsg = messagesById[w.message_id];
        let customerMessage = null;
        if (aiMsg) {
          const { data: prev } = await admin
            .from("messages")
            .select("content")
            .eq("conversation_id", aiMsg.conversation_id)
            .lt("created_at", aiMsg.created_at)
            .eq("direction", "incoming")
            .order("created_at", { ascending: false })
            .limit(1)
            .single();
          customerMessage = prev?.content || null;
        }
        return {
          feedbackId: w.id,
          reason: w.reason,
          ratedAt: w.created_at,
          aiReply: aiMsg?.content || "[message unavailable]",
          customerMessage,
          conversationId: w.conversation_id,
        };
      })
    );

    return NextResponse.json({
      range: rangeKey,
      totals: { up: totalUp, down: totalDown, total, satisfactionRate },
      trend: trendArray,
      worstReplies: worstWithContext,
    });
  } catch (err) {
    console.error("[AI-FEEDBACK-STATS] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
