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
 */
export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorReason = url.searchParams.get("error_reason");
  const errorMessage = url.searchParams.get("error_message");

  // Debug: Log everything we receive
  console.log("[META-CALLBACK] Full URL:", request.url);
  console.log("[META-CALLBACK] Code:", code ? `${code.substring(0, 10)}...` : "MISSING");
  console.log("[META-CALLBACK] State:", state || "MISSING");
  console.log("[META-CALLBACK] Error:", error || "none");
  console.log("[META-CALLBACK] All params:", Object.fromEntries(url.searchParams.entries()));

  // Determine the public base URL
  // On Vercel, the request.url origin is internal, so we use x-forwarded-host
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const baseUrl = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : url.origin;

  console.log("[META-CALLBACK] Base URL:", baseUrl);
  console.log("[META-CALLBACK] x-forwarded-host:", forwardedHost);

  const redirectUrl = (path) => `${baseUrl}${path}`;

  // ─── Handle user denial or Meta errors ───
  if (error) {
    console.warn(`[META-CALLBACK] OAuth error: ${error} - ${errorMessage}`);
    if (error === "access_denied" || errorReason === "user_denied") {
      return NextResponse.redirect(
        redirectUrl("/dashboard/settings?tab=channels&error=user_denied")
      );
    }
    return NextResponse.redirect(
      redirectUrl(`/dashboard/settings?tab=channels&error=${encodeURIComponent(errorReason || error)}`)
    );
  }

  // ─── Validate required params ───
  if (!code || !state) {
    console.error("[META-CALLBACK] Missing code or state! This usually means the redirect_uri in Meta app doesn't match the callback URL, or Facebook is not sending the auth code.");
    console.error("[META-CALLBACK] Make sure your Meta app's Valid OAuth Redirect URI includes:", redirectUrl("/api/auth/meta-callback"));
    return NextResponse.redirect(
      redirectUrl("/dashboard/settings?tab=channels&error=missing_params")
    );
  }

  // Parse the state: "instagram_{accountId}" or "facebook_{accountId}"
  const [platform, ...accountIdParts] = state.split("_");
  const accountId = accountIdParts.join("_");

  if (!["instagram", "facebook"].includes(platform) || !accountId) {
    console.error(`[META-CALLBACK] Invalid OAuth state: ${state}`);
    return NextResponse.redirect(
      redirectUrl("/dashboard/settings?tab=channels&error=invalid_state")
    );
  }

  // ─── Validate environment variables ───
  const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
  const META_APP_SECRET = process.env.META_APP_SECRET;

  if (!META_APP_ID || !META_APP_SECRET) {
    console.error("[META-CALLBACK] Missing META_APP_ID or META_APP_SECRET env vars");
    return NextResponse.redirect(
      redirectUrl("/dashboard/settings?tab=channels&error=server_config")
    );
  }

  // The redirect_uri MUST exactly match what was used in the OAuth dialog URL
  // This is the URL Facebook redirected the user to after authorization
  const callbackUrl = redirectUrl("/api/auth/meta-callback");
  console.log("[META-CALLBACK] Token exchange redirect_uri:", callbackUrl);

  try {
    // ─── Step 1: Exchange code for short-lived user access token ───
    const tokenUrl =
      `${META_API_URL}/oauth/access_token?` +
      `client_id=${META_APP_ID}&` +
      `client_secret=${META_APP_SECRET}&` +
      `grant_type=authorization_code&` +
      `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
      `code=${code}`;

    console.log("[META-CALLBACK] Exchanging code for token...");
    const tokenResponse = await fetch(tokenUrl, { method: "GET" });
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("[META-CALLBACK] Token exchange failed:", JSON.stringify(tokenData.error));
      return NextResponse.redirect(
        redirectUrl(`/dashboard/settings?tab=channels&error=${encodeURIComponent(tokenData.error.message || "token_exchange_failed")}`)
      );
    }

    const userAccessToken = tokenData.access_token;
    console.log("[META-CALLBACK] Got short-lived token, exchanging for long-lived...");

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
    console.log("[META-CALLBACK] Got long-lived token");

    // ─── Step 3: Check what permissions were actually granted ───
    const permsResponse = await fetch(
      `${META_API_URL}/me/permissions?access_token=${longLivedToken}`,
      { method: "GET" }
    );
    const permsData = await permsResponse.json();
    const grantedPerms = (permsData.data || []).filter(p => p.status === 'granted').map(p => p.permission);
    const declinedPerms = (permsData.data || []).filter(p => p.status === 'declined').map(p => p.permission);
    console.log("[META-CALLBACK] Granted:", grantedPerms.join(", "));
    if (declinedPerms.length > 0) {
      console.warn("[META-CALLBACK] Declined:", declinedPerms.join(", "));
    }

    // ─── Step 4: Get the user's Facebook Pages (with page access tokens) ───
    const pagesResponse = await fetch(
      `${META_API_URL}/me/accounts?fields=id,name,access_token,picture{url}&access_token=${longLivedToken}`,
      { method: "GET" }
    );

    const pagesData = await pagesResponse.json();
    console.log("[META-CALLBACK] Pages found:", pagesData.data?.length || 0);

    if (!pagesData.data || pagesData.data.length === 0) {
      console.warn("[META-CALLBACK] No pages returned. Full response:", JSON.stringify(pagesData));

      // Pass diagnostic info so the user can see what went wrong
      const debugInfo = `granted=${grantedPerms.join(',')}&declined=${declinedPerms.join(',')}&api_error=${pagesData.error?.message || 'none'}`;

      const pagesPermDeclined = declinedPerms.some(p =>
        ['pages_show_list', 'pages_messaging', 'pages_read_engagement'].includes(p)
      );
      if (pagesPermDeclined) {
        return NextResponse.redirect(
          redirectUrl(`/dashboard/settings?tab=channels&error=pages_perm_declined&debug=${encodeURIComponent(debugInfo)}`)
        );
      }
      return NextResponse.redirect(
        redirectUrl(`/dashboard/settings?tab=channels&error=no_pages&debug=${encodeURIComponent(debugInfo)}`)
      );
    }

    // Use the first page
    const page = pagesData.data[0];
    const pageId = page.id;
    const pageAccessToken = page.access_token;
    const pageName = page.name;
    console.log(`[META-CALLBACK] Using Page: ${pageName} (${pageId})`);

    const supabase = getSupabase();

    // ─── Step 5: Always connect Facebook Messenger ───
    const { error: fbUpdateError } = await supabase
      .from("accounts")
      .update({
        facebook_page_id: pageId,
        facebook_access_token: pageAccessToken,
        facebook_connected: true,
      })
      .eq("id", accountId);

    if (fbUpdateError) {
      console.error("[META-CALLBACK] Facebook DB update failed:", fbUpdateError);
    } else {
      console.log(`[META-CALLBACK] Facebook connected: ${pageName}`);
    }

    // ─── Step 6: Try to connect Instagram via the Page's IG Business Account ───
    let instagramConnected = false;
    try {
      const igAccountResponse = await fetch(
        `${META_API_URL}/${pageId}?fields=instagram_business_account{id,name,username,profile_picture_url}&access_token=${pageAccessToken}`,
        { method: "GET" }
      );

      const igAccountData = await igAccountResponse.json();
      console.log("[META-CALLBACK] IG account lookup:", JSON.stringify(igAccountData));

      if (igAccountData.instagram_business_account) {
        const igAccount = igAccountData.instagram_business_account;

        const { error: igUpdateError } = await supabase
          .from("accounts")
          .update({
            instagram_page_id: pageId,
            instagram_access_token: pageAccessToken,
            instagram_connected: true,
          })
          .eq("id", accountId);

        if (igUpdateError) {
          console.error("[META-CALLBACK] Instagram DB update failed:", igUpdateError);
        } else {
          instagramConnected = true;
          console.log(`[META-CALLBACK] Instagram connected: @${igAccount.username}`);
        }
      } else {
        console.log("[META-CALLBACK] No Instagram Business Account linked to Page");
      }
    } catch (igErr) {
      console.warn("[META-CALLBACK] IG lookup error:", igErr.message);
    }

    // ─── Step 7: Redirect back to settings ───
    if (platform === "instagram" && !instagramConnected) {
      return NextResponse.redirect(
        redirectUrl("/dashboard/settings?tab=channels&error=no_instagram_account")
      );
    }

    return NextResponse.redirect(
      redirectUrl(`/dashboard/settings?tab=channels&connected=${platform}`)
    );

  } catch (err) {
    console.error("[META-CALLBACK] Unhandled error:", err);
    return NextResponse.redirect(
      redirectUrl(`/dashboard/settings?tab=channels&error=${encodeURIComponent(err.message || "unknown_error")}`)
    );
  }
}
