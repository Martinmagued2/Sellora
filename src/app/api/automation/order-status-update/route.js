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

/**
 * POST /api/automation/order-status-update
 * Sends "Your order is being prepared/shipped" status update messages to customers.
 */
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { account_id, order_id, status, message } = body;

    if (!account_id) {
      return NextResponse.json({ error: "account_id is required" }, { status: 400 });
    }

    if (!order_id) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Fetch the order with customer info
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, order_number, total, items, status, customer_id, payment_status, tracking_number")
      .eq("id", order_id)
      .eq("account_id", account_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Find the customer's active conversation
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id, channel")
      .eq("account_id", account_id)
      .eq("customer_id", order.customer_id)
      .in("status", ["new", "open", "in_progress", "waiting_customer", "closed"])
      .order("last_message_at", { ascending: false })
      .limit(1)
      .single();

    if (!conversation) {
      return NextResponse.json({ error: "No conversation found for this customer" }, { status: 404 });
    }

    // Build status update message
    const newStatus = status || order.status;
    const statusMessages = {
      confirmed: "✅ Your order has been confirmed and is being prepared!",
      shipped: `📦 Your order #${order.order_number} has been shipped!${order.tracking_number ? ` Track it: ${order.tracking_number}` : ""}`,
      delivered: "🎉 Your order has been delivered! We hope you love it.",
      cancelled: "❌ Your order has been cancelled. If you have questions, feel free to ask.",
    };

    const updateMessage = message || statusMessages[newStatus] || `📋 Your order #${order.order_number} status has been updated to: ${newStatus}`;

    // Store the status update message
    const { error: insertError } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      direction: "outgoing",
      content: updateMessage,
      type: "text",
      is_ai: true,
      agent_type: "status_update",
    });

    if (insertError) {
      return NextResponse.json({ error: "Failed to send status update" }, { status: 500 });
    }

    // Update conversation
    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        status: "in_progress",
      })
      .eq("id", conversation.id);

    // Update order status if a new status was provided
    if (status && status !== order.status) {
      await supabase
        .from("orders")
        .update({ status })
        .eq("id", order_id);
    }

    return NextResponse.json({
      success: true,
      message: "Status update sent",
      order_number: order.order_number,
      new_status: newStatus,
    });
  } catch (error) {
    console.error("Order status update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
