import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "@/lib/admin-auth";

// Server-side admin client (bypasses RLS)
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
 * POST /api/meta/connect
 * 
 * Manually connect Instagram or Facebook by providing Page ID and Access Token.
 * Uses admin (service role) client to bypass RLS.
 * 
 * Body: { accountId, platform, pageId, accessToken }
 */
export async function POST(request) {
  // 🔒 SECURITY: Require admin auth — anyone could connect pages to any account
  const { isAdmin } = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized — admin access required" }, { status: 401 });
  }

  try {
    const { accountId, platform, pageId, accessToken } = await request.json();

    if (!accountId || !platform || !pageId || !accessToken) {
      return NextResponse.json({ error: "Missing required fields: accountId, platform, pageId, accessToken" }, { status: 400 });
    }

    if (!["instagram", "facebook"].includes(platform)) {
      return NextResponse.json({ error: "Platform must be 'instagram' or 'facebook'" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Verify the account exists
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("id")
      .eq("id", accountId)
      .single();

    if (accountError || !account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Verify the token works by fetching page info from Meta
    const META_API_URL = "https://graph.facebook.com/v21.0";
    const verifyResponse = await fetch(
      `${META_API_URL}/${pageId}?fields=id,name&access_token=${accessToken}`,
      { method: "GET" }
    );

    const verifyData = await verifyResponse.json();

    if (verifyData.error) {
      console.warn("[META-CONNECT] Token verification failed:", verifyData.error);
      // Still save — the token might work for messaging even if verification fails
      // (e.g., limited permissions)
    }

    const pageName = verifyData.name || null;

    // ── Prevent duplicate page_id connections ──
    // Clear this page_id from any OTHER account before saving
    try {
      const pageIdColumn = platform === "facebook" ? "facebook_page_id" : "instagram_page_id";
      const { data: existingAccounts } = await supabase
        .from("accounts")
        .select("id, email, business_name")
        .eq(pageIdColumn, pageId)
        .neq("id", accountId);

      if (existingAccounts && existingAccounts.length > 0) {
        console.warn(`[META-CONNECT] Page ${pageId} is already connected to ${existingAccounts.length} other account(s). Clearing them.`);
        for (const existingAcct of existingAccounts) {
          console.log(`[META-CONNECT] Clearing Meta connection from: ${existingAcct.email} (${existingAcct.business_name})`);
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
    } catch (dupCheckErr) {
      console.warn("[META-CONNECT] Duplicate check error (non-fatal):", dupCheckErr.message);
    }

    // Update the account with the connection data
    const updates = {};

    if (platform === "instagram") {
      updates.instagram_page_id = pageId;
      updates.instagram_access_token = accessToken;
      updates.instagram_connected = true;

      // Try to resolve the Instagram Business Account ID
      if (verifyData.id) {
        try {
          const igResponse = await fetch(
            `${META_API_URL}/${pageId}?fields=instagram_business_account{id,username}&access_token=${accessToken}`,
            { method: "GET" }
          );
          const igData = await igResponse.json();
          if (igData.instagram_business_account) {
            console.log(`[META-CONNECT] Found Instagram account: @${igData.instagram_business_account.username} for page ${pageId}`);
          }
        } catch (e) {
          console.warn("[META-CONNECT] Could not resolve Instagram Business Account:", e.message);
        }
      }
    } else if (platform === "facebook") {
      updates.facebook_page_id = pageId;
      updates.facebook_access_token = accessToken;
      updates.facebook_connected = true;
    }

    const { error: updateError } = await supabase
      .from("accounts")
      .update(updates)
      .eq("id", accountId);

    if (updateError) {
      console.error("[META-CONNECT] Failed to update account:", updateError);
      return NextResponse.json({ error: "Failed to save connection: " + updateError.message }, { status: 500 });
    }

    console.log(`[META-CONNECT] ${platform} connected successfully for account ${accountId} (Page: ${pageName || pageId})`);

    return NextResponse.json({
      success: true,
      platform,
      pageName,
      message: `${platform === "instagram" ? "Instagram" : "Facebook"} connected successfully!`,
    });

  } catch (err) {
    console.error("[META-CONNECT] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
