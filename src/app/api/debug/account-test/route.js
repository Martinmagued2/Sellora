/**
 * Debug endpoint — test if the client can read its own account
 * GET /api/debug/account-test
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { SAFE_ACCOUNT_FIELDS } from "@/lib/safe-fields";

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

    // Test 1: Full SAFE_ACCOUNT_FIELDS query (what Settings page uses)
    const { data: fullData, error: fullErr } = await admin
      .from("accounts")
      .select(SAFE_ACCOUNT_FIELDS)
      .eq("id", user.id)
      .single();

    // Test 2: Basic fields only
    const { data: basicData, error: basicErr } = await admin
      .from("accounts")
      .select("id, email, business_name, phone, country, currency, business_description, industry, logo_url")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      userId: user.id,
      userEmail: user.email,
      test1_full_safe_fields: {
        success: !!fullData,
        error: fullErr?.message || null,
        data: fullData,
      },
      test2_basic_fields: {
        success: !!basicData,
        error: basicErr?.message || null,
        data: basicData,
      },
      safe_fields_being_queried: SAFE_ACCOUNT_FIELDS,
    });
  } catch (err) {
    return NextResponse.json({ error: "Server error", message: err.message }, { status: 500 });
  }
}
