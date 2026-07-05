import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
 * POST /api/segments/[id]/compute - Recompute segment customers
 */
export async function POST(req, { params }) {
  try {
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

    const { id } = await params;
    const supabase = getSupabase();

    // Get segment
    const { data: segment, error: segErr } = await supabase
      .from("customer_segments")
      .select("*")
      .eq("id", id)
      .eq("account_id", user.id)
      .single();

    if (segErr || !segment) {
      return NextResponse.json({ error: "Segment not found" }, { status: 404 });
    }

    const rules = segment.rules || { operator: "AND", conditions: [] };

    // Build query for matching customers
    let query = supabase.from("customers").select("id").eq("account_id", user.id);

    const ALLOWED_SEGMENT_FIELDS = [
      "total_spent", "total_orders", "tags", "created_at", "first_seen_at",
      "channel", "is_returning", "last_order_at", "name", "email", "phone"
    ];

    if (rules.conditions && rules.conditions.length > 0) {
      for (const condition of rules.conditions) {
        const { field, operator: condOp, value } = condition;
        if (!field || !condOp || value === undefined || value === "") continue;

        // SECURITY: Skip invalid field names
        if (!ALLOWED_SEGMENT_FIELDS.includes(field)) {
          continue;
        }

        switch (condOp) {
          case "greater_than":
            query = query.gte(field, Number(value));
            break;
          case "less_than":
            query = query.lte(field, Number(value));
            break;
          case "equals":
            if (field === "tags") {
              query = query.contains("tags", [value]);
            } else {
              query = query.eq(field, value);
            }
            break;
          case "contains":
            if (field === "tags") {
              query = query.contains("tags", [value]);
            } else {
              query = query.ilike(field, `%${value}%`);
            }
            break;
          case "within_days":
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - Number(value));
            query = query.gte(field, cutoff.toISOString());
            break;
          case "not_within_days":
            const cutoffBefore = new Date();
            cutoffBefore.setDate(cutoffBefore.getDate() - Number(value));
            query = query.lt(field, cutoffBefore.toISOString());
            break;
        }
      }
    }

    const { data: matchingCustomers, error: custErr } = await query;

    if (custErr) {
      return NextResponse.json({ error: "Failed to compute segment" }, { status: 500 });
    }

    const customerIds = (matchingCustomers || []).map((c) => c.id);

    // Clear old and insert new segment_customers
    await supabase.from("segment_customers").delete().eq("segment_id", id);

    if (customerIds.length > 0) {
      const inserts = customerIds.map((cid) => ({
        segment_id: id,
        customer_id: cid,
      }));
      await supabase.from("segment_customers").insert(inserts);
    }

    // Update segment with new count
    const now = new Date().toISOString();
    await supabase
      .from("customer_segments")
      .update({ customer_count: customerIds.length, last_computed_at: now })
      .eq("id", id);

    return NextResponse.json({
      success: true,
      customer_count: customerIds.length,
      last_computed_at: now,
    });
  } catch (error) {
    console.error("Segment compute error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
