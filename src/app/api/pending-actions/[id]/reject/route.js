/** Reject Pending Action — POST /api/pending-actions/[id]/reject */
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

export async function POST(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const admin = getAdminClient();

    const { error } = await admin
      .from("pending_actions")
      .update({
        status: "rejected",
        decided_by: user.id,
        decided_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("account_id", user.id)
      .eq("status", "pending");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PENDING-ACTIONS] reject error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
