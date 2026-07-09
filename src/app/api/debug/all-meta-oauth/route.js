/**
 * GET /api/debug/all-meta-oauth
 *
 * Returns the most recent OAuth diagnostics in the table — UNFILTERED by user.
 *
 * This endpoint exists to answer ONE question: "Are ANY diagnostics being saved
 * at all?" If this returns an empty array, the OAuth flow is crashing BEFORE
 * the saveDiagnostics() call — most likely at the token exchange step (which
 * means the Meta app's redirect_uri doesn't match, or the app is in
 * Development Mode and the user isn't a tester, or env vars are missing).
 *
 * If this returns records but /api/debug/last-meta-oauth returns "none found",
 * the issue is a user ID mismatch (team member scenario).
 *
 * Usage:
 *   https://www.sellorachat.com/api/debug/all-meta-oauth
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";

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
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized — please sign in then refresh this page." },
        { status: 401 }
      );
    }

    const db = admin();

    // Get the 10 most recent OAuth attempts in the WHOLE table (no user filter)
    const { data: allAttempts, error } = await db
      .from("meta_oauth_debug")
      .select("id, account_id, authenticated_user_id, platform, created_at, final_outcome, final_page_id, final_page_name, winning_strategy, error_detail")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to query diagnostics: " + error.message,
          hint: "If the error mentions 'relation does not exist', you need to apply migration 065_meta_oauth_debug.sql in Supabase SQL Editor.",
        },
        { status: 500 }
      );
    }

    // Also count total rows
    const { count, error: countError } = await db
      .from("meta_oauth_debug")
      .select("*", { count: "exact", head: true });

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      current_user_id: user.id,
      total_rows_in_table: countError ? "error: " + countError.message : count,
      recent_attempts: allAttempts || [],
      interpretation: interpretResults(allAttempts, user.id),
    }, { status: 200 });

  } catch (e) {
    console.error("[DEBUG ALL-META-OAUTH] error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function interpretResults(attempts, currentUserId) {
  if (!attempts || attempts.length === 0) {
    return [
      "🔴 The meta_oauth_debug table is EMPTY. This means saveDiagnostics() has never been called successfully.",
      "",
      "This can only mean one of these:",
      "  1. You haven't clicked 'Connect with Meta' since the diagnostic code was deployed.",
      "  2. The OAuth callback is crashing BEFORE it reaches saveDiagnostics() — most likely at the token exchange step.",
      "  3. The saveDiagnostics() insert is failing silently (check Vercel logs for [META-CALLBACK] Failed to save diagnostics).",
      "",
      "ACTION: Click 'Connect with Meta' once, then refresh this page. If still empty, open Vercel logs and look for [META-CALLBACK] entries.",
    ];
  }

  const messages = [
    `✅ Found ${attempts.length} recent attempt(s) in the table.`,
    "",
  ];

  const myAttempts = attempts.filter(a =>
    a.account_id === currentUserId || a.authenticated_user_id === currentUserId
  );

  if (myAttempts.length === 0) {
    messages.push("⚠️ NONE of these attempts belong to you (user ID: " + currentUserId + ").");
    messages.push("   This means you are a TEAM MEMBER and the OAuth flow is saving under the OWNER's account ID.");
    messages.push("   Recent attempts are owned by these account IDs:");
    const owners = [...new Set(attempts.map(a => a.account_id))];
    owners.forEach(o => messages.push("     - " + o));
    messages.push("");
    messages.push("   The /api/debug/last-meta-oauth endpoint SHOULD be finding these via the fallback. If it's not, the authenticated_user_id column may not exist yet — apply migration 066.");
  } else {
    messages.push("✅ " + myAttempts.length + " attempt(s) belong to you.");
    messages.push("   Visit /api/debug/last-meta-oauth to see full details.");
  }

  return messages;
}
