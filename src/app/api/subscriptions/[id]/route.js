/** PATCH /api/subscriptions/[id] — pause/resume/cancel */
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

export async function PATCH(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { action } = await req.json(); // pause | resume | cancel
    const admin = getAdminClient();

    const update = {};
    if (action === "pause") update.status = "paused";
    else if (action === "resume") {
      update.status = "active";
      // Reset next_order_at to frequency_days from now
      const { data: sub } = await admin.from("subscriptions").select("frequency_days").eq("id", id).single();
      if (sub) update.next_order_at = new Date(Date.now() + sub.frequency_days * 86400_000).toISOString();
    } else if (action === "cancel") update.status = "cancelled";
    else return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    const { data, error } = await admin
      .from("subscriptions")
      .update(update)
      .eq("id", id)
      .eq("account_id", user.id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ subscription: data });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
