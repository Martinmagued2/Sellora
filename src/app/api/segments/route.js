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
 * GET /api/segments - List segments for account
 */
export async function GET() {
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

    const supabase = getSupabase();

    // Ensure tables exist
    await ensureTables(supabase);

    const { data, error } = await supabase
      .from("customer_segments")
      .select("*")
      .eq("account_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch segments" }, { status: 500 });
    }

    return NextResponse.json({ success: true, segments: data || [] });
  } catch (error) {
    console.error("Segments GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/segments - Create a new segment
 */
export async function POST(req) {
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

    const body = await req.json();
    const { name, description, color, icon, rules, is_dynamic } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Segment name is required" }, { status: 400 });
    }

    const supabase = getSupabase();
    await ensureTables(supabase);

    const { data, error } = await supabase
      .from("customer_segments")
      .insert({
        account_id: user.id,
        name: name.trim(),
        description: description || null,
        color: color || "#5865F2",
        icon: icon || "Users",
        rules: rules || { operator: "AND", conditions: [] },
        is_dynamic: is_dynamic !== false,
        customer_count: 0,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to create segment: " + error.message }, { status: 500 });
    }

    // Auto-compute customer count
    if (data.is_dynamic && data.rules && data.rules.conditions && data.rules.conditions.length > 0) {
      const count = await computeSegmentCustomers(supabase, user.id, data.id, data.rules);
      await supabase.from("customer_segments").update({ customer_count: count, last_computed_at: new Date().toISOString() }).eq("id", data.id);
      data.customer_count = count;
      data.last_computed_at = new Date().toISOString();
    }

    return NextResponse.json({ success: true, segment: data });
  } catch (error) {
    console.error("Segments POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Compute matching customers for segment rules and update segment_customers table
 */
async function computeSegmentCustomers(supabase, accountId, segmentId, rules) {
  let query = supabase.from("customers").select("id").eq("account_id", accountId);

  if (!rules || !rules.conditions || rules.conditions.length === 0) {
    const { count } = await supabase.from("customers").select("id", { count: "exact", head: true }).eq("account_id", accountId);
    return count || 0;
  }

  const operator = rules.operator || "AND";

  for (const condition of rules.conditions) {
    const { field, operator: condOp, value } = condition;
    if (!field || !condOp || value === undefined || value === "") continue;

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

  const { data: matchingCustomers, error } = await query;
  if (error || !matchingCustomers) return 0;

  // Clear old segment_customers and insert new ones
  await supabase.from("segment_customers").delete().eq("segment_id", segmentId);

  if (matchingCustomers.length > 0) {
    const inserts = matchingCustomers.map((c) => ({
      segment_id: segmentId,
      customer_id: c.id,
    }));
    await supabase.from("segment_customers").insert(inserts);
  }

  return matchingCustomers.length;
}

/**
 * Ensure customer_segments and segment_customers tables exist
 */
async function ensureTables(supabase) {
  const { error: testErr } = await supabase.from("customer_segments").select("id").limit(1);
  if (testErr && (testErr.message?.includes("relation") || testErr.code === "42P01")) {
    // Table doesn't exist, try to create via RPC
    try {
      await supabase.rpc("exec_sql", {
        query: `
          CREATE TABLE IF NOT EXISTS customer_segments (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            description TEXT,
            color TEXT DEFAULT '#5865F2',
            icon TEXT DEFAULT 'Users',
            rules JSONB NOT NULL DEFAULT '{}',
            is_dynamic BOOLEAN DEFAULT true,
            customer_count INTEGER DEFAULT 0,
            last_computed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS segment_customers (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            segment_id UUID NOT NULL REFERENCES customer_segments(id) ON DELETE CASCADE,
            customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
            added_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(segment_id, customer_id)
          );
          CREATE INDEX IF NOT EXISTS idx_segments_account ON customer_segments(account_id);
          CREATE INDEX IF NOT EXISTS idx_segment_customers_segment ON segment_customers(segment_id);
          CREATE INDEX IF NOT EXISTS idx_segment_customers_customer ON segment_customers(customer_id);
          ALTER TABLE customer_segments ENABLE ROW LEVEL SECURITY;
          ALTER TABLE segment_customers ENABLE ROW LEVEL SECURITY;
        `,
      });
    } catch (e) {
      console.warn("Could not auto-create segments tables:", e.message);
    }
  }
}

export { computeSegmentCustomers };
