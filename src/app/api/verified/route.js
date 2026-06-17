/**
 * Sellora Verified API
 * GET  /api/verified                  — check the current account's verified status
 * POST /api/verified/apply            — submit an application
 * POST /api/verified/[id]/approve     — admin only: approve application
 * POST /api/verified/[id]/reject      — admin only: reject application
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

    const admin = getAdminClient();
    const { data: account } = await admin
      .from("accounts")
      .select("id, verified_status, verified_at, verified_application")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      status: account?.verified_status || "unverified",
      verifiedAt: account?.verified_at,
      application: account?.verified_application,
    });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
