/** GET /api/templates — list WhatsApp template library + account-submitted templates */
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
    const { data } = await admin.from("wa_template_library").select("*").order("category", { ascending: true });
    return NextResponse.json({ templates: data || [] });
  } catch (e) { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}
