/** GET/POST /api/flows — list + create automation flows (visual flow builder) */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";

let _adminClient = null;
function getAdminClient() {
  if (!_adminClient) _adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _adminClient;
}

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const admin = getAdminClient();
    const { data } = await admin.from("automation_flows").select("*").eq("account_id", user.id).order("created_at", { ascending: false });
    return NextResponse.json({ flows: data || [] });
  } catch (e) { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { name, description, trigger_type, trigger_config, steps } = await req.json();
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

    const admin = getAdminClient();
    const { data, error } = await admin.from("automation_flows").insert({
      account_id: user.id, name, description, trigger_type: trigger_type || "keyword",
      trigger_config: trigger_config || {}, steps: steps || [],
    }).select("*").single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ flow: data });
  } catch (e) { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}
