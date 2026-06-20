/**
 * Pending Actions API
 * GET /api/pending-actions?conversation_id=...  — list pending actions
 *
 * Actions are AI-proposed operations (create_order, redeem_coupon,
 * send_payment_link) that an operator must approve before execution.
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
    const conversationId = searchParams.get("conversation_id");
    const admin = getAdminClient();

    let query = admin
      .from("pending_actions")
      .select("*")
      .eq("account_id", user.id)
      .eq("status", "pending")
      .order("proposed_at", { ascending: false })
      .limit(20);

    if (conversationId) {
      query = query.eq("conversation_id", conversationId);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ actions: data || [] });
  } catch (err) {
    console.error("[PENDING-ACTIONS] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
