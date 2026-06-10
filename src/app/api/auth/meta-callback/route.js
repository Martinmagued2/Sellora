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

  // Debug: Log callback receipt (no sensitive data)
  console.log("[META-CALLBACK] OAuth callback received");
  console.log("[META-CALLBACK] Params received");

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

  // SECURITY: Verify the user is authenticated before processing the OAuth callback
  const { createServerClient: createServerClientSSR } = await import("@supabase/ssr");
  const { cookies: getCookies } = await import("next/headers");

  let authenticatedUserId = null;
  try {
    const cookieStore = await getCookies();
    const supabaseAuth = createServerClientSSR(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { getAll() { return cookieStore.getAll(); } } }
    );
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
    if (!authErr && user) {
      authenticatedUserId = user.id;
    }
  } catch (e) {
    console.warn("[META-CALLBACK] Could not verify user session:", e.message);
  }

  // Parse the state: "instagram_{accountId}" or "facebook_{accountId}"
  const [platform, ...accountIdParts] = state.split("_");
  const accountId = accountIdParts.join("_");

  // SECURITY: Verify accountId from state matches the authenticated user
  if (authenticatedUserId && accountId !== authenticatedUserId) {
    console.error(`[META-CALLBACK] Account ID mismatch: state=${accountId}, auth=${authenticatedUserId}`);
    return NextResponse.redirect(
      redirectUrl("/dashboard/settings?tab=channels&error=auth_mismatch")
    );
  }

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
    console.log("[META-CALLBACK] Token exchange successful");

    // Extract page IDs from granular_scopes if available
    // Facebook includes the specific page IDs the user authorized in granular_scopes
    let pageIdsFromScopes = [];
    if (tokenData.granular_scopes) {
      console.log("[META-CALLBACK] Granular scopes:", JSON.stringify(tokenData.granular_scopes));
      for (const scope of tokenData.granular_scopes) {
        if (scope.target_ids && scope.target_ids.length > 0) {
          for (const tid of scope.target_ids) {
            if (!pageIdsFromScopes.includes(tid)) {
              pageIdsFromScopes.push(tid);
            }
          }
        }
      }
      console.log("[META-CALLBACK] Page IDs from granular_scopes:", pageIdsFromScopes);
    }

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

    // ─── Step 4: Get the user's Facebook Pages (multiple fallback strategies) ───

    let pageId = null;
    let pageAccessToken = null;
    let pageName = null;

    // Strategy A: Standard /me/accounts endpoint
    const pagesResponse = await fetch(
      `${META_API_URL}/me/accounts?fields=id,name,access_token,picture{url}&access_token=${longLivedToken}`,
      { method: "GET" }
    );
    const pagesData = await pagesResponse.json();
    console.log("[META-CALLBACK] Strategy A (/me/accounts):", pagesData.data?.length || 0, "pages");

    if (pagesData.data && pagesData.data.length > 0) {
      const page = pagesData.data[0];
      pageId = page.id;
      pageAccessToken = page.access_token;
      pageName = page.name;
      console.log(`[META-CALLBACK] Found Page via Strategy A: ${pageName} (${pageId})`);
    }

    // Strategy B: Try /me/accounts with broader fields (sometimes needed for New Pages Experience)
    if (!pageId) {
      console.log("[META-CALLBACK] Strategy A failed, trying Strategy B...");
      const pagesResponse2 = await fetch(
        `${META_API_URL}/me/accounts?fields=id,name,access_token&limit=100&access_token=${longLivedToken}`,
        { method: "GET" }
      );
      const pagesData2 = await pagesResponse2.json();
      console.log("[META-CALLBACK] Strategy B result:", pagesData2.data?.length || 0, "pages");

      if (pagesData2.data && pagesData2.data.length > 0) {
        const page = pagesData2.data[0];
        pageId = page.id;
        pageAccessToken = page.access_token;
        pageName = page.name;
        console.log(`[META-CALLBACK] Found Page via Strategy B: ${pageName} (${pageId})`);
      }
    }

    // Strategy C: Get user ID first, then try /{user-id}/accounts
    if (!pageId) {
      console.log("[META-CALLBACK] Strategy B failed, trying Strategy C (user-id based)...");
      const meResponse = await fetch(
        `${META_API_URL}/me?fields=id,name&access_token=${longLivedToken}`,
        { method: "GET" }
      );
      const meData = await meResponse.json();
      console.log("[META-CALLBACK] User ID:", meData.id);

      if (meData.id) {
        const userPagesResponse = await fetch(
          `${META_API_URL}/${meData.id}/accounts?fields=id,name,access_token&access_token=${longLivedToken}`,
          { method: "GET" }
        );
        const userPagesData = await userPagesResponse.json();
        console.log("[META-CALLBACK] Strategy C result:", userPagesData.data?.length || 0, "pages");

        if (userPagesData.data && userPagesData.data.length > 0) {
          const page = userPagesData.data[0];
          pageId = page.id;
          pageAccessToken = page.access_token;
          pageName = page.name;
          console.log(`[META-CALLBACK] Found Page via Strategy C: ${pageName} (${pageId})`);
        }
      }
    }

    // Strategy D: Try /me/businesses → owned_pages (for Business Manager accounts)
    if (!pageId) {
      console.log("[META-CALLBACK] Strategy C failed, trying Strategy D (Business Manager)...");
      try {
        const bizResponse = await fetch(
          `${META_API_URL}/me/businesses?fields=id,name,owned_pages{id,name,access_token}&access_token=${longLivedToken}`,
          { method: "GET" }
        );
        const bizData = await bizResponse.json();
        console.log("[META-CALLBACK] Strategy D result:", bizData.data?.length || 0, "businesses");

        if (bizData.data) {
          for (const biz of bizData.data) {
            if (biz.owned_pages?.data?.length > 0) {
              const page = biz.owned_pages.data[0];
              pageId = page.id;
              pageName = page.name;
              // owned_pages may not return access_token, try to get it separately
              if (page.access_token) {
                pageAccessToken = page.access_token;
              } else {
                const tokenRes = await fetch(
                  `${META_API_URL}/${page.id}?fields=access_token&access_token=${longLivedToken}`,
                  { method: "GET" }
                );
                const tokenData = await tokenRes.json();
                pageAccessToken = tokenData.access_token;
              }
              console.log(`[META-CALLBACK] Found Page via Strategy D: ${pageName} (${pageId})`);
              break;
            }
          }
        }
      } catch (bizErr) {
        console.warn("[META-CALLBACK] Strategy D error:", bizErr.message);
      }
    }

    // Strategy E: Use page IDs from granular_scopes (New Pages Experience)
    // When Facebook includes granular_scopes in the token response, the target_ids
    // are the Page IDs the user authorized. Access them directly.
    if (!pageId && pageIdsFromScopes.length > 0) {
      console.log("[META-CALLBACK] Trying Strategy E (direct page ID from granular_scopes)...");
      for (const pid of pageIdsFromScopes) {
        try {
          const pageInfoResponse = await fetch(
            `${META_API_URL}/${pid}?fields=id,name,access_token&access_token=${longLivedToken}`,
            { method: "GET" }
          );
          const pageInfoData = await pageInfoResponse.json();
          console.log("[META-CALLBACK] Strategy E page:", pageInfoData.id, pageInfoData.name || "unnamed");

          if (pageInfoData.id && !pageInfoData.error) {
            pageId = pageInfoData.id;
            pageName = pageInfoData.name || "Sellora Page";
            // Try to get page access token
            if (pageInfoData.access_token) {
              pageAccessToken = pageInfoData.access_token;
            } else {
              // For New Pages Experience, the user token IS the page token
              pageAccessToken = longLivedToken;
            }
            console.log(`[META-CALLBACK] Found Page via Strategy E: ${pageName} (${pageId})`);
            break;
          }
        } catch (e) {
          console.warn(`[META-CALLBACK] Strategy E error for page ${pid}:`, e.message);
        }
      }
    }

    if (!pageId) {
      console.warn("[META-CALLBACK] ALL strategies failed. User has no accessible Facebook Pages.");

      const debugInfo = `granted=${grantedPerms.join(',')}&declined=${declinedPerms.join(',')}`;

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

    console.log(`[META-CALLBACK] Using Page: ${pageName} (${pageId})`);

    const supabase = getSupabase();

    // ─── Step 4.5: Prevent duplicate page_id connections ───
    // Before saving, check if any OTHER account already has this page_id.
    // If so, clear it from the old account first to avoid duplicate routing issues.
    try {
      // Check for accounts with the same facebook_page_id
      const { data: existingFbAccounts } = await supabase
        .from("accounts")
        .select("id, email, business_name")
        .eq("facebook_page_id", pageId)
        .neq("id", accountId);

      if (existingFbAccounts && existingFbAccounts.length > 0) {
        console.warn(`[META-CALLBACK] Page ${pageId} is currently connected to ${existingFbAccounts.length} other account(s). Clearing them.`);
        for (const existingAcct of existingFbAccounts) {
          console.log(`[META-CALLBACK] Clearing Meta connection from: ${existingAcct.email} (${existingAcct.business_name})`);
          await supabase
            .from("accounts")
            .update({
              facebook_page_id: null,
              facebook_access_token: null,
              facebook_connected: false,
              instagram_page_id: null,
              instagram_access_token: null,
              instagram_connected: false,
            })
            .eq("id", existingAcct.id);
        }
      }

      // Also check for accounts with the same instagram_page_id
      const { data: existingIgAccounts } = await supabase
        .from("accounts")
        .select("id, email, business_name")
        .eq("instagram_page_id", pageId)
        .neq("id", accountId);

      if (existingIgAccounts && existingIgAccounts.length > 0) {
        console.warn(`[META-CALLBACK] IG page ${pageId} is currently connected to ${existingIgAccounts.length} other account(s). Clearing them.`);
        for (const existingAcct of existingIgAccounts) {
          // Skip if already cleared above
          if (existingFbAccounts?.some(a => a.id === existingAcct.id)) continue;
          console.log(`[META-CALLBACK] Clearing IG connection from: ${existingAcct.email} (${existingAcct.business_name})`);
          await supabase
            .from("accounts")
            .update({
              instagram_page_id: null,
              instagram_access_token: null,
              instagram_connected: false,
            })
            .eq("id", existingAcct.id);
        }
      }
    } catch (dupCheckErr) {
      console.warn("[META-CALLBACK] Duplicate check error (non-fatal):", dupCheckErr.message);
    }

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
      console.log("[META-CALLBACK] IG account found:", igAccountData.instagram_business_account?.username || "yes");

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
