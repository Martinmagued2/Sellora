/** POST /api/admin/verified/[id]/approve — admin only */
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

async function checkAdmin(admin, userId) {
  const { data } = await admin.from("accounts").select("role").eq("id", userId).single();
  return data?.role === "admin";
}

export async function POST(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = getAdminClient();
    if (!(await checkAdmin(admin, user.id))) {
      return NextResponse.json({ error: "Admin required" }, { status: 403 });
    }

    const { id } = await params;
    await admin
      .from("accounts")
      .update({
        verified_status: "verified",
        verified_at: new Date().toISOString(),
      })
      .eq("id", id);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
