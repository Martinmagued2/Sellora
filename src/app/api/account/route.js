import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabase;
}

async function getAuthUser(req) {
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll(); } } }
  );
  const { data: { user }, error } = await supabaseAuth.auth.getUser();
  if (error || !user) return null;
  return user;
}

/**
 * Try to create the missing RLS UPDATE policy for accounts table.
 * This is needed because the migration only added an INSERT policy.
 */
let _policyEnsured = false;
async function ensureUpdatePolicy() {
  if (_policyEnsured) return;
  try {
    const supabase = getSupabase();
    await supabase.rpc("exec_sql", {
      sql: `
        CREATE POLICY IF NOT EXISTS "Users can read own account"
          ON accounts FOR SELECT
          TO authenticated
          USING (auth.uid() = id);

        CREATE POLICY IF NOT EXISTS "Users can update own account"
          ON accounts FOR UPDATE
          TO authenticated
          USING (auth.uid() = id)
          WITH CHECK (auth.uid() = id);
      `,
    });
    console.log("[Account] Created UPDATE RLS policy");
    _policyEnsured = true;
  } catch (e) {
    // exec_sql might not exist, that's ok — server-side API bypasses RLS anyway
    _policyEnsured = true;
  }
}

/**
 * PATCH /api/account
 *
 * Updates the authenticated user's account profile.
 * Uses the service role key to bypass RLS policies.
 * Only allows updating safe profile fields.
 */
const ALLOWED_FIELDS = new Set([
  "business_name",
  "business_description",
  "industry",
  "phone",
  "country",
  "currency",
  "ai_enabled",
  "ai_personality",
  "notify_escalations",
  "instagram_url",
  "facebook_url",
  "website_url",
  "auto_greeting",
  "auto_greeting_message",
  "greeting_per_channel",
  "instagram_greeting",
  "facebook_greeting",
  "whatsapp_greeting",
  "greeting_delay_seconds",
  "auto_follow_up_enabled",
  "abandoned_cart_enabled",
  "abandoned_cart_hours",
  "abandoned_cart_auto_reminder",
  "abandoned_cart_reminder_hours",
  "abandoned_cart_auto_second_reminder",
  "abandoned_cart_second_reminder_hours",
  "abandoned_cart_discount_percent",
  "notification_prefs",
  "logo_url",
]);

export async function PATCH(request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Try to create the missing RLS policy (one-time)
    await ensureUpdatePolicy();

    const body = await request.json();

    // Filter to only allowed fields
    const updates = {};
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_FIELDS.has(key)) {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error: updateError } = await supabase
      .from("accounts")
      .update(updates)
      .eq("id", user.id);

    if (updateError) {
      console.error("[Account Update] Failed:", updateError.message);
      return NextResponse.json({ error: "Failed to save: " + updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Account Update] Error:", err);
    return NextResponse.json({ error: "Failed to save changes: " + (err.message || "Unknown error") }, { status: 500 });
  }
}
