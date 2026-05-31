import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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

// Admin account IDs (hardcoded for security)
const ADMIN_ACCOUNT_IDS = ["e6a38229-7fd2-47a4-a28e-415dc76bfb46"];

async function verifyAdmin(request) {
  const adminKey = request.headers.get("x-admin-key");
  if (adminKey === process.env.ADMIN_SECRET_KEY) return true;

  const authHeader = request.headers.get("x-account-id");
  if (authHeader && ADMIN_ACCOUNT_IDS.includes(authHeader)) return true;

  return false;
}

/**
 * GET /api/admin/ai-performance
 * Platform-wide AI performance metrics
 */
export async function GET(request) {
  try {
    if (!(await verifyAdmin(request))) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    const supabase = getSupabase();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch all AI-related data in parallel
    const [messagesRes, agentActionsRes, conversationsRes, faqsRes, autoRepliesRes] = await Promise.all([
      supabase
        .from("messages")
        .select("id, is_ai, direction, intent, sentiment, response_time_seconds, agent_type, tool_calls, created_at, account_id")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(50000),
      supabase
        .from("agent_actions")
        .select("tool_name, agent_type, success, created_at, account_id")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(10000),
      supabase
        .from("conversations")
        .select("id, status, agent_handoff_count, current_agent, account_id")
        .gte("created_at", thirtyDaysAgo.toISOString()),
      supabase.from("faqs").select("id, account_id"),
      supabase.from("auto_replies").select("id, trigger_keyword, account_id"),
    ]);

    const messages = messagesRes.data || [];
    const agentActions = agentActionsRes.data || [];
    const conversations = conversationsRes.data || [];
    const faqs = faqsRes.data || [];
    const autoReplies = autoRepliesRes.data || [];

    // ─── AI Reply Stats ───
    const outgoingMessages = messages.filter((m) => m.direction === "outgoing");
    const aiMessages = outgoingMessages.filter((m) => m.is_ai);
    const humanMessages = outgoingMessages.filter((m) => !m.is_ai);
    const totalAiReplies = aiMessages.length;

    // ─── Average Response Time ───
    const aiResponseTimes = aiMessages
      .filter((m) => m.response_time_seconds != null)
      .map((m) => m.response_time_seconds);
    const avgResponseTime = aiResponseTimes.length > 0
      ? Math.round(aiResponseTimes.reduce((a, b) => a + b, 0) / aiResponseTimes.length)
      : 0;

    // ─── By Provider / Agent Type ───
    const byAgentType = {};
    aiMessages.forEach((m) => {
      const type = m.agent_type || "general";
      if (!byAgentType[type]) byAgentType[type] = { count: 0, totalResponseTime: 0, responseCount: 0 };
      byAgentType[type].count++;
      if (m.response_time_seconds != null) {
        byAgentType[type].totalResponseTime += m.response_time_seconds;
        byAgentType[type].responseCount++;
      }
    });
    const byProvider = Object.entries(byAgentType).map(([type, data]) => ({
      agent_type: type,
      count: data.count,
      avgResponseTime: data.responseCount > 0 ? Math.round(data.totalResponseTime / data.responseCount) : 0,
    }));

    // ─── Intent Distribution ───
    const intentCounts = {};
    messages.filter((m) => m.intent).forEach((m) => {
      intentCounts[m.intent] = (intentCounts[m.intent] || 0) + 1;
    });
    const intentDistribution = Object.entries(intentCounts)
      .map(([intent, count]) => ({ intent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // ─── Sentiment Distribution ───
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0, urgent: 0 };
    messages.filter((m) => m.sentiment).forEach((m) => {
      if (sentimentCounts[m.sentiment] !== undefined) sentimentCounts[m.sentiment]++;
    });
    const totalSentiment = Object.values(sentimentCounts).reduce((a, b) => a + b, 0);

    // ─── Tool Calls ───
    const toolCallCounts = {};
    agentActions.forEach((a) => {
      if (a.tool_name) {
        toolCallCounts[a.tool_name] = (toolCallCounts[a.tool_name] || 0) + 1;
      }
    });
    // Also count from messages.tool_calls
    aiMessages.filter((m) => m.tool_calls).forEach((m) => {
      try {
        const calls = typeof m.tool_calls === "string" ? JSON.parse(m.tool_calls) : m.tool_calls;
        if (Array.isArray(calls)) {
          calls.forEach((c) => {
            const name = c.function?.name || c.name || "unknown";
            toolCallCounts[name] = (toolCallCounts[name] || 0) + 1;
          });
        }
      } catch {}
    });
    const toolCallDistribution = Object.entries(toolCallCounts)
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    const totalToolCalls = Object.values(toolCallCounts).reduce((a, b) => a + b, 0);

    // ─── FAQ Match Rate ───
    // Estimate: messages with intent matching FAQ categories
    const faqKeywords = new Set();
    faqs.forEach((f) => {
      // Use the first few words as keyword matching (simplified)
    });
    const faqMatchCount = messages.filter((m) => m.intent && (m.intent === "faq" || m.intent === "product_inquiry")).length;
    const faqMatchRate = totalAiReplies > 0 ? Math.round((faqMatchCount / totalAiReplies) * 100) : 0;

    // ─── Keyword Match Rate (from auto_replies) ───
    const keywordMatchCount = messages.filter((m) => m.intent === "keyword_match" || m.intent === "auto_reply").length;
    const keywordMatchRate = totalAiReplies > 0 ? Math.round((keywordMatchCount / totalAiReplies) * 100) : 0;

    // ─── Error Rate ───
    const failedActions = agentActions.filter((a) => a.success === false).length;
    const errorRate = agentActions.length > 0 ? ((failedActions / agentActions.length) * 100).toFixed(2) : 0;

    // ─── AI Resolution Rate ───
    const convIdsWithHumanMsg = new Set(humanMessages.map((m) => m.conversation_id));
    const closedConvs = conversations.filter((c) => c.status === "closed");
    const aiOnlyClosedConvs = closedConvs.filter((c) => !convIdsWithHumanMsg.has(c.id));
    const aiResolutionRate = closedConvs.length > 0
      ? ((aiOnlyClosedConvs.length / closedConvs.length) * 100).toFixed(1)
      : 0;

    // ─── Handoff Rate ───
    const convsWithHandoff = conversations.filter((c) => (c.agent_handoff_count || 0) > 0).length;
    const handoffRate = conversations.length > 0
      ? ((convsWithHandoff / conversations.length) * 100).toFixed(1)
      : 0;

    // ─── Daily AI Usage for last 30 days ───
    const dailyAiUsage = [];
    for (let i = 29; i >= 0; i--) {
      const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStr = day.toISOString().split("T")[0];

      const dayAiMessages = aiMessages.filter((m) => {
        return new Date(m.created_at).toISOString().split("T")[0] === dayStr;
      });
      const dayResponseTimes = dayAiMessages
        .filter((m) => m.response_time_seconds != null)
        .map((m) => m.response_time_seconds);

      dailyAiUsage.push({
        date: dayStr,
        aiReplies: dayAiMessages.length,
        avgResponseTime: dayResponseTimes.length > 0
          ? Math.round(dayResponseTimes.reduce((a, b) => a + b, 0) / dayResponseTimes.length)
          : 0,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        totalAiReplies,
        avgResponseTime,
        byProvider,
        aiResolutionRate: parseFloat(aiResolutionRate),
        handoffRate: parseFloat(handoffRate),
        intentDistribution,
        sentiment: {
          counts: sentimentCounts,
          total: totalSentiment,
          positivePct: totalSentiment > 0 ? Math.round((sentimentCounts.positive / totalSentiment) * 100) : 0,
          neutralPct: totalSentiment > 0 ? Math.round((sentimentCounts.neutral / totalSentiment) * 100) : 0,
          negativePct: totalSentiment > 0 ? Math.round((sentimentCounts.negative / totalSentiment) * 100) : 0,
          urgentPct: totalSentiment > 0 ? Math.round((sentimentCounts.urgent / totalSentiment) * 100) : 0,
        },
        toolCalls: {
          total: totalToolCalls,
          distribution: toolCallDistribution,
        },
        faqMatchRate,
        keywordMatchRate,
        errorRate: parseFloat(errorRate),
        failedActions,
        totalActions: agentActions.length,
        closedConversations: closedConvs.length,
        aiOnlyClosedConversations: aiOnlyClosedConvs.length,
        dailyAiUsage,
      },
    });
  } catch (error) {
    console.error("Admin AI performance error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
