/**
 * Loyalty API
 * GET /api/loyalty?customer_id=...  — get a customer's loyalty account + recent tx + tier info
 * GET /api/loyalty                  — top loyalty customers by lifetime_points
 *
 * The single-customer GET now also returns:
 *   - tiers:                    list of all tier definitions for the account
 *   - current_tier_row:         the customer's current tier row (with perks, color, etc.)
 *   - next_tier:                 the next tier to reach (or null if on Platinum)
 *   - progress_pct:              0-100 progress to the next tier
 *   - points_to_next:            points needed to reach the next tier
 *   - recent_upgrades:           last 5 tier-upgrade events for the customer
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { getTiersForAccount, getTierContext } from "@/lib/loyalty";

let _adminClient = null;
function getAdminClient() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _adminClient;
}

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customer_id");
    const admin = getAdminClient();

    if (customerId) {
      // ─── Single customer loyalty ───
      const [accountRes, txRes, upgradesRes] = await Promise.all([
        admin
          .from("loyalty_accounts")
          .select("*")
          .eq("account_id", user.id)
          .eq("customer_id", customerId)
          .maybeSingle(),
        admin
          .from("loyalty_transactions")
          .select("*")
          .eq("account_id", user.id)
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(20),
        admin
          .from("loyalty_tier_upgrades")
          .select("*")
          .eq("account_id", user.id)
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const account = accountRes.data;
      const transactions = txRes.data || [];
      const recentUpgrades = upgradesRes.data || [];

      // Compute tier context.
      const tiers = await getTiersForAccount(user.id);
      const lifetimePoints = account?.lifetime_points ?? 0;
      const tierCtx = getTierContext(tiers, lifetimePoints);

      return NextResponse.json({
        account,
        transactions,
        tiers,
        lifetime_points: lifetimePoints,
        current_points: account?.points ?? 0,
        current_tier: account?.tier || tierCtx.currentTier?.name || null,
        current_tier_row: tierCtx.currentTier,
        next_tier: tierCtx.nextTier,
        progress_pct: tierCtx.progressPct,
        points_to_next: tierCtx.pointsToNext,
        recent_upgrades: recentUpgrades,
      });
    }

    // ─── Top loyalty customers by lifetime_points ───
    const { data: top } = await admin
      .from("loyalty_accounts")
      .select(`
        id, points, lifetime_points, tier, tier_id, tier_awarded_at,
        customers!inner(name, email, phone)
      `)
      .eq("account_id", user.id)
      .order("lifetime_points", { ascending: false })
      .limit(20);

    // Enrich each row with the matching tier row (best-effort, single fetch).
    const tiers = await getTiersForAccount(user.id);
    const tierByName = new Map(tiers.map((t) => [t.name, t]));
    const enriched = (top || []).map((row) => ({
      ...row,
      tier_row: row.tier_id
        ? tiers.find((t) => t.id === row.tier_id)
        : tierByName.get(row.tier) || null,
    }));

    return NextResponse.json({ accounts: enriched, tiers });
  } catch (err) {
    console.error("[LOYALTY] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
