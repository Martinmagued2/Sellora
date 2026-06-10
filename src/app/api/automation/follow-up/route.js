import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
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

/**
 * POST /api/automation/follow-up
 * Finds unpaid orders older than 24h and sends follow-up messages to customers.
 * Can be called manually or via a scheduled job.
 */
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { account_id } = body;

    // ── Authentication check ──
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { getAll() { return cookieStore.getAll(); } } }
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify account_id matches authenticated user
    if (account_id && account_id !== user.id) {
      return NextResponse.json({ error: "Forbidden — account_id does not match authenticated user" }, { status: 403 });
    }

    // If no account_id provided, use the authenticated user's ID
    const effectiveAccountId = account_id || user.id;

    const supabase = getSupabase();

    // Check if auto follow-up is enabled for this account
    const { data: account } = await supabase
      .from("accounts")
      .select("id, business_name, auto_follow_up_enabled")
      .eq("id", effectiveAccountId)
      .single();

    if (!account?.auto_follow_up_enabled) {
      return NextResponse.json({ message: "Auto follow-up is disabled for this account", sent: 0 });
    }

    // Find unpaid orders older than 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: unpaidOrders, error: ordersError } = await supabase
      .from("orders")
      .select("id, order_number, total, items, created_at, customer_id, payment_status, payment_method")
      .eq("account_id", effectiveAccountId)
      .eq("payment_status", "unpaid")
      .in("status", ["pending", "confirmed"])
      .lt("created_at", twentyFourHoursAgo);

    if (ordersError) {
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
    }

    if (!unpaidOrders || unpaidOrders.length === 0) {
      return NextResponse.json({ message: "No unpaid orders older than 24h found", sent: 0 });
    }

    let sent = 0;
    const results = [];

    for (const order of unpaidOrders) {
      // Find the customer's active conversation
      const { data: conversation } = await supabase
        .from("conversations")
        .select("id, channel, customer_id")
        .eq("account_id", effectiveAccountId)
        .eq("customer_id", order.customer_id)
        .in("status", ["new", "open", "in_progress", "waiting_customer"])
        .order("last_message_at", { ascending: false })
        .limit(1)
        .single();

      if (!conversation) {
        results.push({ order_id: order.id, status: "skipped", reason: "No active conversation" });
        continue;
      }

      // Build follow-up message
      const itemsSummary = (order.items || []).map(i => `${i.qty}x ${i.name}`).join(", ");
      const followUpMessage = `👋 Hi! Just a friendly reminder — your order #${order.order_number} (${itemsSummary}) for ${order.total} EGP is still pending payment. Would you like to complete your order?`;

      // Store the follow-up message
      const { error: insertError } = await supabase.from("messages").insert({
        conversation_id: conversation.id,
        direction: "outgoing",
        content: followUpMessage,
        type: "text",
        is_ai: true,
        agent_type: "follow_up",
      });

      if (insertError) {
        results.push({ order_id: order.id, status: "failed", error: insertError.message });
        continue;
      }

      // Update conversation
      await supabase
        .from("conversations")
        .update({
          last_message_at: new Date().toISOString(),
          status: "in_progress",
        })
        .eq("id", conversation.id);

      sent++;
      results.push({ order_id: order.id, order_number: order.order_number, status: "sent" });
    }

    return NextResponse.json({
      message: `Sent ${sent} follow-up messages`,
      sent,
      total: unpaidOrders.length,
      results,
    });
  } catch (error) {
    console.error("Follow-up automation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
