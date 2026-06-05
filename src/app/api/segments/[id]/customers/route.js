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
 * GET /api/segments/[id]/customers - List customers in this segment
 */
export async function GET(req, { params }) {
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
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    const supabase = getSupabase();

    // Verify segment belongs to user
    const { data: segment } = await supabase
      .from("customer_segments")
      .select("id")
      .eq("id", id)
      .eq("account_id", user.id)
      .single();

    if (!segment) {
      return NextResponse.json({ error: "Segment not found" }, { status: 404 });
    }

    // Get customer IDs from segment_customers
    const { data: segCustomers, error: segCustErr } = await supabase
      .from("segment_customers")
      .select("customer_id, added_at")
      .eq("segment_id", id)
      .range(offset, offset + limit - 1);

    if (segCustErr) {
      return NextResponse.json({ error: "Failed to fetch segment customers" }, { status: 500 });
    }

    // Get customer details
    const customerIds = (segCustomers || []).map((sc) => sc.customer_id);
    let customers = [];

    if (customerIds.length > 0) {
      const { data: custData } = await supabase
        .from("customers")
        .select("id, name, email, phone, channel, total_spent, total_orders, tags, created_at")
        .in("id", customerIds);
      customers = custData || [];
    }

    // Get total count
    const { count } = await supabase
      .from("segment_customers")
      .select("id", { count: "exact", head: true })
      .eq("segment_id", id);

    return NextResponse.json({
      success: true,
      customers,
      total: count || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Segment customers GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
