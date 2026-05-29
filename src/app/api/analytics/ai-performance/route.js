import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

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
 * GET /api/analytics/ai-performance
 * Returns AI performance metrics including resolution rate, response times, sentiment, etc.
 */
export async function GET(req) {
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();

    // Fetch messages with AI/human tracking
    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("id, is_ai, intent, sentiment, response_time_seconds, created_at, direction, agent_type, tool_calls, conversation_id")
      .eq("account_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (messagesError) {
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
    }

    // Fetch conversations for resolution tracking
    const { data: conversations } = await supabase
      .from("conversations")
      .select("id, status, agent_handoff_count, current_agent, created_at")
      .eq("account_id", user.id);

    // Fetch agent actions for tool call analytics
    const { data: agentActions } = await supabase
      .from("agent_actions")
      .select("tool_name, agent_type, created_at, success")
      .eq("account_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1000);

    const allMessages = messages || [];
    const allConversations = conversations || [];
    const allActions = agentActions || [];

    // ─── AI vs Human Messages ───
    const outgoingMessages = allMessages.filter(m => m.direction === "outgoing");
    const aiMessages = outgoingMessages.filter(m => m.is_ai);
    const humanMessages = outgoingMessages.filter(m => !m.is_ai);
    const totalMessages = allMessages.length;

    // ─── AI Resolution Rate ───
    // Conversations where AI was the only responder (no human messages)
    const convIdsWithHumanMsg = new Set(humanMessages.map(m => m.conversation_id));
    const aiOnlyConvs = allConversations.filter(c =>
      !convIdsWithHumanMsg.has(c.id) && c.status === "closed"
    );
    const closedConvs = allConversations.filter(c => c.status === "closed");
    const aiResolutionRate = closedConvs.length > 0
      ? ((aiOnlyConvs.length / closedConvs.length) * 100).toFixed(1)
      : 0;

    // ─── Average Response Times ───
    const aiResponseTimes = aiMessages
      .filter(m => m.response_time_seconds != null)
      .map(m => m.response_time_seconds);
    const humanResponseTimes = humanMessages
      .filter(m => m.response_time_seconds != null)
      .map(m => m.response_time_seconds);

    const avgAiResponseTime = aiResponseTimes.length > 0
      ? Math.round(aiResponseTimes.reduce((a, b) => a + b, 0) / aiResponseTimes.length)
      : 0;
    const avgHumanResponseTime = humanResponseTimes.length > 0
      ? Math.round(humanResponseTimes.reduce((a, b) => a + b, 0) / humanResponseTimes.length)
      : 0;

    // ─── Intent Distribution ───
    const intentCounts = {};
    allMessages.filter(m => m.intent && m.intent !== "general").forEach(m => {
      intentCounts[m.intent] = (intentCounts[m.intent] || 0) + 1;
    });
    const intentDistribution = Object.entries(intentCounts)
      .map(([intent, count]) => ({ intent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // ─── Sentiment Analysis ───
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0, urgent: 0 };
    allMessages.filter(m => m.sentiment).forEach(m => {
      if (sentimentCounts[m.sentiment] !== undefined) {
        sentimentCounts[m.sentiment]++;
      }
    });
    const totalSentiment = Object.values(sentimentCounts).reduce((a, b) => a + b, 0);

    // ─── AI Handoff Rate ───
    const convsWithHandoff = allConversations.filter(c => (c.agent_handoff_count || 0) > 0).length;
    const handoffRate = allConversations.length > 0
      ? ((convsWithHandoff / allConversations.length) * 100).toFixed(1)
      : 0;

    // ─── Most Common AI Tool Calls ───
    const toolCallCounts = {};
    allActions.forEach(a => {
      if (a.tool_name) {
        toolCallCounts[a.tool_name] = (toolCallCounts[a.tool_name] || 0) + 1;
      }
    });
    const commonToolCalls = Object.entries(toolCallCounts)
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Also check tool_calls in messages
    const msgToolCounts = {};
    aiMessages.filter(m => m.tool_calls).forEach(m => {
      try {
        const calls = typeof m.tool_calls === "string" ? JSON.parse(m.tool_calls) : m.tool_calls;
        if (Array.isArray(calls)) {
          calls.forEach(c => {
            const name = c.function?.name || c.name || "unknown";
            msgToolCounts[name] = (msgToolCounts[name] || 0) + 1;
          });
        }
      } catch {}
    });
    // Merge
    Object.entries(msgToolCounts).forEach(([tool, count]) => {
      if (!toolCallCounts[tool]) toolCallCounts[tool] = 0;
      toolCallCounts[tool] += count;
    });
    const mergedToolCalls = Object.entries(toolCallCounts)
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // ─── AI Performance by Time of Day ───
    const hourlyAiPerformance = new Array(24).fill(null).map(() => ({ messages: 0, totalResponseTime: 0, responseCount: 0 }));
    aiMessages.forEach(m => {
      const hour = new Date(m.created_at).getHours();
      hourlyAiPerformance[hour].messages++;
      if (m.response_time_seconds != null) {
        hourlyAiPerformance[hour].totalResponseTime += m.response_time_seconds;
        hourlyAiPerformance[hour].responseCount++;
      }
    });
    const aiPerformanceByHour = hourlyAiPerformance.map((h, i) => ({
      hour: i,
      messages: h.messages,
      avgResponseTime: h.responseCount > 0 ? Math.round(h.totalResponseTime / h.responseCount) : 0,
    }));

    return NextResponse.json({
      success: true,
      data: {
        totalAiMessages: aiMessages.length,
        totalHumanMessages: humanMessages.length,
        totalMessages,
        aiPct: totalMessages > 0 ? ((aiMessages.length / outgoingMessages.length) * 100).toFixed(1) : 0,
        aiResolutionRate: parseFloat(aiResolutionRate),
        avgAiResponseTime,
        avgHumanResponseTime,
        intentDistribution,
        sentiment: {
          counts: sentimentCounts,
          total: totalSentiment,
          positivePct: totalSentiment > 0 ? Math.round((sentimentCounts.positive / totalSentiment) * 100) : 0,
          neutralPct: totalSentiment > 0 ? Math.round((sentimentCounts.neutral / totalSentiment) * 100) : 0,
          negativePct: totalSentiment > 0 ? Math.round((sentimentCounts.negative / totalSentiment) * 100) : 0,
          urgentPct: totalSentiment > 0 ? Math.round((sentimentCounts.urgent / totalSentiment) * 100) : 0,
        },
        handoffRate: parseFloat(handoffRate),
        convsWithHandoff,
        commonToolCalls: mergedToolCalls,
        aiPerformanceByHour,
        closedConvsCount: closedConvs.length,
        aiOnlyConvsCount: aiOnlyConvs.length,
      },
    });
  } catch (error) {
    console.error("AI performance analytics error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
