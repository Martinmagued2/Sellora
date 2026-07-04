/**
 * Debug: Meta Pages + Instagram Business Account lookup
 * GET /api/debug/meta-pages
 *
 * Calls Meta's Graph API directly with the user's stored page access token
 * and shows EXACTLY what Meta returns. This tells us definitively whether:
 * - The Instagram product is missing from the Meta app
 * - The instagram_manage_messages permission wasn't granted
 * - The IG account isn't actually linked to the FB Page
 * - Or there's a Sellora bug
 *
 * No guessing — just raw Meta API output.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";

const META_API_URL = "https://graph.facebook.com/v21.0";

let _admin = null;
function admin() {
  if (!_admin)
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  return _admin;
}

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = admin();

    // Get the user's account with Facebook tokens
    const { data: account } = await db
      .from("accounts")
      .select("id, email, facebook_page_id, facebook_access_token, facebook_connected, instagram_page_id, instagram_connected")
      .eq("id", user.id)
      .maybeSingle();

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const result = {
      timestamp: new Date().toISOString(),
      account: {
        id: account.id,
        email: account.email,
        facebook_connected: account.facebook_connected,
        facebook_page_id: account.facebook_page_id,
        instagram_connected: account.instagram_connected,
        instagram_page_id: account.instagram_page_id,
        has_facebook_token: !!account.facebook_access_token,
      },
      meta_app_config: {
        META_APP_ID: process.env.NEXT_PUBLIC_META_APP_ID ? "SET" : "MISSING",
        META_APP_SECRET: process.env.META_APP_SECRET ? "SET" : "MISSING",
      },
      tests: {},
    };

    if (!account.facebook_access_token) {
      result.error = "No Facebook access token found. Connect Facebook first.";
      return NextResponse.json(result);
    }

    const token = account.facebook_access_token;

    // ─── Test 1: Check token permissions ───
    try {
      const permsRes = await fetch(`${META_API_URL}/me/permissions?access_token=${token}`);
      const permsData = await permsRes.json();
      result.tests.token_permissions = {
        status: permsRes.status,
        data: permsData,
        granted: (permsData.data || []).filter((p) => p.status === "granted").map((p) => p.permission),
      };
    } catch (e) {
      result.tests.token_permissions = { error: e.message };
    }

    // ─── Test 2: Get user's Pages with IG field ───
    try {
      const pagesRes = await fetch(
        `${META_API_URL}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=100&access_token=${token}`
      );
      const pagesData = await pagesRes.json();
      result.tests.pages_with_ig = {
        status: pagesRes.status,
        raw_response: pagesData,
        pages_found: pagesData.data?.length || 0,
        pages: (pagesData.data || []).map((p) => ({
          id: p.id,
          name: p.name,
          has_access_token: !!p.access_token,
          has_instagram: !!p.instagram_business_account,
          instagram_username: p.instagram_business_account?.username || null,
          instagram_id: p.instagram_business_account?.id || null,
        })),
      };
    } catch (e) {
      result.tests.pages_with_ig = { error: e.message };
    }

    // ─── Test 3: Check the specific page_id stored on the account ───
    if (account.facebook_page_id) {
      try {
        const pageRes = await fetch(
          `${META_API_URL}/${account.facebook_page_id}?fields=id,name,instagram_business_account{id,username,profile_picture_url}&access_token=${token}`
        );
        const pageData = await pageRes.json();
        result.tests.specific_page_lookup = {
          status: pageRes.status,
          raw_response: pageData,
          page_id: account.facebook_page_id,
          has_instagram: !!pageData.instagram_business_account,
          instagram_username: pageData.instagram_business_account?.username || null,
        };
      } catch (e) {
        result.tests.specific_page_lookup = { error: e.message };
      }
    }

    // ─── Test 4: Check /me (who does this token belong to?) ───
    try {
      const meRes = await fetch(`${META_API_URL}/me?fields=id,name&access_token=${token}`);
      const meData = await meRes.json();
      result.tests.token_owner = {
        status: meRes.status,
        data: meData,
      };
    } catch (e) {
      result.tests.token_owner = { error: e.message };
    }

    // ─── Diagnosis ───
    const diagnosis = [];
    const granted = result.tests.token_permissions?.granted || [];
    const pages = result.tests.pages_with_ig?.pages || [];

    if (!granted.includes("pages_show_list")) {
      diagnosis.push("❌ pages_show_list permission not granted — token can't see Pages");
    }
    if (!granted.includes("instagram_manage_messages")) {
      diagnosis.push("❌ instagram_manage_messages permission not granted — can't access Instagram DMs");
    }
    if (granted.includes("pages_show_list") && pages.length === 0) {
      diagnosis.push("❌ Token has pages_show_list but /me/accounts returned 0 Pages — user may not manage any Pages");
    }
    if (pages.length > 0 && !pages.some((p) => p.has_instagram)) {
      diagnosis.push("❌ User has Pages but NONE have an Instagram Business Account linked");
      diagnosis.push("   → Go to https://www.facebook.com/pages → your Page → Settings → Linked Accounts → Instagram");
      diagnosis.push("   → OR go to https://business.facebook.com/settings/instagram to link it");
    }
    if (pages.some((p) => p.has_instagram)) {
      diagnosis.push("✅ At least one Page has Instagram linked — Sellora should be able to connect it");
      const igPage = pages.find((p) => p.has_instagram);
      diagnosis.push(`   → Page: ${igPage.name} (${igPage.id}) → IG: @${igPage.instagram_username}`);
    }

    result.diagnosis = diagnosis;

    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    console.error("[DEBUG META-PAGES] error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
