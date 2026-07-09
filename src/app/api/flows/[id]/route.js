/** PATCH/DELETE /api/flows/[id] */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";

let _adminClient = null;
function getAdminClient() {
  if (!_adminClient) _adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _adminClient;
}

export async function PATCH(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const body = await req.json();
    const admin = getAdminClient();
    const { data, error } = await admin.from("automation_flows").update(body).eq("id", id).eq("account_id", user.id).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ flow: data });
  } catch (e) { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}

export async function DELETE(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const admin = getAdminClient();
    await admin.from("automation_flows").delete().eq("id", id).eq("account_id", user.id);
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}
