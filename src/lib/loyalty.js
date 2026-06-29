/**
 * Loyalty Engine — shared helpers used by the orders processor,
 * the loyalty API, and the cron-based post-delivery processor.
 *
 * Responsibilities:
 *   1. awardPointsForOrder(orderId) — credit loyalty points when an order
 *      is marked as "delivered" (1 point per 1 EGP spent, configurable
 *      via accounts.loyalty_points_per_egl).
 *   2. recalculateTier(accountId, customerId) — pick the highest tier the
 *      customer's lifetime_points qualifies them for, write it back to
 *      loyalty_accounts, and (on upgrade) record a loyalty_tier_upgrades
 *      row + send a congratulatory WhatsApp / IG / FB message.
 *   3. getTierContext(accountId, customerLifetimePoints) — pure helper
 *      returning { currentTier, nextTier, progressPct, pointsToNext }.
 *
 * All functions use the service-role client (RLS-bypass) so they can be
 * safely invoked from API routes and cron jobs.
 */

import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { sendMessage as sendMetaMessage } from "@/lib/channels/meta";

let _admin = null;
function admin() {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _admin;
}

/**
 * Get the effective loyalty_tiers rows for an account:
 *   - prefer account-specific overrides (account_id = accountId)
 *   - fall back to the global defaults (account_id IS NULL) for any tier
 *     the account hasn't overridden.
 * Returns a sorted array (bronze → platinum).
 */
