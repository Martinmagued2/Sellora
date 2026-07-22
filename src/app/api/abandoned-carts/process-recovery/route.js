/**
 * Abandoned Cart Recovery Sequence Processor
 * POST /api/abandoned-carts/process-recovery
 *
 * Called by a cron job (every 30 min). Implements the 3-step recovery sequence:
 *
 *   Step 1 (T+1h after abandonment):  Friendly reminder, no discount
 *   Step 2 (T+24h):                   Reminder + auto-generated 5% discount coupon
 *   Step 3 (T+72h):                   Final nudge ("last chance") with 10% discount
 *
 * After step 3, the cart is marked 'expired' so we stop messaging the customer.
 *
 * Attribution: When a cart is recovered (linked order is paid), recovery_revenue
 * is backfilled and the abandoned_carts.status is set to 'recovered'.
 *
 * Auth: protected by CRON_SECRET header for server-to-server calls.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { sendMessage } from "@/lib/channels/meta";

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

const STEP1_DELAY_HOURS = 1;
const STEP2_DELAY_HOURS = 24;
const STEP3_DELAY_HOURS = 72;
const STEP2_DISCOUNT_PCT = 5;
const STEP3_DISCOUNT_PCT = 10;

function hoursSince(ts) {
  return (Date.now() - new Date(ts).getTime()) / 3600_000;
}

function generateCouponCode(prefix = "BACK") {
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}${rand}`;
}

async function createRecoveryCoupon(accountId, percent, cartId) {
  const supabase = getSupabase();
  const code = generateCouponCode(percent === STEP2_DISCOUNT_PCT ? "BACK5" : "BACK10");
  const expiresAt = new Date(Date.now() + 48 * 3600_000).toISOString(); // 48h validity

  const { data: coupon, error } = await supabase
    .from("coupons")
    .insert({
      account_id: accountId,
      code,
      type: "percentage",
      value: percent,
      min_order_value: 0,
      max_uses: 1,
      used_count: 0,
      starts_at: new Date().toISOString(),
      expires_at: expiresAt,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[RECOVERY] coupon insert failed:", error.message);
    return null;
  }
  return coupon;
}

async function sendRecoveryMessage({
  channel,
  recipientId,
  phoneNumberId,
  accessToken,
  pageId,
  message,
}) {
  try {
    if (channel === "whatsapp") {
      await sendWhatsAppMessage({
        to: recipientId,
        message,
        phoneNumberId,
        accessToken,
      });
    } else {
      await sendMessage({
        recipientId,
        message,
        pageId,
        accessToken,
      });
    }
    return true;
  } catch (err) {
    console.error(`[RECOVERY] send failed on ${channel}:`, err.message);
    return false;
  }
}

export async function POST(req) {
  // Auth: CRON_SECRET for server-to-server.
  // SECURITY: Fail closed if CRON_SECRET is unset — must NOT skip auth when env var is missing.
  const authHeader = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET || "";
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const now = new Date().toISOString();
  const stats = { step1: 0, step2: 0, step3: 0, expired: 0, recovered: 0, errors: 0 };

  try {
    // ─── Phase 1: Check for recovered carts ───
    // A cart is "recovered" if its linked recovery_order_id has been paid.
    const { data: potentiallyRecovered } = await supabase
      .from("abandoned_carts")
      .select("id, account_id, recovery_order_id, cart_value, status")
      .eq("status", "reminded")
      .not("recovery_order_id", "is", null);

    for (const cart of potentiallyRecovered || []) {
      const { data: order } = await supabase
        .from("orders")
        .select("payment_status, total")
        .eq("id", cart.recovery_order_id)
        .single();
      if (order?.payment_status === "paid") {
        await supabase
          .from("abandoned_carts")
          .update({
            status: "recovered",
            recovered_at: now,
            recovery_revenue: order.total,
          })
          .eq("id", cart.id);
        stats.recovered++;
      }
    }

    // ─── Phase 2: Find carts needing step 1, 2, or 3 ───
    const { data: abandonedCarts } = await supabase
      .from("abandoned_carts")
      .select(`
        id, account_id, customer_id, conversation_id, channel, items, cart_value,
        abandoned_at, first_reminder_at, second_reminder_at, third_reminder_at,
        first_reminder_sent_at, second_reminder_sent_at, third_reminder_sent_at,
        status, coupon_code
      `)
      .eq("status", "abandoned")
      .order("abandoned_at", { ascending: false })
      .limit(500);

    for (const cart of abandonedCarts || []) {
      try {
        const hours = hoursSince(cart.abandoned_at);

        // ─── Step 1: T+1h, no discount ───
        if (hours >= STEP1_DELAY_HOURS && !cart.first_reminder_sent_at) {
          // Resolve recipient + tokens
          const ctx = await resolveRecipient(supabase, cart);
          if (!ctx) { stats.errors++; continue; }

          const itemList = (cart.items || []).slice(0, 3).map((i) => `• ${i.name}`).join("\n");
          const message = `Hi ${ctx.customerName || "there"}! 👋 Noticed you were interested in:\n${itemList}\n\nStill want to grab them? I'm here to help with any questions or to place your order. Just reply here!`;

          const sent = await sendRecoveryMessage(ctx);
          if (sent) {
            await supabase
              .from("abandoned_carts")
              .update({
                first_reminder_sent_at: now,
                first_reminder_at: now,
                status: "reminded",
              })
              .eq("id", cart.id);
            stats.step1++;
          } else {
            stats.errors++;
          }
          continue;
        }

        // ─── Step 2: T+24h, 5% discount ───
        if (hours >= STEP2_DELAY_HOURS && !cart.second_reminder_sent_at && cart.first_reminder_sent_at) {
          const ctx = await resolveRecipient(supabase, cart);
          if (!ctx) { stats.errors++; continue; }

          // Create the discount coupon
          const coupon = await createRecoveryCoupon(cart.account_id, STEP2_DISCOUNT_PCT, cart.id);
          const couponLine = coupon ? `\n\n🎁 Use code ${coupon.code} for ${STEP2_DISCOUNT_PCT}% off your order!` : "";

          const message = `Hi ${ctx.customerName || "there"}! Just a friendly nudge — your items are still waiting.${couponLine}\n\nReply here to complete your order anytime.`;

          const sent = await sendRecoveryMessage(ctx);
          if (sent) {
            await supabase
              .from("abandoned_carts")
              .update({
                second_reminder_sent_at: now,
                second_reminder_at: now,
                coupon_code: coupon?.code || cart.coupon_code,
              })
              .eq("id", cart.id);
            stats.step2++;
          } else {
            stats.errors++;
          }
          continue;
        }

        // ─── Step 3: T+72h, final nudge with 10% discount ───
        if (hours >= STEP3_DELAY_HOURS && !cart.third_reminder_sent_at && cart.second_reminder_sent_at) {
          const ctx = await resolveRecipient(supabase, cart);
          if (!ctx) { stats.errors++; continue; }

          // Create the final discount coupon
          const coupon = await createRecoveryCoupon(cart.account_id, STEP3_DISCOUNT_PCT, cart.id);
          const couponLine = coupon ? `\n\n🎁 Final offer: use code ${coupon.code} for ${STEP3_DISCOUNT_PCT}% off!` : "";

          const message = `Hi ${ctx.customerName || "there"}! 👋 This is our last note about your cart — we'd love to see you complete your order.${couponLine}\n\nThis code expires in 48h. Reply here to checkout!`;

          const sent = await sendRecoveryMessage(ctx);
          if (sent) {
            await supabase
              .from("abandoned_carts")
              .update({
                third_reminder_sent_at: now,
                third_reminder_at: now,
                status: "expired", // mark expired so we don't keep messaging
                coupon_code: coupon?.code || cart.coupon_code,
              })
              .eq("id", cart.id);
            stats.step3++;
            stats.expired++;
          } else {
            stats.errors++;
          }
          continue;
        }

        // ─── Auto-expire carts older than 7 days with no recovery ───
        if (hours >= 168 && cart.status === "abandoned") {
          await supabase
            .from("abandoned_carts")
            .update({ status: "expired" })
            .eq("id", cart.id);
          stats.expired++;
        }
      } catch (cartErr) {
        console.error("[RECOVERY] cart processing error:", cartErr.message);
        stats.errors++;
      }
    }

    return NextResponse.json({ success: true, processed: stats, at: now });
  } catch (err) {
    console.error("[RECOVERY] fatal:", err);
    return NextResponse.json({ error: "Server error", message: err.message }, { status: 500 });
  }
}

/**
 * Resolve the recipient info (sender ID + tokens) for sending a recovery message.
 */
