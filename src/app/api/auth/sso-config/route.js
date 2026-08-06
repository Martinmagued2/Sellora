/**
 * GET  /api/auth/sso-config?account_id=<uuid> — get SSO config
 * POST /api/auth/sso-config — create/update SSO config
 * DELETE /api/auth/sso-config?account_id=<uuid> — remove SSO config
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { canAccessAccount } from "@/lib/team-auth";

let _admin = null;
function admin() {
  if (!_admin) _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("account_id");
    if (!accountId) return NextResponse.json({ error: "account_id required" }, { status: 400 });

    const hasAccess = await canAccessAccount(user, accountId);
    if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const db = admin();
    const { data: config } = await db
      .from("sso_configs")
      .select("*")
      .eq("account_id", accountId)
      .maybeSingle();

    // Don't return the certificate in the response
    if (config) {
      config.x509_cert = config.x509_cert ? "***configured***" : null;
    }

    return NextResponse.json({ config: config || null });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { account_id, provider_name, entity_id, sso_url, slo_url, x509_cert, name_id_format, attribute_mapping } = await req.json();

    const hasAccess = await canAccessAccount(user, account_id);
    if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const db = admin();

    // Upsert SSO config
    const { data: existing } = await db
      .from("sso_configs")
      .select("id")
      .eq("account_id", account_id)
      .maybeSingle();

    if (existing) {
      const { data, error } = await db
        .from("sso_configs")
        .update({
          provider_name, entity_id, sso_url, slo_url, x509_cert,
          name_id_format, attribute_mapping, is_active: true, updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ config: { ...data, x509_cert: "***configured***" } });
    } else {
      const { data, error } = await db
        .from("sso_configs")
        .insert({
          account_id, provider_name, entity_id, sso_url, slo_url, x509_cert,
          name_id_format, attribute_mapping, is_active: true,
        })
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ config: { ...data, x509_cert: "***configured***" } });
    }
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("account_id");
    if (!accountId) return NextResponse.json({ error: "account_id required" }, { status: 400 });

    const hasAccess = await canAccessAccount(user, accountId);
    if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const db = admin();
    await db.from("sso_configs").delete().eq("account_id", accountId);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
