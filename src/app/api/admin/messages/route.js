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
 * GET /api/admin/messages?search=&channel=&is_ai=&direction=&page=1&limit=20
 * All messages across all accounts
 */
export async function GET(request) {
  try {
    if (!(await verifyAdmin(request))) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const channel = searchParams.get("channel") || "";
    const isAi = searchParams.get("is_ai");
    const direction = searchParams.get("direction") || "";
    const page = Math.max(1, parseInt(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit")) || 20));
    const offset = (page - 1) * limit;

    // Build messages query
    let query = supabase
      .from("messages")
      .select(
        `id, content, direction, type, is_ai, intent, sentiment,
         response_time_seconds, agent_type, tool_calls, created_at,
         media_url, delivery_status,
         conversation:conversations!messages_conversation_id_fkey(
           id, channel, status,
           customer:customers!conversations_customer_id_fkey(id, name, phone),
           account:accounts!conversations_account_id_fkey(id, business_name)
         )`
      )
      .order("created_at", { ascending: false });

    if (isAi !== null && isAi !== "" && isAi !== undefined) {
      query = query.eq("is_ai", isAi === "true");
    }
    if (direction) query = query.eq("direction", direction);

    // Get total count with same filters
    let countQuery = supabase
      .from("messages")
      .select("id", { count: "exact", head: true });

    if (isAi !== null && isAi !== "" && isAi !== undefined) {
      countQuery = countQuery.eq("is_ai", isAi === "true");
    }
    if (direction) countQuery = countQuery.eq("direction", direction);

    const { count: totalCount } = await countQuery;

    // Fetch paginated messages
    const { data: messages, error: msgError } = await query.range(offset, offset + limit - 1);

    if (msgError) {
      return NextResponse.json({ error: "Failed to fetch messages", details: msgError.message }, { status: 500 });
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({
        success: true,
        data: { messages: [], pagination: { page, limit, total: totalCount || 0, totalPages: 0 } },
      });
    }

    // Filter by channel or search (post-fetch since they're in joined tables)
    let filtered = messages;

    if (channel) {
      filtered = filtered.filter((m) => m.conversation?.channel === channel);
    }

    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          (m.content && m.content.toLowerCase().includes(s)) ||
          (m.intent && m.intent.toLowerCase().includes(s)) ||
          (m.conversation?.customer?.name && m.conversation.customer.name.toLowerCase().includes(s)) ||
          (m.conversation?.account?.business_name && m.conversation.account.business_name.toLowerCase().includes(s))
      );
    }

    // Flatten the response for easier consumption
    const enriched = filtered.map((m) => ({
      id: m.id,
      content: m.content,
      direction: m.direction,
      type: m.type,
      is_ai: m.is_ai,
      intent: m.intent,
      sentiment: m.sentiment,
      response_time_seconds: m.response_time_seconds,
      agent_type: m.agent_type,
      tool_calls: m.tool_calls,
      media_url: m.media_url,
      delivery_status: m.delivery_status,
      created_at: m.created_at,
      conversation_id: m.conversation?.id,
      channel: m.conversation?.channel || null,
      conversation_status: m.conversation?.status || null,
      customer: m.conversation?.customer || null,
      account: m.conversation?.account || null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        messages: enriched,
        pagination: {
          page,
          limit,
          total: totalCount || 0,
          totalPages: Math.ceil((totalCount || 0) / limit),
        },
      },
    });
  } catch (error) {
    console.error("Admin messages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
