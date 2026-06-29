/**
 * Loyalty Tiers API
 *
 * GET  /api/loyalty/tiers
 *      Returns the merged tier list (account-specific overrides + global defaults)
 *      sorted by points_threshold ascending.
 *      Query params:
 *        customer_id=<uuid>  — also return the customer's current tier + progress
 *
 * POST /api/loyalty/tiers   (merchant)
 *      Create or update an account-specific tier override.
 *      Body: { name, display_name, points_threshold, discount_percent, color, icon, perks, is_active }
 *
 * PATCH /api/loyalty/tiers?customer_id=<uuid>&action=recalc
 *      Force a re-evaluation of the customer's tier (e.g. after a manual
 *      points adjustment). Returns the new tier + whether an upgrade happened.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import {
  getTiersForAccount,
  getTierContext,
  recalculateTier,
} from "@/lib/loyalty";

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

const VALID_TIERS = ["bronze", "silver", "gold", "platinum"];

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customer_id");
    const supabase = admin();

    const tiers = await getTiersForAccount(user.id);

    if (!customerId) {
      return NextResponse.json({ tiers });
    }

    // Resolve the customer's loyalty account to compute progress.
    const { data: customer } = await supabase
      .from("customers")
      .select("id, name, account_id")
      .eq("id", customerId)
      .eq("account_id", user.id)
      .maybeSingle();
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const { data: account } = await supabase
      .from("loyalty_accounts")
      .select("*")
      .eq("account_id", user.id)
      .eq("customer_id", customerId)
      .maybeSingle();

    const lifetimePoints = account?.lifetime_points ?? 0;
    const ctx = getTierContext(tiers, lifetimePoints);

    return NextResponse.json({
      tiers,
      account: account || null,
      lifetime_points: lifetimePoints,
      current_points: account?.points ?? 0,
      current_tier: account?.tier || ctx.currentTier?.name || null,
      current_tier_row: ctx.currentTier,
      next_tier: ctx.nextTier,
      progress_pct: ctx.progressPct,
      points_to_next: ctx.pointsToNext,
    });
  } catch (err) {
    console.error("[LOYALTY/tiers] GET error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      name, display_name, points_threshold, discount_percent,
      color, icon, perks, is_active, sort_order,
    } = body || {};

    if (!name || !VALID_TIERS.includes(name)) {
      return NextResponse.json(
        { error: `name must be one of: ${VALID_TIERS.join(", ")}` },
        { status: 400 }
      );
    }
    if (display_name === undefined || display_name === null || display_name === "") {
      return NextResponse.json({ error: "display_name is required" }, { status: 400 });
    }

    const supabase = admin();
    const payload = {
      account_id: user.id, // account-specific override
      name,
      display_name,
      points_threshold: Number(points_threshold) || 0,
      discount_percent: Number(discount_percent) || 0,
      color: color || "#8E9297",
      icon: icon || null,
      perks: Array.isArray(perks) ? perks : [],
      is_active: is_active !== false,
      sort_order: Number(sort_order) || (
        name === "bronze" ? 0 : name === "silver" ? 1 : name === "gold" ? 2 : 3
      ),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("loyalty_tiers")
      .upsert(payload, {
        onConflict: "account_id,name",
        returning: "representation",
      })
      .select()
      .single();

    if (error) {
      console.error("[LOYALTY/tiers] upsert error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tier: data });
  } catch (err) {
    console.error("[LOYALTY/tiers] POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customer_id");
    const action = searchParams.get("action");

    if (action === "recalc") {
      if (!customerId) {
        return NextResponse.json({ error: "customer_id is required for recalc" }, { status: 400 });
      }
      const result = await recalculateTier(user.id, customerId);
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[LOYALTY/tiers] PATCH error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
