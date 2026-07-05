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
 * PATCH /api/abandoned-carts/[id]
 *
 * Update cart status (mark as reminded, recovered, expired).
 *
 * Body: { status, account_id, recovery_order_id?, coupon_code? }
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { status, account_id, recovery_order_id, coupon_code } = body;

    if (!id || !status || !account_id) {
      return NextResponse.json({ error: "id, status, and account_id are required" }, { status: 400 });
    }

    const validStatuses = ["abandoned", "reminded", "recovered", "expired"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
    }

    const supabase = getSupabase();

    // Verify the cart belongs to the account
    const { data: existing, error: fetchError } = await supabase
      .from("abandoned_carts")
      .select("id, status")
      .eq("id", id)
      .eq("account_id", account_id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Cart not found" }, { status: 404 });
    }

    // Build update object
    const updates = { status };

    if (status === "reminded") {
      // Determine if this is first or second reminder
      if (existing.status === "abandoned") {
        updates.first_reminder_at = new Date().toISOString();
      } else if (existing.status === "reminded") {
        updates.second_reminder_at = new Date().toISOString();
      }
    }

    if (status === "recovered") {
      updates.recovered_at = new Date().toISOString();
      if (recovery_order_id) updates.recovery_order_id = recovery_order_id;
    }

    if (coupon_code) {
      updates.coupon_code = coupon_code;
    }

    const { data: updated, error: updateError } = await supabase
      .from("abandoned_carts")
      .update(updates)
      .eq("id", id)
      .select(`
        *,
        customer:customers(id, name, email, phone, channel, platform_id),
        conversation:conversations(id, channel, status)
      `)
      .single();

    if (updateError) {
      console.error("[ABANDONED-CARTS] Update error:", updateError);
      return NextResponse.json({ error: "Failed to update cart" }, { status: 500 });
    }

    return NextResponse.json({ success: true, cart: updated });
  } catch (err) {
    console.error("[ABANDONED-CARTS] PATCH error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/abandoned-carts/[id]
 *
 * Send a reminder message for a specific abandoned cart.
 *
 * Body: { account_id, message?, include_discount?, discount_percent? }
 */
export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { account_id, message, include_discount = false, discount_percent } = body;

    if (!id || !account_id) {
      return NextResponse.json({ error: "id and account_id are required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Get the cart with customer and conversation info
    const { data: cart, error: cartError } = await supabase
      .from("abandoned_carts")
      .select(`
        *,
        customer:customers(id, name, email, phone, channel, platform_id),
        conversation:conversations(id, channel, status, account_id)
      `)
      .eq("id", id)
      .eq("account_id", account_id)
      .single();

    if (cartError || !cart) {
      return NextResponse.json({ error: "Cart not found" }, { status: 404 });
    }

    if (!cart.conversation) {
      return NextResponse.json({ error: "No associated conversation found" }, { status: 400 });
    }

    // Build the reminder message
    const items = Array.isArray(cart.items) ? cart.items : [];
    const itemsList = items.map(i => i.name || i.title || "Item").join(", ");
    const customerName = cart.customer?.name || "there";

    let reminderMessage = message;
    if (!reminderMessage) {
      reminderMessage = `Hey ${customerName}! You left some items in your cart 🛒 ${itemsList}. Want to complete your order?`;

      if (include_discount) {
        const discount = discount_percent || 10;
        // Generate a coupon code
        const couponCode = `SAVE${discount}${Date.now().toString(36).toUpperCase()}`;
        reminderMessage += ` Here's a special discount: ${couponCode} for ${discount}% off!`;

        // Update cart with coupon code
        await supabase
          .from("abandoned_carts")
          .update({ coupon_code: couponCode })
          .eq("id", id);
      }
    }

    // Send the message via the existing message sending infrastructure
    const sendRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/messages/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: cart.conversation.id,
        content: reminderMessage,
        type: "text",
        channel: cart.channel,
      }),
    });

    const sendData = await sendRes.json();

    if (!sendRes.ok) {
      console.error("[ABANDONED-CARTS] Send message failed:", sendData);
      return NextResponse.json({ error: sendData.error || "Failed to send message" }, { status: 500 });
    }

    // Update cart status to reminded
    const updates = { status: "reminded" };
    if (cart.status === "abandoned") {
      updates.first_reminder_at = new Date().toISOString();
    } else if (cart.status === "reminded") {
      updates.second_reminder_at = new Date().toISOString();
    }

    await supabase
      .from("abandoned_carts")
      .update(updates)
      .eq("id", id);

    return NextResponse.json({
      success: true,
      message: "Reminder sent successfully",
      messageId: sendData.messageId,
    });
  } catch (err) {
    console.error("[ABANDONED-CARTS] POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
