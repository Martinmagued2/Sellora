/**
 * AI Deflection Analytics
 * GET /api/analytics/deflection?range=30d
 *
 * Returns the AI deflection rate: % of conversations fully handled by AI
 * with no human intervention.
 *
 * Also returns:
 *   - Cost savings estimate (AI msgs × avg cost per human agent message)
 *   - Per-day trend
 *   - Per-channel breakdown
 *
 * Used by the analytics page to show "AI handled X% of conversations this month,
 * saving an estimated $Y vs. human agents."
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

// Conservative estimate: a human agent costs ~$0.15 per message sent
// (assumes $15/hr, ~100 messages/hour including context switching).
const COST_PER_HUMAN_MSG = parseFloat(process.env.HUMAN_COST_PER_MESSAGE || "0.15");

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const rangeKey = searchParams.get("range") || "30d";
    const days = RANGE_DAYS[rangeKey] || 30;
    const since = new Date(Date.now() - days * 86400_000).toISOString();

    const admin = getAdminClient();

    // 1. Conversations by resolution type
    const { data: convs } = await admin
      .from("conversations")
      .select("id, resolved_by, channel, created_at, first_ai_reply_at, first_human_reply_at, status")
      .eq("account_id", user.id)
      .gte("created_at", since);

    const all = convs || [];
    const total = all.length;
    const aiResolved = all.filter((c) => c.resolved_by === "ai").length;
    const humanResolved = all.filter((c) => c.resolved_by === "human").length;
    const mixedResolved = all.filter((c) => c.resolved_by === "mixed").length;
    const openNoResolution = all.filter((c) => !c.resolved_by).length;

    const deflectionRate = total > 0 ? (aiResolved / total) * 100 : 0;
    const partialDeflectionRate = total > 0
      ? ((aiResolved + mixedResolved * 0.5) / total) * 100
      : 0;

    // 2. AI message count
    const convIds = all.map((c) => c.id);
    let aiMsgCount = 0;
    let humanMsgCount = 0;
    if (convIds.length > 0) {
      // Process in batches of 200 (Supabase in() limit safe range)
      for (let i = 0; i < convIds.length; i += 200) {
        const batch = convIds.slice(i, i + 200);
        const { count: aiCount } = await admin
          .from("messages")
          .select("*", { count: "exact", head: true })
          .in("conversation_id", batch)
          .eq("is_ai", true);
        aiMsgCount += aiCount || 0;

        const { count: hCount } = await admin
          .from("messages")
          .select("*", { count: "exact", head: true })
          .in("conversation_id", batch)
          .eq("is_ai", false)
          .eq("direction", "outgoing");
        humanMsgCount += hCount || 0;
      }
    }

    const costSavings = Math.round(aiMsgCount * COST_PER_HUMAN_MSG * 100) / 100;

    // 3. Daily trend
    const trendMap = {};
    all.forEach((c) => {
      const day = c.created_at.slice(0, 10);
      trendMap[day] = trendMap[day] || { total: 0, ai: 0, human: 0, mixed: 0 };
      trendMap[day].total++;
      if (c.resolved_by) trendMap[day][c.resolved_by]++;
    });
    const trend = Object.entries(trendMap)
      .map(([day, v]) => ({
        day,
        total: v.total,
        ai: v.ai,
        human: v.human,
        mixed: v.mixed,
        deflectionRate: v.total > 0 ? Math.round((v.ai / v.total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => a.day.localeCompare(b.day));

    // 4. Per-channel breakdown
    const channelMap = {};
    all.forEach((c) => {
      const ch = c.channel || "unknown";
      channelMap[ch] = channelMap[ch] || { total: 0, ai: 0, human: 0, mixed: 0 };
      channelMap[ch].total++;
      if (c.resolved_by) channelMap[ch][c.resolved_by]++;
    });
    const byChannel = Object.entries(channelMap).map(([channel, v]) => ({
      channel,
      total: v.total,
      ai: v.ai,
      human: v.human,
      mixed: v.mixed,
      deflectionRate: v.total > 0 ? Math.round((v.ai / v.total) * 1000) / 10 : 0,
    }));

    // 5. Avg response times
    const aiResponseTimes = all
      .filter((c) => c.first_ai_reply_at)
      .map((c) => new Date(c.first_ai_reply_at).getTime() - new Date(c.created_at).getTime());
    const humanResponseTimes = all
      .filter((c) => c.first_human_reply_at)
      .map((c) => new Date(c.first_human_reply_at).getTime() - new Date(c.created_at).getTime());

    const avgAiResponseMs = aiResponseTimes.length > 0
      ? aiResponseTimes.reduce((s, t) => s + t, 0) / aiResponseTimes.length
      : null;
    const avgHumanResponseMs = humanResponseTimes.length > 0
      ? humanResponseTimes.reduce((s, t) => s + t, 0) / humanResponseTimes.length
      : null;

    return NextResponse.json({
      range: rangeKey,
      totals: {
        totalConversations: total,
        aiResolved,
        humanResolved,
        mixedResolved,
        openNoResolution,
        deflectionRate: Math.round(deflectionRate * 10) / 10,
        partialDeflectionRate: Math.round(partialDeflectionRate * 10) / 10,
      },
      messages: {
        aiMessages: aiMsgCount,
        humanMessages: humanMsgCount,
        totalMessages: aiMsgCount + humanMsgCount,
      },
      costSavings: {
        estimated: costSavings,
        perMessageCost: COST_PER_HUMAN_MSG,
        currency: "USD",
        note: `Estimate based on $${COST_PER_HUMAN_MSG} per human-agent message. Override with HUMAN_COST_PER_MESSAGE env var.`,
      },
      responseTimes: {
        avgAiMs: avgAiResponseMs,
        avgHumanMs: avgHumanResponseMs,
      },
      trend,
      byChannel,
    });
  } catch (err) {
    console.error("[DEFLECTION] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
