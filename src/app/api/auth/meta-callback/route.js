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
 * We use only Facebook Page scopes that work in Dev Mode:
 *   pages_messaging, pages_read_engagement, pages_show_list, pages_manage_metadata
 *
 * From the Page access token we can:
 *   - Connect Facebook Messenger immediately
 *   - Detect & connect Instagram Business Account linked to the Page
 *
 * Flow:
 *   1. User clicks "Connect with Meta" in Settings
 *   2. Meta OAuth dialog authorizes the app with Page scopes
 *   3. Meta redirects here with ?code=...&state=instagram_{accountId}|facebook_{accountId}
 *   4. We exchange the code for a user access token
 *   5. We fetch the user's Facebook Pages (with page access tokens)
 *   6. For Instagram state: we also try to resolve the IG Business Account
 *   7. We ALWAYS connect both platforms from the same Page
 *   8. Redirect back to /dashboard/settings?tab=channels&connected=instagram|facebook
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
    if (error === "access_denied" || errorReason === "user_denied") {
      return NextResponse.redirect(
        getRedirectUrl("/dashboard/settings?tab=channels&error=user_denied")
      );
    }
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
  const accountId = accountIdParts.join("_"); // Handle UUIDs

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
    const longLivedToken = longLivedData.access_token || userAccessToken;

    // ─── Step 3: Check what permissions were actually granted ───
    const permsResponse = await fetch(
      `${META_API_URL}/me/permissions?access_token=${longLivedToken}`,
      { method: "GET" }
    );
    const permsData = await permsResponse.json();
    console.log("[META-CALLBACK] Granted permissions:", JSON.stringify(permsData, null, 2));

    // Check if pages_show_list was declined
    const declinedPerms = (permsData.data || []).filter(p => p.status === 'declined').map(p => p.permission);
    if (declinedPerms.length > 0) {
      console.warn("[META-CALLBACK] Declined permissions:", declinedPerms);
    }

    // ─── Step 4: Get the user's Facebook Pages (with page access tokens) ───
    const pagesResponse = await fetch(
      `${META_API_URL}/me/accounts?fields=id,name,access_token,picture{url}&access_token=${longLivedToken}`,
      { method: "GET" }
    );

    const pagesData = await pagesResponse.json();

    console.log("[META-CALLBACK] Pages response:", JSON.stringify(pagesData, null, 2));

    if (!pagesData.data || pagesData.data.length === 0) {
      console.warn("No Facebook Pages found for this user. Full response:", pagesData);
      
      // Check if the user declined page permissions
      const pagesPermDeclined = declinedPerms.some(p => ['pages_show_list', 'pages_messaging', 'pages_read_engagement'].includes(p));
      if (pagesPermDeclined) {
        return NextResponse.redirect(
          getRedirectUrl("/dashboard/settings?tab=channels&error=pages_perm_declined")
        );
      }
      
      return NextResponse.redirect(
        getRedirectUrl("/dashboard/settings?tab=channels&error=no_pages")
      );
    }

    // Use the first page (most users have one main business page)
    const page = pagesData.data[0];
    const pageId = page.id;
    const pageAccessToken = page.access_token;
    const pageName = page.name;

    const supabase = getSupabase();

    // ─── Step 4: Always connect Facebook Messenger ───
    const fbUpdate = await supabase
      .from("accounts")
      .update({
        facebook_page_id: pageId,
        facebook_access_token: pageAccessToken,
        facebook_connected: true,
      })
      .eq("id", accountId);

    if (fbUpdate.error) {
      console.error("Failed to update Facebook connection:", fbUpdate.error);
      // Don't fail entirely - try Instagram too
    } else {
      console.log(`[META-CALLBACK] Facebook connected: ${pageName} (Page ID: ${pageId})`);
    }

    // ─── Step 5: Try to connect Instagram via the Page's IG Business Account ───
    let instagramConnected = false;
    try {
      const igAccountResponse = await fetch(
        `${META_API_URL}/${pageId}?fields=instagram_business_account{id,name,username,profile_picture_url}&access_token=${pageAccessToken}`,
        { method: "GET" }
      );

      const igAccountData = await igAccountResponse.json();
      console.log("[META-CALLBACK] IG account response:", JSON.stringify(igAccountData, null, 2));

      if (igAccountData.instagram_business_account) {
        const igAccount = igAccountData.instagram_business_account;

        // Store Instagram connection using the same Page access token
        // Instagram DMs are managed through the Facebook Page
        const igUpdate = await supabase
          .from("accounts")
          .update({
            instagram_page_id: pageId,
            instagram_access_token: pageAccessToken,
            instagram_connected: true,
          })
          .eq("id", accountId);

        if (igUpdate.error) {
          console.error("Failed to update Instagram connection:", igUpdate.error);
        } else {
          instagramConnected = true;
          console.log(`[META-CALLBACK] Instagram connected: @${igAccount.username} via Page ${pageName}`);
        }
      } else {
        console.log("[META-CALLBACK] No Instagram Business Account linked to this Page");
      }
    } catch (igErr) {
      console.warn("[META-CALLBACK] Could not resolve Instagram account:", igErr.message);
    }

    // ─── Step 6: Redirect back to settings with success ───
    // If user clicked Instagram connect but no IG account found, show specific message
    if (platform === "instagram" && !instagramConnected) {
      return NextResponse.redirect(
        getRedirectUrl("/dashboard/settings?tab=channels&error=no_instagram_account")
      );
    }

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