export async function getTiersForAccount(accountId) {
  const supabase = admin();
  const { data, error } = await supabase
    .from("loyalty_tiers")
    .select("*")
    .or(`account_id.eq.${accountId},account_id.is.null`)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[LOYALTY] getTiersForAccount error:", error.message);
    return [];
  }

  // De-duplicate: prefer account-specific row over the global default.
  const seen = new Map();
  for (const t of data || []) {
    const existing = seen.get(t.name);
    if (!existing || (existing.account_id === null && t.account_id !== null)) {
      seen.set(t.name, t);
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Compute the current tier + progress to the next tier for a given
 * lifetime_points value. Pure function (no DB).
 *
 *   {
 *     currentTier: <tierRow|null>,
 *     nextTier:    <tierRow|null>,
 *     progressPct: 0-100,
 *     pointsToNext: <int|null>,
 *     tiers: [<all tier rows>]
 *   }
 */
export function getTierContext(tiers, lifetimePoints) {
  if (!tiers || tiers.length === 0) {
    return { currentTier: null, nextTier: null, progressPct: 0, pointsToNext: null, tiers: [] };
  }
  const sorted = [...tiers].sort((a, b) => a.points_threshold - b.points_threshold);
  let currentTier = null;
  let nextTier = null;
  for (let i = 0; i < sorted.length; i++) {
    if (lifetimePoints >= sorted[i].points_threshold) {
      currentTier = sorted[i];
      nextTier = sorted[i + 1] || null;
    }
  }
  // If the customer hasn't even reached the first tier (e.g. threshold > 0),
  // currentTier is null and nextTier is the lowest tier.
  if (!currentTier) {
    nextTier = sorted[0];
  }
  let progressPct = 0;
  let pointsToNext = null;
  if (nextTier && currentTier) {
    const span = nextTier.points_threshold - currentTier.points_threshold;
    const earned = lifetimePoints - currentTier.points_threshold;
    progressPct = span > 0 ? Math.min(100, Math.round((earned / span) * 100)) : 100;
    pointsToNext = Math.max(0, nextTier.points_threshold - lifetimePoints);
  } else if (nextTier && !currentTier) {
    // Customer is below the lowest tier threshold.
    progressPct = nextTier.points_threshold > 0
      ? Math.min(100, Math.round((lifetimePoints / nextTier.points_threshold) * 100))
      : 100;
    pointsToNext = Math.max(0, nextTier.points_threshold - lifetimePoints);
  } else if (currentTier && !nextTier) {
    // Already on the top tier.
    progressPct = 100;
  }
  return { currentTier, nextTier, progressPct, pointsToNext, tiers: sorted };
}

/**
 * Award loyalty points for a delivered order.
 *  - Idempotent: if a "purchase" loyalty_transactions row already exists
 *    for this order, we return early with { alreadyAwarded: true }.
 *  - Reads account.loyalty_enabled and account.loyalty_points_per_egl
 *    (default 1 point / 1 EGP) — only awards if loyalty is enabled.
 *  - Calls recalculateTier() after crediting.
 *
 * Returns { awarded: boolean, points: int, newBalance: int, tierUpgraded: bool, newTier: string|null }.
 */
export async function awardPointsForOrder(orderId) {
  if (!orderId) throw new Error("orderId is required");
  const supabase = admin();

  // 1. Fetch the order with the account + customer context we need.
  const { data: order, error } = await supabase
    .from("orders")
    .select(`
      id, order_number, account_id, customer_id, total, currency, status,
      accounts!inner(
        id, loyalty_enabled, loyalty_points_per_egl,
        business_name,
        whatsapp_access_token, whatsapp_phone_number_id,
        instagram_access_token, instagram_page_id,
        facebook_access_token, facebook_page_id
      ),
      customers(id, name, phone, channel)
    `)
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    console.error("[LOYALTY] awardPointsForOrder: order fetch error:", error.message);
    return { awarded: false, error: error.message };
  }
  if (!order) {
    return { awarded: false, error: "Order not found" };
  }
  if (order.status !== "delivered") {
    return { awarded: false, reason: `Order status is ${order.status}, not delivered` };
  }

  const account = Array.isArray(order.accounts) ? order.accounts[0] : order.accounts;
  if (!account) {
    return { awarded: false, reason: "Account not found" };
  }

  // Loyalty must be enabled for the merchant account.
  if (!account.loyalty_enabled) {
    return { awarded: false, reason: "Loyalty not enabled for this account" };
  }

  // 2. Idempotency check — skip if we've already credited points for this order.
  const { data: existing } = await supabase
    .from("loyalty_transactions")
    .select("id, points")
    .eq("order_id", orderId)
    .eq("reason", "purchase")
    .maybeSingle();
  if (existing) {
    return { awarded: false, alreadyAwarded: true, points: existing.points };
  }

  // 3. Compute points (1 point per 1 EGP by default, configurable).
  const pointsPerEgl = account.loyalty_points_per_egl ?? 1;
  const spent = Number(order.total) || 0;
  const points = Math.max(0, Math.floor(spent * pointsPerEgl));
  if (points === 0) {
    return { awarded: false, reason: "Order total is zero — no points to award" };
  }

  // 4. Upsert the loyalty_accounts row for this customer.
  const { data: account_row, error: upErr } = await supabase
    .from("loyalty_accounts")
    .upsert(
      {
        account_id: order.account_id,
        customer_id: order.customer_id,
      },
      { onConflict: "account_id,customer_id", returning: "representation" }
    )
    .select()
    .single();

  if (upErr || !account_row) {
    console.error("[LOYALTY] upsert loyalty_accounts failed:", upErr?.message);
    return { awarded: false, error: upErr?.message || "Upsert failed" };
  }

  const newBalance = (account_row.points || 0) + points;
  const newLifetime = (account_row.lifetime_points || 0) + points;

  // 5. Write the transaction row.
  const { error: txErr } = await supabase.from("loyalty_transactions").insert({
    account_id: order.account_id,
    customer_id: order.customer_id,
    order_id: order.id,
    points,
    reason: "purchase",
    balance_after: newBalance,
  });
  if (txErr) {
    console.error("[LOYALTY] insert transaction failed:", txErr.message);
    return { awarded: false, error: txErr.message };
  }

  // 6. Update the loyalty_accounts balance + lifetime.
  const { error: balErr } = await supabase
    .from("loyalty_accounts")
    .update({
      points: newBalance,
      lifetime_points: newLifetime,
      updated_at: new Date().toISOString(),
    })
    .eq("id", account_row.id);
  if (balErr) {
    console.error("[LOYALTY] update balance failed:", balErr.message);
  }

  // 7. Re-evaluate the tier (may trigger a congratulatory message).
  const tierResult = await recalculateTier(order.account_id, order.customer_id, {
    account,
    customerName: order.customers?.name,
    customerPhone: order.customers?.phone,
    customerChannel: order.customers?.channel,
    lifetimePoints: newLifetime,
  });

  return {
    awarded: true,
    points,
    newBalance,
    newLifetime,
    tierUpgraded: tierResult.upgraded,
    previousTier: tierResult.previousTier,
    newTier: tierResult.newTier,
  };
}

/**
 * Recalculate the tier for a customer based on their lifetime_points.
 * On upgrade:
 *   - update loyalty_accounts.tier + tier_id + tier_awarded_at
 *   - insert a loyalty_tier_upgrades row
 *   - send a congratulatory WhatsApp / IG / FB message (best-effort)
 *
 * Options:
 *   { account, customerName, customerPhone, customerChannel, lifetimePoints }
 *   If lifetimePoints is omitted we read it from loyalty_accounts.
 */
export async function recalculateTier(accountId, customerId, options = {}) {
  const supabase = admin();
  const {
    account = null,
    customerName = null,
    customerPhone = null,
    customerChannel = null,
    lifetimePoints = null,
  } = options;

  // 1. Resolve the current loyalty account row (if any).
  let accountRow = null;
  const { data: ar } = await supabase
    .from("loyalty_accounts")
    .select("*")
    .eq("account_id", accountId)
    .eq("customer_id", customerId)
    .maybeSingle();
  if (ar) accountRow = ar;

  const points = lifetimePoints ?? accountRow?.lifetime_points ?? 0;
  const previousTier = accountRow?.tier || null;

  // 2. Resolve the tier list + pick the best tier the customer qualifies for.
  const tiers = await getTiersForAccount(accountId);
  const ctx = getTierContext(tiers, points);
  const newTierRow = ctx.currentTier;
  const newTierName = newTierRow?.name || "bronze"; // default to bronze if no tiers configured

  if (!newTierRow) {
    return { upgraded: false, previousTier, newTier: null, reason: "no tiers configured" };
  }

  // 3. If the tier hasn't changed, just make sure tier_id is set.
  if (previousTier === newTierName && accountRow?.tier_id === newTierRow.id) {
    return { upgraded: false, previousTier, newTier: newTierName };
  }

  // 4. Persist the new tier.
  const updatePayload = {
    tier: newTierName,
    tier_id: newTierRow.id,
    tier_awarded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (accountRow) {
    await supabase.from("loyalty_accounts").update(updatePayload).eq("id", accountRow.id);
  } else {
    // Create the row if it didn't exist (edge case).
    await supabase.from("loyalty_accounts").upsert({
      account_id: accountId,
      customer_id: customerId,
      points: 0,
      lifetime_points: points,
      ...updatePayload,
    }, { onConflict: "account_id,customer_id" });
  }

  // 5. Detect actual *upgrade* (not just an initial assignment from bronze → bronze).
  const tierRank = { bronze: 0, silver: 1, gold: 2, platinum: 3 };
  const prevRank = previousTier ? (tierRank[previousTier] ?? 0) : -1;
  const newRank = tierRank[newTierName] ?? 0;
  const isUpgrade = newRank > prevRank;

  // 6. Record the upgrade + send congrats message (only on real upgrades).
  let messageChannel = "none";
  let messageSent = false;
  if (isUpgrade) {
    // De-duplicate: skip if we already recorded this exact upgrade in the last hour.
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { data: recentUpgrade } = await supabase
      .from("loyalty_tier_upgrades")
      .select("id")
      .eq("account_id", accountId)
      .eq("customer_id", customerId)
      .eq("new_tier", newTierName)
      .gte("created_at", oneHourAgo)
      .maybeSingle();

    if (!recentUpgrade) {
      // Send the congrats message first (best-effort) so we can record the channel.
      try {
        const channel = await sendTierCongrats({
          account,
          accountId,
          customerName,
          customerPhone,
          customerChannel,
          tier: newTierRow,
        });
        messageChannel = channel;
        messageSent = channel !== "none";
      } catch (e) {
        console.warn("[LOYALTY] sendTierCongrats failed:", e.message);
      }

      await supabase.from("loyalty_tier_upgrades").insert({
        account_id: accountId,
        customer_id: customerId,
        previous_tier: previousTier,
        new_tier: newTierName,
        points_at_upgrade: points,
        message_sent: messageSent,
        message_channel: messageChannel,
      });
    }
  }

  return {
    upgraded: isUpgrade,
    previousTier,
    newTier: newTierName,
    newTierRow,
    messageSent,
    messageChannel,
  };
}

/**
 * Send a congratulatory message when a customer reaches a new tier.
 * Uses the merchant's connected channel (WhatsApp preferred).
 * Returns the channel name used ("whatsapp" | "instagram" | "facebook" | "none").
 */
export async function sendTierCongrats({
  account = null,
  accountId = null,
  customerName = null,
  customerPhone = null,
  customerChannel = null,
  tier = null,
}) {
  if (!tier) return "none";

  const supabase = admin();
  let acct = account;
  if (!acct && accountId) {
    const { data } = await supabase
      .from("accounts")
      .select(`
        business_name,
        whatsapp_access_token, whatsapp_phone_number_id,
        instagram_access_token, instagram_page_id,
        facebook_access_token, facebook_page_id
      `)
      .eq("id", accountId)
      .maybeSingle();
    acct = data;
  }
  if (!acct) return "none";

  const name = customerName || "there";
  const business = acct.business_name || "our store";
  const perks = Array.isArray(tier.perks) ? tier.perks : [];
  const perksLine = perks.length > 0
    ? `\n\nYour ${tier.display_name} perks:\n${perks.slice(0, 4).map((p) => `• ${typeof p === "string" ? p : p.label}`).join("\n")}`
    : "";

  const message = `🎉 Congratulations ${name}! You've just been upgraded to ${tier.display_name} tier at ${business}!${perksLine}\n\nYou now get ${tier.discount_percent}% off every order. Thank you for being a loyal customer — we appreciate you! 💜`;

  // Prefer WhatsApp (always-on for sellora merchants) and fall back to IG / FB.
  if (customerPhone && acct.whatsapp_access_token && acct.whatsapp_phone_number_id) {
    try {
      await sendWhatsAppMessage({
        to: customerPhone,
        message,
        phoneNumberId: acct.whatsapp_phone_number_id,
        accessToken: acct.whatsapp_access_token,
      });
      return "whatsapp";
    } catch (e) {
      console.warn("[LOYALTY] WhatsApp congrats failed:", e.message);
    }
  }
  if (customerChannel === "instagram" && acct.instagram_access_token) {
    try {
      await sendMetaMessage({
        recipientId: customerPhone, // platform_id would be ideal; phone is a safe fallback when unavailable
        message,
        pageId: acct.instagram_page_id,
        accessToken: acct.instagram_access_token,
      });
      return "instagram";
    } catch (e) {
      console.warn("[LOYALTY] Instagram congrats failed:", e.message);
    }
  }
  if (customerChannel === "facebook" && acct.facebook_access_token) {
    try {
      await sendMetaMessage({
        recipientId: customerPhone,
        message,
        pageId: acct.facebook_page_id,
        accessToken: acct.facebook_access_token,
      });
      return "facebook";
    } catch (e) {
      console.warn("[LOYALTY] Facebook congrats failed:", e.message);
    }
  }

  return "none";
}
