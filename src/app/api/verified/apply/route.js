/** POST /api/verified/apply — submit a verified application */
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

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { business_name, business_type, registration_number, website, social_links, monthly_orders, notes } = await req.json();

    const admin = getAdminClient();

    // Check current status
    const { data: account } = await admin
      .from("accounts")
      .select("verified_status")
      .eq("id", user.id)
      .single();

    if (account?.verified_status === "verified") {
      return NextResponse.json({ error: "Already verified" }, { status: 400 });
    }
    if (account?.verified_status === "pending") {
      return NextResponse.json({ error: "Application already pending" }, { status: 400 });
    }

    const application = {
      business_name, business_type, registration_number, website,
      social_links, monthly_orders, notes,
      submitted_at: new Date().toISOString(),
    };

    await admin
      .from("accounts")
      .update({
        verified_status: "pending",
        verified_application: application,
      })
      .eq("id", user.id);

    return NextResponse.json({ success: true, status: "pending" });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
