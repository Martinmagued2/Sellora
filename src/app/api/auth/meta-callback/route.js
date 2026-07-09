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
 * Safe JSON fetch helper — captures both the parsed body AND the HTTP status,
 * so we can log everything to the diagnostics table even when the response
 * is an error.
 */
async function graphGet(url) {
  const res = await fetch(url, { method: "GET" });
  let body = null;
  try { body = await res.json(); } catch { try { body = await res.text(); } catch {} }
  return { status: res.status, body };
}

/**
 * GET /api/auth/meta-callback
 *
 * Meta OAuth callback handler for Instagram & Facebook connections.
 *
 * This version captures FULL raw Graph API responses at every step and
 * saves them to the `meta_oauth_debug` table so the user can inspect
 * exactly what Facebook returned — critical for debugging the
 * "No Facebook Pages found" error.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorReason = url.searchParams.get("error_reason");
  const errorMessage = url.searchParams.get("error_message");

  console.log("[META-CALLBACK] OAuth callback received");

  // Determine the public base URL
  // On Vercel, the request.url origin is internal, so we use x-forwarded-host
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const baseUrl = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : url.origin;

  console.log("[META-CALLBACK] Base URL:", baseUrl);

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
    console.error("[META-CALLBACK] Missing code or state!");
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

  // SECURITY: Verify the authenticated user is allowed to manage this account.
  if (authenticatedUserId) {
    if (authenticatedUserId === accountId) {
      console.log("[META-CALLBACK] ✅ User is the owner");
    } else {
      const supabase = getSupabase();
      const { data: membership } = await supabase
        .from("team_members")
        .select("id, role, invite_status, status")
        .eq("user_id", authenticatedUserId)
        .eq("account_id", accountId)
        .maybeSingle();

      const isAcceptedMember = membership &&
        membership.invite_status === "accepted" &&
        (membership.status === "active" || membership.status === null || membership.status === undefined);

      if (!isAcceptedMember) {
        console.error(`[META-CALLBACK] ❌ User ${authenticatedUserId} is NOT authorized to manage account ${accountId}`);
        return NextResponse.redirect(
          redirectUrl("/dashboard/settings?tab=channels&error=auth_mismatch")
        );
      }
      console.log(`[META-CALLBACK] ✅ Team member ${authenticatedUserId} authorized for account ${accountId}`);
    }
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

  const callbackUrl = redirectUrl("/api/auth/meta-callback");
  console.log("[META-CALLBACK] Token exchange redirect_uri:", callbackUrl);

  // ─── Initialize the diagnostics record that we'll save at the end ───
  const diag = {
    account_id: accountId,
    authenticated_user_id: authenticatedUserId,  // The user who actually clicked "Connect"
    platform,
    token_exchange_short: null,
    token_exchange_long: null,
    granular_scopes: null,
    permissions: null,
    user_profile: null,
    strategy_accounts_short: null,   // Strategy F (NEW)
    strategy_accounts_long: null,    // Strategy A/B
    strategy_user_accounts: null,    // Strategy C
    strategy_businesses: null,       // Strategy D
    strategy_granular_pages: null,   // Strategy E
    final_page_id: null,
    final_page_name: null,
    final_outcome: null,
    error_detail: null,
    winning_strategy: null,
  };

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
    diag.token_exchange_short = {
      status: tokenResponse.status,
      // Don't log the actual token value, just metadata
      has_access_token: !!tokenData.access_token,
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
      granular_scopes: tokenData.granular_scopes,
      error: tokenData.error,
    };

    if (tokenData.error) {
      console.error("[META-CALLBACK] Token exchange failed:", JSON.stringify(tokenData.error));
      diag.final_outcome = "error";
      diag.error_detail = `Token exchange failed: ${tokenData.error.message || JSON.stringify(tokenData.error)}`;
      await saveDiagnostics(diag);
      return NextResponse.redirect(
        redirectUrl(`/dashboard/settings?tab=channels&error=${encodeURIComponent(tokenData.error.message || "token_exchange_failed")}`)
      );
    }

    const userAccessToken = tokenData.access_token;
    console.log("[META-CALLBACK] Token exchange successful");

    // Extract page IDs from granular_scopes if available
    let pageIdsFromScopes = [];
    if (tokenData.granular_scopes) {
      diag.granular_scopes = tokenData.granular_scopes;
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

    // ─── Step 2: Exchange for a long-lived user access token ───
    console.log("[META-CALLBACK] Got short-lived token, exchanging for long-lived...");
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
    diag.token_exchange_long = {
      status: longLivedResponse.status,
      has_access_token: !!longLivedData.access_token,
      token_type: longLivedData.token_type,
      expires_in: longLivedData.expires_in,
      error: longLivedData.error,
    };
    console.log("[META-CALLBACK] Got long-lived token");

    // ─── Step 3: Check what permissions were actually granted ───
    const permsCheck = await graphGet(
      `${META_API_URL}/me/permissions?access_token=${longLivedToken}`
    );
    diag.permissions = permsCheck;
    const permsData = permsCheck.body || {};
    const grantedPerms = (permsData.data || []).filter(p => p.status === 'granted').map(p => p.permission);
    const declinedPerms = (permsData.data || []).filter(p => p.status === 'declined').map(p => p.permission);
    console.log("[META-CALLBACK] Granted:", grantedPerms.join(", "));
    if (declinedPerms.length > 0) {
      console.warn("[META-CALLBACK] Declined:", declinedPerms.join(", "));
    }

    // Also fetch /me to confirm WHO the user is
    const meCheck = await graphGet(
      `${META_API_URL}/me?fields=id,name,email&access_token=${longLivedToken}`
    );
    diag.user_profile = meCheck;
    console.log("[META-CALLBACK] User profile:", meCheck.body?.id, meCheck.body?.name, meCheck.body?.email);

    // ─── Step 4: Get the user's Facebook Pages (multiple fallback strategies) ───

    let pageId = null;
    let pageAccessToken = null;
    let pageName = null;

    // ───── Strategy F (NEW): Try /me/accounts with the SHORT-LIVED token ─────
    // The long-lived exchange sometimes loses the granular context that lets
    // /me/accounts return pages. Try the short-lived token first.
    {
      console.log("[META-CALLBACK] Strategy F: /me/accounts with SHORT-LIVED token...");
      const r = await graphGet(
        `${META_API_URL}/me/accounts?fields=id,name,access_token,picture{url}&access_token=${userAccessToken}`
      );
      diag.strategy_accounts_short = r;
      console.log("[META-CALLBACK] Strategy F result:", r.body?.data?.length || 0, "pages");

      if (r.body?.data && r.body.data.length > 0) {
        const page = r.body.data[0];
        pageId = page.id;
        pageAccessToken = page.access_token;
        pageName = page.name;
        diag.winning_strategy = "F";
        console.log(`[META-CALLBACK] Found Page via Strategy F: ${pageName} (${pageId})`);
      }
    }

    // ───── Strategy A: Standard /me/accounts endpoint (long-lived token) ─────
    if (!pageId) {
      console.log("[META-CALLBACK] Strategy A: /me/accounts with long-lived token...");
      const r = await graphGet(
        `${META_API_URL}/me/accounts?fields=id,name,access_token,picture{url}&access_token=${longLivedToken}`
      );
      diag.strategy_accounts_long = r;
      console.log("[META-CALLBACK] Strategy A result:", r.body?.data?.length || 0, "pages");

      if (r.body?.data && r.body.data.length > 0) {
        const page = r.body.data[0];
        pageId = page.id;
        pageAccessToken = page.access_token;
        pageName = page.name;
        diag.winning_strategy = "A";
        console.log(`[META-CALLBACK] Found Page via Strategy A: ${pageName} (${pageId})`);
      }
    }

    // ───── Strategy B: Try /me/accounts with broader fields + limit=100 ─────
    if (!pageId) {
      console.log("[META-CALLBACK] Strategy B: /me/accounts limit=100...");
      const r = await graphGet(
        `${META_API_URL}/me/accounts?fields=id,name,access_token&limit=100&access_token=${longLivedToken}`
      );
      // Merge into the same diagnostic slot as A (they're the same endpoint, just different params)
      if (!diag.strategy_accounts_long) diag.strategy_accounts_long = r;
      else diag.strategy_accounts_long_strategy_b = r;
      console.log("[META-CALLBACK] Strategy B result:", r.body?.data?.length || 0, "pages");

      if (r.body?.data && r.body.data.length > 0) {
        const page = r.body.data[0];
        pageId = page.id;
        pageAccessToken = page.access_token;
        pageName = page.name;
        diag.winning_strategy = "B";
        console.log(`[META-CALLBACK] Found Page via Strategy B: ${pageName} (${pageId})`);
      }
    }

    // ───── Strategy C: Get user ID first, then /{user-id}/accounts ─────
    if (!pageId) {
      console.log("[META-CALLBACK] Strategy C: /{user-id}/accounts...");
      const userId = meCheck.body?.id;
      if (userId) {
        const r = await graphGet(
          `${META_API_URL}/${userId}/accounts?fields=id,name,access_token&access_token=${longLivedToken}`
        );
        diag.strategy_user_accounts = r;
        console.log("[META-CALLBACK] Strategy C result:", r.body?.data?.length || 0, "pages");

        if (r.body?.data && r.body.data.length > 0) {
          const page = r.body.data[0];
          pageId = page.id;
          pageAccessToken = page.access_token;
          pageName = page.name;
          diag.winning_strategy = "C";
          console.log(`[META-CALLBACK] Found Page via Strategy C: ${pageName} (${pageId})`);
        }
      }
    }

    // ───── Strategy D: /me/businesses → owned_pages ─────
    if (!pageId) {
      console.log("[META-CALLBACK] Strategy D: Business Manager → owned_pages...");
      try {
        const r = await graphGet(
          `${META_API_URL}/me/businesses?fields=id,name,owned_pages{id,name,access_token}&access_token=${longLivedToken}`
        );
        diag.strategy_businesses = r;
        console.log("[META-CALLBACK] Strategy D result:", r.body?.data?.length || 0, "businesses");

        if (r.body?.data) {
          for (const biz of r.body.data) {
            if (biz.owned_pages?.data?.length > 0) {
              const page = biz.owned_pages.data[0];
              pageId = page.id;
              pageName = page.name;
              if (page.access_token) {
                pageAccessToken = page.access_token;
              } else {
                const tokenRes = await graphGet(
                  `${META_API_URL}/${page.id}?fields=access_token&access_token=${longLivedToken}`
                );
                pageAccessToken = tokenRes.body?.access_token;
              }
              diag.winning_strategy = "D";
              console.log(`[META-CALLBACK] Found Page via Strategy D: ${pageName} (${pageId})`);
              break;
            }
          }
        }
      } catch (bizErr) {
        console.warn("[META-CALLBACK] Strategy D error:", bizErr.message);
      }
    }

    // ───── Strategy E: Use page IDs from granular_scopes (NPE) ─────
    if (!pageId && pageIdsFromScopes.length > 0) {
      console.log("[META-CALLBACK] Strategy E: direct page lookup via granular_scopes target_ids...");
      const eResults = [];
      for (const pid of pageIdsFromScopes) {
        try {
          const r = await graphGet(
            `${META_API_URL}/${pid}?fields=id,name,access_token&access_token=${longLivedToken}`
          );
          eResults.push({ page_id: pid, response: r });
          console.log("[META-CALLBACK] Strategy E page:", r.body?.id, r.body?.name || "unnamed");

          if (r.body?.id && !r.body?.error) {
            pageId = r.body.id;
            pageName = r.body.name || "Sellora Page";
            if (r.body.access_token) {
              pageAccessToken = r.body.access_token;
            } else {
              // For New Pages Experience, the user token IS the page token
              pageAccessToken = longLivedToken;
            }
            diag.winning_strategy = "E";
            console.log(`[META-CALLBACK] Found Page via Strategy E: ${pageName} (${pageId})`);
            break;
          }
        } catch (e) {
          eResults.push({ page_id: pid, error: e.message });
          console.warn(`[META-CALLBACK] Strategy E error for page ${pid}:`, e.message);
        }
      }
      diag.strategy_granular_pages = eResults;
    }

    // ─── If we STILL have no page, save diagnostics and redirect with error ───
    if (!pageId) {
      console.warn("[META-CALLBACK] ALL strategies failed. User has no accessible Facebook Pages.");

      const debugInfo = `granted=${grantedPerms.join(',')}&declined=${declinedPerms.join(',')}`;

      const pagesPermDeclined = declinedPerms.some(p =>
        ['pages_show_list', 'pages_messaging', 'pages_read_engagement'].includes(p)
      );

      diag.final_outcome = pagesPermDeclined ? "pages_perm_declined" : "no_pages";
      diag.error_detail = debugInfo;
      await saveDiagnostics(diag);

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
    diag.final_page_id = pageId;
    diag.final_page_name = pageName;

    const supabase = getSupabase();

    // ─── Step 4.5: Prevent duplicate page_id connections ───
    try {
      const { data: existingFbAccounts } = await supabase
        .from("accounts")
        .select("id, email, business_name")
        .eq("facebook_page_id", pageId)
        .neq("id", accountId);

      if (existingFbAccounts && existingFbAccounts.length > 0) {
        console.warn(`[META-CALLBACK] Page ${pageId} is currently connected to ${existingFbAccounts.length} other account(s). Clearing them.`);
        for (const existingAcct of existingFbAccounts) {
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

      const { data: existingIgAccounts } = await supabase
        .from("accounts")
        .select("id, email, business_name")
        .eq("instagram_page_id", pageId)
        .neq("id", accountId);

      if (existingIgAccounts && existingIgAccounts.length > 0) {
        for (const existingAcct of existingIgAccounts) {
          if (existingFbAccounts?.some(a => a.id === existingAcct.id)) continue;
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
        meta_user_access_token: longLivedToken,
      })
      .eq("id", accountId);

    if (fbUpdateError) {
      console.error("[META-CALLBACK] Facebook DB update failed:", fbUpdateError);
    } else {
      console.log(`[META-CALLBACK] Facebook connected: ${pageName} (saved both page + user tokens)`);
    }

    // ─── Step 6: Try to connect Instagram via the Page's IG Business Account ───
    let instagramConnected = false;
    try {
      console.log("[META-CALLBACK] Checking page", pageId, "for IG Business Account using USER token...");
      const igAccountResponse = await fetch(
        `${META_API_URL}/${pageId}?fields=instagram_business_account{id,name,username,profile_picture_url}&access_token=${longLivedToken}`,
        { method: "GET" }
      );

      const igAccountData = await igAccountResponse.json();
      console.log("[META-CALLBACK] IG lookup response (full):", JSON.stringify(igAccountData));

      if (igAccountData.instagram_business_account) {
        const igAccount = igAccountData.instagram_business_account;
        console.log("[META-CALLBACK] ✅ Found IG Business Account:", igAccount.username || igAccount.id);

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
        console.log("[META-CALLBACK] ❌ No IG on first page. Trying ALL pages with IG field...");
        const allPagesResponse = await fetch(
          `${META_API_URL}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=100&access_token=${longLivedToken}`,
          { method: "GET" }
        );
        const allPagesData = await allPagesResponse.json();

        if (allPagesData.data) {
          for (const p of allPagesData.data) {
            if (p.instagram_business_account) {
              console.log(`[META-CALLBACK] ✅ Found IG on page: ${p.name}`);
              const { error: igUpdateError } = await supabase
                .from("accounts")
                .update({
                  instagram_page_id: p.id,
                  instagram_access_token: p.access_token,
                  instagram_connected: true,
                })
                .eq("id", accountId);

              if (!igUpdateError) {
                instagramConnected = true;
                console.log(`[META-CALLBACK] Instagram connected: @${p.instagram_business_account.username}`);
                break;
              }
            }
          }
        }

        if (!instagramConnected) {
          console.log("[META-CALLBACK] ❌ No Instagram Business Account linked to ANY page");
        }
      }
    } catch (igErr) {
      console.warn("[META-CALLBACK] IG lookup error:", igErr.message);
    }

    // ─── Step 7: Save diagnostics and redirect ───
    diag.final_outcome = (platform === "instagram" && !instagramConnected) ? "no_instagram_account" : "success";
    await saveDiagnostics(diag);

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
    diag.final_outcome = "error";
    diag.error_detail = err.message;
    await saveDiagnostics(diag);
    return NextResponse.redirect(
      redirectUrl(`/dashboard/settings?tab=channels&error=${encodeURIComponent(err.message || "unknown_error")}`)
    );
  }
}

/**
 * Save the diagnostics record to the meta_oauth_debug table.
 * Failures here are non-fatal — we still want the OAuth flow to complete.
 */
async function saveDiagnostics(diag) {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("meta_oauth_debug")
      .insert(diag);
    if (error) {
      console.warn("[META-CALLBACK] Failed to save diagnostics:", error.message);
    } else {
      console.log("[META-CALLBACK] ✅ Diagnostics saved to meta_oauth_debug");
    }
  } catch (e) {
    console.warn("[META-CALLBACK] Diagnostics save error (non-fatal):", e.message);
  }
}
