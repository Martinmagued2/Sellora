/**
 * Meta OAuth Callback — handles the redirect from Facebook Login
 * GET /api/auth/meta-callback?code=XXX&state=XXX
 *
 * 1. Exchanges the auth code for a User Access Token
 * 2. Gets the user's Pages (with Page Access Tokens)
 * 3. Gets Instagram Business accounts linked to those Pages
 * 4. Saves everything to the user's account in Supabase
 * 5. Redirects back to Sellora dashboard with success/error
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
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sellora-ruby.vercel.app";

  // Handle OAuth error (user declined)
  if (error) {
    return NextResponse.redirect(`${baseUrl}/dashboard/settings?tab=channels&error=permission_denied`);
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/dashboard/settings?tab=channels&error=no_code`);
  }

  // Parse state
  let platform = "facebook";
  try {
    const stateData = JSON.parse(Buffer.from(state, "base64url").toString());
    platform = stateData.platform;
  } catch (e) { /* default to facebook */ }

  const appId = process.env.NEXT_PUBLIC_META_APP_ID || process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = `${baseUrl}/api/auth/meta-callback`;

  if (!appId || !appSecret) {
    return NextResponse.redirect(`${baseUrl}/dashboard/settings?tab=channels&error=app_not_configured`);
  }

  try {
    // Step 1: Exchange code for User Access Token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `client_id=${appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&client_secret=${appSecret}` +
      `&code=${code}`
    );
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("[META-CALLBACK] Token exchange failed:", tokenData);
      return NextResponse.redirect(`${baseUrl}/dashboard/settings?tab=channels&error=token_failed`);
    }

    const userAccessToken = tokenData.access_token;

    // Step 2: Get the user's Pages (with Page Access Tokens)
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?` +
      `fields=id,name,access_token,instagram_business_account&` +
      `access_token=${userAccessToken}`
    );
    const pagesData = await pagesRes.json();

    if (!pagesData.data || pagesData.data.length === 0) {
      return NextResponse.redirect(`${baseUrl}/dashboard/settings?tab=channels&error=no_pages`);
    }

    // Step 3: Get the authenticated user's ID from Supabase
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.redirect(`${baseUrl}/login`);
    }

    const admin = getAdminClient();

    // Step 4: Find the first page with an Instagram business account (if any)
    let fbPageId = null;
    let fbPageToken = null;
    let igBusinessId = null;
    let igPageId = null;

    for (const page of pagesData.data) {
      if (!fbPageId) {
        fbPageId = page.id;
        fbPageToken = page.access_token;
      }
      if (page.instagram_business_account?.id && !igBusinessId) {
        igBusinessId = page.instagram_business_account.id;
        igPageId = page.id; // IG uses the same page ID for messaging
      }
    }

    // Step 5: Save to the user's account
    const update = {};
    if (fbPageId) {
      update.facebook_connected = true;
      update.facebook_page_id = fbPageId;
      update.facebook_access_token = fbPageToken;
    }
    if (igBusinessId) {
      update.instagram_connected = true;
      update.instagram_page_id = igPageId || fbPageId;
      update.instagram_access_token = fbPageToken; // IG uses page token
      // Store IG business ID in a metadata column or reuse existing
    }

    await admin.from("accounts").update(update).eq("id", user.id);

    // Step 6: Redirect back with success
    const connectedParam = igBusinessId ? "instagram" : "facebook";
    return NextResponse.redirect(
      `${baseUrl}/dashboard/settings?tab=channels&connected=${connectedParam}`
    );
  } catch (err) {
    console.error("[META-CALLBACK] error:", err);
    return NextResponse.redirect(
      `${baseUrl}/dashboard/settings?tab=channels&error=server_error&debug=${encodeURIComponent(err.message)}`
    );
  }
}
