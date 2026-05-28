import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const META_API_URL = "https://graph.facebook.com/v21.0";

// Lazy Supabase admin client (server-side only)
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

/**
 * GET /api/auth/meta-callback
 *
 * Meta OAuth callback handler for Instagram & Facebook connections.
 *
 * Flow:
 *   1. User clicks "Connect Instagram/Facebook" in Settings
 *   2. Meta OAuth dialog authorizes the app
 *   3. Meta redirects here with ?code=...&state=instagram_{accountId}|facebook_{accountId}
 *   4. We exchange the code for a user access token
 *   5. We fetch the user's Facebook Pages (with page access tokens)
 *   6. For Instagram: we resolve the Instagram Business Account linked to the first page
 *   7. We store the page ID + page access token in the accounts table
 *   8. We mark the channel as connected
 *   9. Redirect back to /dashboard/settings?tab=channels&connected=instagram|facebook
 */
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorReason = searchParams.get("error_reason");
  const errorMessage = searchParams.get("error_message");

  // Build the redirect URL helper
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";
  const getRedirectUrl = (path) => {
    if (isLocalEnv) return `${origin}${path}`;
    if (forwardedHost) return `https://${forwardedHost}${path}`;
    return `${origin}${path}`;
  };

  // ─── Handle user denial or Meta errors ───
  if (error) {
    console.warn(`Meta OAuth error: ${error} - ${errorMessage}`);
    return NextResponse.redirect(
      getRedirectUrl(`/dashboard/settings?tab=channels&error=${encodeURIComponent(errorReason || error)}`)
    );
  }

  // ─── Validate required params ───
  if (!code || !state) {
    return NextResponse.redirect(
      getRedirectUrl("/dashboard/settings?tab=channels&error=missing_params")
    );
  }

  // Parse the state: "instagram_{accountId}" or "facebook_{accountId}"
  const [platform, ...accountIdParts] = state.split("_");
  const accountId = accountIdParts.join("_"); // Handle UUIDs with underscores (shouldn't happen but safe)

  if (!["instagram", "facebook"].includes(platform) || !accountId) {
    console.error(`Invalid OAuth state: ${state}`);
    return NextResponse.redirect(
      getRedirectUrl("/dashboard/settings?tab=channels&error=invalid_state")
    );
  }

  // ─── Validate environment variables ───
  const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
  const META_APP_SECRET = process.env.META_APP_SECRET;

  if (!META_APP_ID || !META_APP_SECRET) {
    console.error("Missing META_APP_ID or META_APP_SECRET environment variables");
    return NextResponse.redirect(
      getRedirectUrl("/dashboard/settings?tab=channels&error=server_config")
    );
  }

  try {
    // ─── Step 1: Exchange code for short-lived user access token ───
    const tokenResponse = await fetch(
      `${META_API_URL}/oauth/access_token?` +
      `client_id=${META_APP_ID}&` +
      `client_secret=${META_APP_SECRET}&` +
      `grant_type=authorization_code&` +
      `redirect_uri=${encodeURIComponent(getRedirectUrl("/api/auth/meta-callback"))}&` +
      `code=${code}`,
      { method: "GET" }
    );

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("Meta token exchange failed:", tokenData.error);
      return NextResponse.redirect(
        getRedirectUrl(`/dashboard/settings?tab=channels&error=${encodeURIComponent(tokenData.error.message || "token_exchange_failed")}`)
      );
    }

    const userAccessToken = tokenData.access_token;

    // ─── Step 2: Exchange for a long-lived user access token ───
    const longLivedResponse = await fetch(
      `${META_API_URL}/oauth/access_token?` +
      `grant_type=fb_exchange_token&` +
      `client_id=${META_APP_ID}&` +
      `client_secret=${META_APP_SECRET}&` +
      `fb_exchange_token=${userAccessToken}`,
      { method: "GET" }
    );

    const longLivedData = await longLivedResponse.json();
    const longLivedToken = longLivedData.access_token || userAccessToken; // Fallback to short-lived if exchange fails

    // ─── Step 3: Get the user's Facebook Pages (with page access tokens) ───
    const pagesResponse = await fetch(
      `${META_API_URL}/me/accounts?fields=id,name,access_token,picture{url}&access_token=${longLivedToken}`,
      { method: "GET" }
    );

    const pagesData = await pagesResponse.json();

    if (!pagesData.data || pagesData.data.length === 0) {
      console.warn("No Facebook Pages found for this user");
      return NextResponse.redirect(
        getRedirectUrl("/dashboard/settings?tab=channels&error=no_pages")
      );
    }

    // Use the first page (most users have one main business page)
    const page = pagesData.data[0];
    const pageId = page.id;
    const pageAccessToken = page.access_token;
    const pageName = page.name;
    const pagePictureUrl = page.picture?.data?.url || null;

    const supabase = getSupabase();

    // ─── Step 4: Platform-specific processing ───
    if (platform === "instagram") {
      // For Instagram, we need to get the Instagram Business Account ID
      // linked to this Facebook Page
      const igAccountResponse = await fetch(
        `${META_API_URL}/${pageId}?fields=instagram_business_account{id,name,username,profile_picture_url}&access_token=${pageAccessToken}`,
        { method: "GET" }
      );

      const igAccountData = await igAccountResponse.json();

      if (!igAccountData.instagram_business_account) {
        console.warn("No Instagram Business Account linked to this Facebook Page");
        return NextResponse.redirect(
          getRedirectUrl("/dashboard/settings?tab=channels&error=no_instagram_account")
        );
      }

      const igAccount = igAccountData.instagram_business_account;

      // Store Instagram connection data
      const { error: updateError } = await supabase
        .from("accounts")
        .update({
          instagram_page_id: pageId,
          instagram_access_token: pageAccessToken,
          instagram_connected: true,
        })
        .eq("id", accountId);

      if (updateError) {
        console.error("Failed to update Instagram connection:", updateError);
        return NextResponse.redirect(
          getRedirectUrl("/dashboard/settings?tab=channels&error=db_update_failed")
        );
      }

      console.log(`Instagram connected: @${igAccount.username} (Page: ${pageName}) for account ${accountId}`);

    } else if (platform === "facebook") {
      // For Facebook Messenger, we just need the page ID and page access token
      const { error: updateError } = await supabase
        .from("accounts")
        .update({
          facebook_page_id: pageId,
          facebook_access_token: pageAccessToken,
          facebook_connected: true,
        })
        .eq("id", accountId);

      if (updateError) {
        console.error("Failed to update Facebook connection:", updateError);
        return NextResponse.redirect(
          getRedirectUrl("/dashboard/settings?tab=channels&error=db_update_failed")
        );
      }

      console.log(`Facebook connected: ${pageName} (Page ID: ${pageId}) for account ${accountId}`);
    }

    // ─── Step 5: Redirect back to settings with success ───
    return NextResponse.redirect(
      getRedirectUrl(`/dashboard/settings?tab=channels&connected=${platform}`)
    );

  } catch (err) {
    console.error("Meta OAuth callback error:", err);
    return NextResponse.redirect(
      getRedirectUrl(`/dashboard/settings?tab=channels&error=${encodeURIComponent(err.message || "unknown_error")}`)
    );
  }
}
