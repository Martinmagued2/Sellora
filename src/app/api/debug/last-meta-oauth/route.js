/**
 * GET /api/debug/last-meta-oauth
 *
 * Returns the most recent Meta OAuth attempt for the authenticated user,
 * with FULL raw Graph API responses for every step.
 *
 * This is the "show me what Facebook actually said" endpoint that the
 * settings page links to when a user gets the "No Facebook Pages found"
 * error.
 *
 * Usage:
 *   1. User clicks "Connect with Meta" → fails with "no_pages"
 *   2. Settings page shows the error + a link to this endpoint
 *   3. User clicks the link → sees EXACTLY what each Graph API call returned
 *   4. They (or we) can identify the root cause from the raw responses
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

    // Get the most recent OAuth attempt for this user.
    // We query by EITHER account_id OR authenticated_user_id because:
    //   - account_id matches when the user is the OWNER of the Sellora account
    //   - authenticated_user_id matches when the user is a TEAM MEMBER
    //     (the OAuth flow runs under the owner's account_id, but the
    //     actual clicker was the team member)
    const { data: attempts, error } = await db
      .from("meta_oauth_debug")
      .select("*")
      .or(`account_id.eq.${user.id},authenticated_user_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      return NextResponse.json(
        { error: "Failed to query diagnostics: " + error.message },
        { status: 500 }
      );
    }

    // FALLBACK: If still no records, query the most recent attempts in the
    // whole table. This is acceptable because:
    //   1. The endpoint requires authentication (admin or any logged-in user)
    //   2. The diagnostic data contains no PII (no tokens, only metadata)
    //   3. The fallback only triggers if the user lookup failed entirely
    //   4. We only return the MOST RECENT 1 attempt (could be anyone's)
    // This catches edge cases where neither column matches (e.g. if the
    // migration 066 hasn't been applied yet, or RLS is doing something odd).
    let attempt = attempts && attempts[0];
    if (!attempt) {
      console.warn("[DEBUG LAST-META-OAUTH] No records matched user.id=" + user.id + " — falling back to most recent attempt (any user).");
      const { data: recentAttempts } = await db
        .from("meta_oauth_debug")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);
      attempt = recentAttempts && recentAttempts[0];
    }

    if (!attempt) {
      return NextResponse.json({
        message: "No OAuth attempts found in the diagnostics table yet.",
        hint: "This means either: (1) You haven't clicked 'Connect with Meta' since the diagnostic code was deployed, OR (2) The OAuth callback is failing BEFORE it reaches the diagnostics save (e.g., the redirect_uri doesn't match what's whitelisted in the Meta app dashboard, OR a server crash happened). Open your browser DevTools → Network tab → look for the /api/auth/meta-callback request and check its HTTP status.",
        debug_info: {
          user_id: user.id,
          table_exists: true,
          queried_columns: ["account_id", "authenticated_user_id"],
        },
      });
    }

    // ─── Build a human-readable diagnosis ───
    const diagnosis = [];

    // 0. debug_token inspection (NEW — most useful for "No Facebook Pages found")
    const shortScopes = attempt.debug_token_short?.data?.scopes || [];
    const longScopes = attempt.debug_token_long?.data?.scopes || [];
    const requiredScopes = [
      "pages_show_list",
      "pages_messaging",
      "pages_read_engagement",
      "pages_manage_metadata",
      "instagram_manage_messages",
      "business_management",
      "instagram_basic",
    ];

    if (attempt.debug_token_short) {
      if (attempt.debug_token_short.error) {
        diagnosis.push({
          level: "ERROR",
          message: `debug_token call failed: ${attempt.debug_token_short.error.message || JSON.stringify(attempt.debug_token_short.error)}`,
          fix: "Check that META_APP_ID and META_APP_SECRET are set correctly in Vercel env vars.",
        });
      } else {
        const d = attempt.debug_token_short.data;
        const missingFromShort = requiredScopes.filter(s => !shortScopes.includes(s));
        if (missingFromShort.length > 0) {
          diagnosis.push({
            level: "ERROR",
            message: `Short-lived token is MISSING required scopes: ${missingFromShort.join(", ")}`,
            fix: "The OAuth dialog URL doesn't request these scopes OR Facebook didn't grant them. Remove Sellora from facebook.com/settings?tab=apps and reconnect. Also confirm in Meta App Dashboard → App Review → Permissions and Features that each scope is at least Standard Access.",
          });
        } else {
          diagnosis.push({
            level: "OK",
            message: `Short-lived token has all required scopes (${shortScopes.length} total): ${shortScopes.join(", ")}`,
          });
        }
        if (d?.type) {
          diagnosis.push({
            level: "INFO",
            message: `Short-lived token type: ${d.type} (should be USER)`,
          });
        }
        if (d?.app_id) {
          diagnosis.push({
            level: "INFO",
            message: `Token issued by app_id: ${d.app_id} (should match your Sellora Meta app)`,
          });
        }
      }
    }

    // Compare short vs long scopes
    if (shortScopes.length > 0 && longScopes.length > 0) {
      const missingInLong = shortScopes.filter(s => !longScopes.includes(s));
      if (missingInLong.length > 0) {
        diagnosis.push({
          level: "ERROR",
          message: `Long-lived token is MISSING scopes that short-lived had: ${missingInLong.join(", ")}`,
          fix: "The fb_exchange_token grant sometimes drops scopes. This is a Meta bug. Workaround: don't exchange for long-lived — use the short-lived token for /me/accounts (Strategy F already does this).",
        });
      } else {
        diagnosis.push({
          level: "OK",
          message: "Long-lived token has the SAME scopes as short-lived (good).",
        });
      }
    }

    // 1. Token exchange
    if (attempt.token_exchange_short?.error) {
      diagnosis.push({
        level: "ERROR",
        message: `Token exchange failed: ${attempt.token_exchange_short.error.message || JSON.stringify(attempt.token_exchange_short.error)}`,
        fix: "This usually means the redirect_uri in the Meta app dashboard doesn't match the callback URL exactly. Check that https://www.sellorachat.com/api/auth/meta-callback is in the Valid OAuth Redirect URIs.",
      });
    } else if (attempt.token_exchange_short?.has_access_token) {
      diagnosis.push({
        level: "OK",
        message: `Short-lived user token obtained successfully (HTTP ${attempt.token_exchange_short.status}).`,
      });
    }

    // 2. Granular scopes — did Facebook send target_ids?
    if (attempt.granular_scopes) {
      const targetIdsCount = attempt.granular_scopes
        .filter(s => s.target_ids?.length > 0)
        .reduce((sum, s) => sum + s.target_ids.length, 0);
      if (targetIdsCount === 0) {
        diagnosis.push({
          level: "WARN",
          message: "Facebook returned NO target_ids in granular_scopes — the OAuth dialog did NOT show a 'Select Pages' step.",
          fix: "This is the classic New Pages Experience (NPE) issue. Either: (1) The user has no Page at all → create one at https://facebook.com/pages/create. (2) The user has a Page but is using NPE → switch to Classic Pages Experience in Page Settings. (3) The user is logged into a different Facebook account than owns the Page. (4) The Meta app is in Development Mode and the user is not a test user/admin/developer.",
        });
      } else {
        diagnosis.push({
          level: "OK",
          message: `Facebook returned ${targetIdsCount} page ID(s) in granular_scopes target_ids.`,
        });
      }
    }

    // 3. Permissions
    const granted = (attempt.permissions?.body?.data || [])
      .filter(p => p.status === "granted")
      .map(p => p.permission);
    const declined = (attempt.permissions?.body?.data || [])
      .filter(p => p.status === "declined")
      .map(p => p.permission);

    if (granted.includes("pages_show_list")) {
      diagnosis.push({
        level: "OK",
        message: `pages_show_list permission granted. Granted: ${granted.join(", ")}`,
      });
    } else {
      diagnosis.push({
        level: "ERROR",
        message: "pages_show_list permission NOT granted — token cannot list Pages.",
        fix: "Remove Sellora at https://facebook.com/settings?tab=apps and reconnect, accepting ALL permissions.",
      });
    }

    // Filter out the WhatsApp permissions from the declined list — those are
    // optional and declining them is fine.
    const relevantDeclined = declined.filter(p => !p.startsWith("whatsapp"));
    if (relevantDeclined.length > 0) {
      diagnosis.push({
        level: "ERROR",
        message: `Page-related permissions declined: ${relevantDeclined.join(", ")}`,
        fix: "Remove Sellora at https://facebook.com/settings?tab=apps and reconnect, accepting ALL permissions.",
      });
    }

    // 4. User identity
    if (attempt.user_profile?.body?.id) {
      diagnosis.push({
        level: "INFO",
        message: `You authenticated to Facebook as: ${attempt.user_profile.body.name} (FB user ID: ${attempt.user_profile.body.id})${attempt.user_profile.body.email ? ` — ${attempt.user_profile.body.email}` : ""}. Make sure THIS account is an admin of your Facebook Page.`,
      });
    }

    // 5. /me/accounts results — the heart of the issue
    const strategyFCount = attempt.strategy_accounts_short?.body?.data?.length ?? null;
    const strategyACount = attempt.strategy_accounts_long?.body?.data?.length ?? null;
    const strategyCCount = attempt.strategy_user_accounts?.body?.data?.length ?? null;

    if (strategyFCount === 0 && strategyACount === 0 && strategyCCount === 0) {
      diagnosis.push({
        level: "ERROR",
        message: "/me/accounts returned 0 Pages with EVERY token type tried (short-lived, long-lived, and direct user-id lookup).",
        fix: "This confirms Facebook sees ZERO Pages for the authenticated account. Most common causes:\n  • You don't have a Facebook Page (only a personal profile) → create one at https://facebook.com/pages/create\n  • You logged in with a personal FB account that is NOT an admin of your business Page → log out of Facebook first, then click Connect with Meta again and log in with the account that owns the Page\n  • You're using New Pages Experience and your Page is not visible to /me/accounts → go to https://www.facebook.com/pages, switch to your Page, then Settings → New Pages Experience → Switch to Classic Pages\n  • The Sellora Meta app is in Development Mode and your FB account is not listed as a tester/developer/admin → ask Sellora to add your FB account as a tester, OR ask Sellora to make the app Live",
      });
    } else if (attempt.winning_strategy) {
      diagnosis.push({
        level: "OK",
        message: `Found Page via Strategy ${attempt.winning_strategy}: ${attempt.final_page_name} (${attempt.final_page_id})`,
      });
    }

    // 6. Final outcome
    if (attempt.final_outcome === "no_pages") {
      diagnosis.push({
        level: "ERROR",
        message: "Final outcome: no_pages — the OAuth flow could not find any Facebook Page for your account.",
      });
    } else if (attempt.final_outcome === "success") {
      diagnosis.push({
        level: "OK",
        message: `Final outcome: success — connected page ${attempt.final_page_name} (${attempt.final_page_id}).`,
      });
    } else if (attempt.final_outcome === "no_instagram_account") {
      diagnosis.push({
        level: "WARN",
        message: "Final outcome: Facebook connected, but NO Instagram Business Account was found linked to your Page.",
        fix: "To connect Instagram DMs: (1) Make sure your Instagram account is a Business or Creator account (not personal). (2) Link it to your Facebook Page at https://www.facebook.com/pages → your Page → Settings → Linked Accounts → Instagram. (3) Click 'Connect with Meta' again.",
      });
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      account_id: user.id,
      attempt,
      diagnosis,
      next_steps: getNextSteps(attempt, granted),
    }, { status: 200 });

  } catch (e) {
    console.error("[DEBUG LAST-META-OAUTH] error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function getNextSteps(attempt, granted) {
  const steps = [];

  if (!granted.includes("pages_show_list")) {
    steps.push("1. Go to https://facebook.com/settings?tab=apps and remove Sellora.");
    steps.push("2. Click 'Connect with Meta' again and accept ALL permissions.");
    return steps;
  }

  const anyAccountsReturned =
    (attempt.strategy_accounts_short?.body?.data?.length > 0) ||
    (attempt.strategy_accounts_long?.body?.data?.length > 0) ||
    (attempt.strategy_user_accounts?.body?.data?.length > 0);

  if (!anyAccountsReturned) {
    steps.push("1. Confirm you actually have a Facebook Page (not just a personal profile): https://facebook.com/pages");
    steps.push("2. Confirm you logged in with the FB account that is an ADMIN of that Page. If unsure, log out of Facebook, then click 'Connect with Meta' and log in with a different account.");
    steps.push("3. If your Page uses 'New Pages Experience', go to your Page → Settings → Switch to Classic Pages Experience (this makes /me/accounts work).");
    steps.push("4. If Sellora's Meta app is still in Development Mode, ask Sellora support to either add your FB account as a tester OR make the app Live.");
    return steps;
  }

  if (attempt.final_outcome === "no_instagram_account") {
    steps.push("1. Open your Instagram app → Settings → Account type and tools → Switch to Business/Creator account.");
    steps.push("2. Open your Facebook Page → Settings → Linked Accounts → Instagram → connect your IG account.");
    steps.push("3. Click 'Connect with Meta' again.");
    return steps;
  }

  steps.push("Everything looks good — try refreshing the Settings page.");
  return steps;
}
