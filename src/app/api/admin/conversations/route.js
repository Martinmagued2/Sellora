import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";

// Service role client (lazy-initialized for use in route handlers)
import { createClient } from "@supabase/supabase-js";
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
 * GET /api/admin/conversations?search=&channel=&status=&account_id=&page=1&limit=20
 * All conversations across all accounts
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
    const status = searchParams.get("status") || "";
    const accountId = searchParams.get("account_id") || "";
    const page = Math.max(1, parseInt(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit")) || 20));
    const offset = (page - 1) * limit;

    // Build conversations query with joins
    let query = supabase
      .from("conversations")
      .select(
        `id, channel, status, unread_count, last_message_at, created_at, updated_at,
         current_agent, agent_handoff_count, converted, summary, tags,
         account:accounts!conversations_account_id_fkey(id, business_name, email, plan),
         customer:customers!conversations_customer_id_fkey(id, name, phone, channel, profile_pic_url)`
      )
      .order("last_message_at", { ascending: false });

    if (channel) query = query.eq("channel", channel);
    if (status) query = query.eq("status", status);
    if (accountId) query = query.eq("account_id", accountId);

    // Get total count
    let countQuery = supabase
      .from("conversations")
      .select("id", { count: "exact", head: true });

    if (channel) countQuery = countQuery.eq("channel", channel);
    if (status) countQuery = countQuery.eq("status", status);
    if (accountId) countQuery = countQuery.eq("account_id", accountId);

    const { count: totalCount } = await countQuery;

    // Fetch paginated conversations
    const { data: conversations, error: convError } = await query.range(offset, offset + limit - 1);

    if (convError) {
      return NextResponse.json({ error: "Failed to fetch conversations", details: convError.message }, { status: 500 });
    }

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({
        success: true,
        data: { conversations: [], pagination: { page, limit, total: totalCount || 0, totalPages: 0 } },
      });
    }

    // Search filter (post-fetch for customer name since supabase joins are limited)
    let filtered = conversations;
    if (search) {
      const s = search.toLowerCase();
      filtered = conversations.filter(
        (c) =>
          (c.customer?.name && c.customer.name.toLowerCase().includes(s)) ||
          (c.customer?.phone && c.customer.phone.toLowerCase().includes(s)) ||
          (c.account?.business_name && c.account.business_name.toLowerCase().includes(s)) ||
          (c.id && c.id.toLowerCase().includes(s))
      );
    }

    // Fetch message counts and last messages for each conversation
    const convIds = filtered.map((c) => c.id);

    // Get message counts per conversation
    const { data: messageCounts } = await supabase
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", convIds);

    const countByConv = {};
    (messageCounts || []).forEach((m) => {
      countByConv[m.conversation_id] = (countByConv[m.conversation_id] || 0) + 1;
    });

    // Get last message per conversation
    const { data: lastMessages } = await supabase
      .from("messages")
      .select("conversation_id, content, direction, is_ai, created_at")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false })
      .limit(convIds.length * 2); // Fetch a bit more to ensure coverage

    const lastMessageByConv = {};
    (lastMessages || []).forEach((m) => {
      if (!lastMessageByConv[m.conversation_id]) {
        lastMessageByConv[m.conversation_id] = {
          content: m.content,
          direction: m.direction,
          is_ai: m.is_ai,
          created_at: m.created_at,
        };
      }
    });

    // Enrich conversations
    const enriched = filtered.map((c) => ({
      id: c.id,
      channel: c.channel,
      status: c.status,
      unread_count: c.unread_count,
      last_message_at: c.last_message_at,
      created_at: c.created_at,
      updated_at: c.updated_at,
      current_agent: c.current_agent,
      agent_handoff_count: c.agent_handoff_count,
      converted: c.converted,
      summary: c.summary,
      tags: c.tags,
      account: c.account,
      customer: c.customer,
      message_count: countByConv[c.id] || 0,
      last_message: lastMessageByConv[c.id] || null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        conversations: enriched,
        pagination: {
          page,
          limit,
          total: totalCount || 0,
          totalPages: Math.ceil((totalCount || 0) / limit),
        },
      },
    });
  } catch (error) {
    console.error("Admin conversations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
