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
 * POST /api/abandoned-carts/send-reminder
 *
 * Send a follow-up message to the customer about their abandoned cart.
 * Can send to a single cart or all carts for an account.
 *
 * Body: {
 *   account_id (required),
 *   cart_id? (optional - if provided, sends to specific cart),
 *   message? (optional - custom message),
 *   include_discount? (boolean - whether to include a discount coupon),
 *   discount_percent? (number - discount percentage),
 *   send_all? (boolean - send reminders to all eligible carts),
 *   is_second_reminder? (boolean - whether this is a second reminder with discount)
 * }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      account_id,
      cart_id,
      message,
      include_discount = false,
      discount_percent,
      send_all = false,
      is_second_reminder = false,
    } = body;

    if (!account_id) {
      return NextResponse.json({ error: "account_id is required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Get account config for discount percentage
    const { data: account } = await supabase
      .from("accounts")
      .select("id, business_name, abandoned_cart_discount_percent")
      .eq("id", account_id)
      .single();

    const discountPct = discount_percent || account?.abandoned_cart_discount_percent || 10;

    // Determine which carts to process
    let carts = [];

    if (cart_id) {
      // Single cart
      const { data: cart, error } = await supabase
        .from("abandoned_carts")
        .select(`
          *,
          customer:customers(id, name, email, phone, channel, platform_id),
          conversation:conversations(id, channel, status, account_id)
        `)
        .eq("id", cart_id)
        .eq("account_id", account_id)
        .single();

      if (error || !cart) {
        return NextResponse.json({ error: "Cart not found" }, { status: 404 });
      }
      carts = [cart];
    } else if (send_all) {
      // All eligible carts
      const statusFilter = is_second_reminder ? "reminded" : "abandoned";
      const { data: allCarts, error } = await supabase
        .from("abandoned_carts")
        .select(`
          *,
          customer:customers(id, name, email, phone, channel, platform_id),
          conversation:conversations(id, channel, status, account_id)
        `)
        .eq("account_id", account_id)
        .eq("status", statusFilter);

      if (error) {
        console.error("[SEND-REMINDER] Fetch carts error:", error);
        return NextResponse.json({ error: "Failed to fetch carts" }, { status: 500 });
      }
      carts = allCarts || [];
    } else {
      return NextResponse.json({ error: "Provide either cart_id or send_all=true" }, { status: 400 });
    }

    if (carts.length === 0) {
      return NextResponse.json({ message: "No eligible carts found", sent: 0 });
    }

    let sent = 0;
    let failed = 0;
    const results = [];

    for (const cart of carts) {
      try {
        if (!cart.conversation) {
          results.push({ cart_id: cart.id, status: "skipped", reason: "No associated conversation" });
          continue;
        }

        // Build reminder message
        const items = Array.isArray(cart.items) ? cart.items : [];
        const itemsList = items.map(i => i.name || i.title || "Item").join(", ");
        const customerName = cart.customer?.name || "there";

        let reminderMessage = message;
        if (!reminderMessage) {
          if (is_second_reminder) {
            // Second reminder with discount
            const couponCode = `SAVE${discountPct}${Date.now().toString(36).toUpperCase()}`;
            reminderMessage = `Hey ${customerName}! We noticed you still haven't completed your order 🛒 ${itemsList}. Here's a special discount just for you: use code ${couponCode} for ${discountPct}% off! Don't miss out!`;

            // Save coupon to cart
            await supabase
              .from("abandoned_carts")
              .update({ coupon_code: couponCode })
              .eq("id", cart.id);
          } else {
            reminderMessage = `Hey ${customerName}! You left some items in your cart 🛒 ${itemsList}. Want to complete your order? We'd love to help you checkout!`;

            if (include_discount) {
              const couponCode = `SAVE${discountPct}${Date.now().toString(36).toUpperCase()}`;
              reminderMessage += ` Here's a special discount: ${couponCode} for ${discountPct}% off!`;

              await supabase
                .from("abandoned_carts")
                .update({ coupon_code: couponCode })
                .eq("id", cart.id);
            }
          }
        }

        // Send the message
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
        const sendRes = await fetch(`${baseUrl}/api/messages/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: cart.conversation.id,
            content: reminderMessage,
            type: "text",
            channel: cart.channel,
          }),
        });

        if (!sendRes.ok) {
          const errData = await sendRes.json().catch(() => ({}));
          results.push({ cart_id: cart.id, status: "failed", error: errData.error || "Send failed" });
          failed++;
          continue;
        }

        // Update cart status
        const updates = { status: "reminded" };
        if (is_second_reminder || cart.status === "reminded") {
          updates.second_reminder_at = new Date().toISOString();
        } else {
          updates.first_reminder_at = new Date().toISOString();
        }

        await supabase
          .from("abandoned_carts")
          .update(updates)
          .eq("id", cart.id);

        sent++;
        results.push({ cart_id: cart.id, status: "sent" });
      } catch (cartErr) {
        console.error(`[SEND-REMINDER] Error for cart ${cart.id}:`, cartErr);
        failed++;
        results.push({ cart_id: cart.id, status: "failed", error: cartErr.message });
      }
    }

    return NextResponse.json({
      message: `Sent ${sent} reminder(s)`,
      sent,
      failed,
      total: carts.length,
      results,
    });
  } catch (err) {
    console.error("[SEND-REMINDER] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
