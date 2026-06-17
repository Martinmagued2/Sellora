/**
 * Loyalty API
 * GET /api/loyalty?customer_id=...  — get a customer's loyalty account + recent tx
 * POST /api/loyalty/redeem          — redeem points for store credit
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";

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
      // Single customer loyalty
      const { data: account } = await admin
        .from("loyalty_accounts")
        .select("*")
        .eq("account_id", user.id)
        .eq("customer_id", customerId)
        .maybeSingle();

      const { data: transactions } = await admin
        .from("loyalty_transactions")
        .select("*")
        .eq("account_id", user.id)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(20);

      return NextResponse.json({ account, transactions: transactions || [] });
    }

    // Top loyalty customers by points
    const { data: top } = await admin
      .from("loyalty_accounts")
      .select(`
        id, points, lifetime_points, tier,
        customers!inner(name, email, phone)
      `)
      .eq("account_id", user.id)
      .order("points", { ascending: false })
      .limit(20);

    return NextResponse.json({ accounts: top || [] });
  } catch (err) {
    console.error("[LOYALTY] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
