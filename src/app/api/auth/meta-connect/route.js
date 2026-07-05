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
 * PREREQUISITES (one-time setup by Sellora owner):
 * 1. In Meta Developer → your app → Facebook Login → Settings:
 *    - Add OAuth redirect URI: https://sellorachat.com/api/auth/meta-callback
 * 2. In App Review → request: pages_messaging, pages_show_list, instagram_manage_messages
 * 3. Set env vars: META_APP_ID, META_APP_SECRET
 */

import { NextResponse } from "next/server";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform") || "facebook";

  const appId = process.env.NEXT_PUBLIC_META_APP_ID || process.env.META_APP_ID;
  if (!appId) {
    return NextResponse.json({ error: "META_APP_ID not configured" }, { status: 500 });
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://sellorachat.com"}/api/auth/meta-callback`;

  // Permissions needed for FB + IG messaging
  const scopes = [
    "pages_show_list",
    "pages_messaging",
    "pages_manage_metadata",
    "instagram_basic",
    "instagram_manage_messages",
    "pages_read_engagement",
  ].join(",");

  // State parameter to prevent CSRF + track which platform
  const state = Buffer.from(JSON.stringify({ platform, ts: Date.now() })).toString("base64url");

  const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?` +
    `client_id=${appId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&response_type=code` +
    `&state=${state}`;

  return NextResponse.redirect(authUrl);
}