async function resolveRecipient(supabase, cart) {
  try {
    // Look up the customer + conversation to get the platform sender_id
    const { data: conv } = await supabase
      .from("conversations")
      .select("id, channel, customer_id")
      .eq("id", cart.conversation_id)
      .single();
    if (!conv) return null;

    const { data: customer } = await supabase
      .from("customers")
      .select("name, phone")
      .eq("id", cart.customer_id || conv.customer_id)
      .single();

    // For WhatsApp, use the customer's phone as recipientId
    const recipientId = customer?.phone || conv.customer_id;
    if (!recipientId) return null;

    // Fetch account tokens
    const { data: account } = await supabase
      .from("accounts")
      .select("whatsapp_access_token, whatsapp_phone_number_id, instagram_access_token, instagram_page_id, facebook_access_token, facebook_page_id")
      .eq("id", cart.account_id)
      .single();
    if (!account) return null;

    const ctx = {
      channel: cart.channel || conv.channel || "whatsapp",
      recipientId,
      customerName: customer?.name || null,
    };

    if (ctx.channel === "whatsapp") {
      ctx.accessToken = account.whatsapp_access_token;
      ctx.phoneNumberId = account.whatsapp_phone_number_id;
    } else if (ctx.channel === "instagram") {
      ctx.accessToken = account.instagram_access_token;
      ctx.pageId = account.instagram_page_id;
    } else {
      ctx.accessToken = account.facebook_access_token;
      ctx.pageId = account.facebook_page_id;
    }

    return ctx;
  } catch (err) {
    console.error("[RECOVERY] resolveRecipient error:", err.message);
    return null;
  }
}
