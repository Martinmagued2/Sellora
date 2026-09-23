/**
 * Meta OAuth Connection — initiates the Facebook Login flow
 * GET /api/auth/meta-connect?platform=facebook|instagram
 *
 * Redirects the user to Meta's OAuth page where they:
 * 1. Log into Facebook
 * 2. Select their Facebook Pages
 * 3. Grant permissions (pages_messaging, pages_show_list, instagram_manage_messages)
 * 4. Meta redirects back to /api/auth/meta-callback
 *
 * IMPORTANT: the state parameter MUST be in the format "{platform}_{accountId}"
 * because /api/auth/meta-callback parses it with state.split("_"):
 *   const [platform, ...accountIdParts] = state.split("_");
 *   const accountId = accountIdParts.join("_");
 * The previous base64-JSON state format was incompatible and caused every
 * Instagram connect to fail with error=invalid_state (Facebook still worked
 * only because the ChannelsTab builds its own client-side OAuth URL).
 *
 * SECURITY: the accountId is taken from the authenticated Supabase session
 * (never trusted from a query param), and the callback re-verifies ownership,
 * so the state cannot be forged to connect a Page to someone else's account.
 */

import { NextResponse } from "next/server";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform") || "facebook";

  if (!["instagram", "facebook"].includes(platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  const appId = process.env.NEXT_PUBLIC_META_APP_ID || process.env.META_APP_ID;
  if (!appId) {
    return NextResponse.json({ error: "META_APP_ID not configured" }, { status: 500 });
  }

  // Resolve the authenticated user's accountId from the session
  const { createServerClient } = await import("@supabase/ssr");
  const { cookies: getCookies } = await import("next/headers");

  let accountId = null;
  try {
    const cookieStore = await getCookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { getAll() { return cookieStore.getAll(); } } }
    );
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
    if (!authErr && user) {
      accountId = user.id;
    }
  } catch (e) {
    console.warn("[META-CONNECT] Could not verify user session:", e.message);
  }

  if (!accountId) {
    // Unauthenticated — redirect to login (the callback also rejects this)
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", `/api/auth/meta-connect?platform=${platform}`);
    return NextResponse.redirect(loginUrl);
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://sellorachat.com"}/api/auth/meta-callback`;

  const scopes = [
    "pages_show_list",
    "pages_messaging",
    "pages_manage_metadata",
    "instagram_basic",
    "instagram_manage_messages",
    "pages_read_engagement",
    "business_management",
  ].join(",");

  // State format the callback parser expects: "{platform}_{accountId}"
  // (Supabase UUIDs contain no underscores, so split("_") works cleanly.)
  const state = `${platform}_${accountId}`;

  const authUrl = `https://www.facebook.com/v25.0/dialog/oauth?` +
    `client_id=${appId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&response_type=code` +
    `&state=${encodeURIComponent(state)}`;

  return NextResponse.redirect(authUrl);
}
