/**
 * API Keys management endpoint.
 * GET  /api/api-keys — list API keys for the authenticated user
 * POST /api/api-keys — create a new API key
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { resolveEffectiveAccount } from "@/lib/team-auth";
import { generateApiKey } from "@/lib/api-auth";

let _admin = null;
function admin() {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _admin;
}

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { effectiveAccountId } = await resolveEffectiveAccount(user);
    if (!effectiveAccountId) return NextResponse.json({ error: "No account found" }, { status: 404 });

    const db = admin();
    const { data: keys, error } = await db
      .from("api_keys")
      .select("id, name, key_prefix, permissions, last_used_at, expires_at, created_at, revoked_at")
      .eq("account_id", effectiveAccountId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ keys: keys || [] });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { effectiveAccountId } = await resolveEffectiveAccount(user);
    if (!effectiveAccountId) return NextResponse.json({ error: "No account found" }, { status: 404 });

    const { name, permissions } = await req.json();
    const { apiKey, keyHash, keyPrefix } = generateApiKey();

    const db = admin();
    const { data, error } = await db
      .from("api_keys")
      .insert({
        account_id: effectiveAccountId,
        name: name || "Default Key",
        key_hash: keyHash,
        key_prefix: keyPrefix,
        permissions: permissions || ["read"],
      })
      .select("id, name, key_prefix, permissions, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Return the plaintext API key ONLY on creation — it's never retrievable again
    return NextResponse.json({
      key: data,
      api_key: apiKey,  // plaintext — shown once, then lost forever
      warning: "Save this API key securely. It will not be shown again.",
    });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { effectiveAccountId } = await resolveEffectiveAccount(user);
    if (!effectiveAccountId) return NextResponse.json({ error: "No account found" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const keyId = searchParams.get("id");
    if (!keyId) return NextResponse.json({ error: "Key ID required" }, { status: 400 });

    const db = admin();
    const { error } = await db
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", keyId)
      .eq("account_id", effectiveAccountId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
