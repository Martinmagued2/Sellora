import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Service role client (lazy-initialized)
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
 * GET /api/campaigns/broadcast-logs?campaignId=xxx
 * Returns per-recipient delivery logs for a campaign
 */
export async function GET(req) {
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get("campaignId");

    if (!campaignId) {
      return NextResponse.json({ error: "Campaign ID is required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Verify campaign ownership
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("id")
      .eq("id", campaignId)
      .eq("account_id", user.id)
      .single();

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Fetch broadcast logs with customer info
    const { data: logs, error } = await supabase
      .from("broadcast_logs")
      .select("id, status, channel, error_message, sent_at, delivered_at, read_at, created_at, customer:customers(id, name, phone, channel)")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch broadcast logs" }, { status: 500 });
    }

    // Compute summary stats
    const summary = {
      total: logs?.length || 0,
      sent: logs?.filter(l => l.status === "sent").length || 0,
      delivered: logs?.filter(l => l.status === "delivered").length || 0,
      read: logs?.filter(l => l.status === "read").length || 0,
      failed: logs?.filter(l => l.status === "failed").length || 0,
      pending: logs?.filter(l => l.status === "pending").length || 0,
    };

    return NextResponse.json({ success: true, logs: logs || [], summary });
  } catch (error) {
    console.error("Broadcast logs GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
