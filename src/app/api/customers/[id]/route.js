/**
 * GET /api/customers/[id] — fetch a single customer's profile.
 * PATCH /api/customers/[id] — update a customer's profile (whitelisted fields only).
 *
 * SECURITY: Uses getAuthUser + canAccessAccount. Team members can access.
 * Mass-assignment prevention: only fields in CUSTOMER_ALLOWED_FIELDS are accepted.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { resolveEffectiveAccount } from "@/lib/team-auth";

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

// Whitelist of fields the user is allowed to update.
// SECURITY: Excludes account_id (would steal the customer), id, total_orders,
// total_spent, last_active_at (computed fields), created_at, updated_at.
const CUSTOMER_ALLOWED_FIELDS = new Set([
  "name",
  "phone",
  "email",
  "tags",
  "notes",
  "lifecycle_stage",
  "notes_internal",
  "next_followup_at",
  "instagram_url",
  "facebook_url",
]);

export async function GET(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { effectiveAccountId } = await resolveEffectiveAccount(user);
    if (!effectiveAccountId) {
      return NextResponse.json({ error: "No account found" }, { status: 404 });
    }

    const db = admin();
    const { data: customer, error } = await db
      .from("customers")
      .select("*")
      .eq("id", params.id)
      .eq("account_id", effectiveAccountId)  // SECURITY: ownership check
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({ customer });
  } catch (e) {
    console.error("[CUSTOMERS_GET] error:", e.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { effectiveAccountId } = await resolveEffectiveAccount(user);
    if (!effectiveAccountId) {
      return NextResponse.json({ error: "No account found" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // SECURITY: Filter to only allowed fields
    const updates = {};
    for (const [key, value] of Object.entries(body)) {
      if (CUSTOMER_ALLOWED_FIELDS.has(key)) updates[key] = value;
    }
    updates.updated_at = new Date().toISOString();

    if (Object.keys(updates).length <= 1) {
      // Only updated_at — nothing to update
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const db = admin();

    // Verify the customer belongs to the user's account
    const { data: existing, error: fetchErr } = await db
      .from("customers")
      .select("id, account_id")
      .eq("id", params.id)
      .eq("account_id", effectiveAccountId)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Apply the update
    const { data: customer, error: updateErr } = await db
      .from("customers")
      .update(updates)
      .eq("id", params.id)
      .eq("account_id", effectiveAccountId)
      .select("*")
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ customer });
  } catch (e) {
    console.error("[CUSTOMERS_PATCH] error:", e.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
