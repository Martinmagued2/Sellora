/**
 * Test Incoming Message Endpoint
 * POST /api/webhooks/test-incoming
 *
 * Simulates an incoming message to test the pipeline without needing Meta.
 * Useful for debugging why messages don't appear in the dashboard.
 *
 * Body: {
 *   channel: "instagram" | "facebook" | "whatsapp",
 *   senderId: "test_user_123",
 *   text: "Hello, I need help!",
 *   pageId?: "override_page_id"  // optional, uses the account's page ID if not provided
 * }
 */

import { NextResponse } from "next/server";
import { processIncomingMessage } from "@/lib/channels/processor";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "@/lib/admin-auth";

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

export async function POST(request) {
  // 🔒 CRITICAL: Require admin auth — anyone could inject fake messages
  const { isAdmin } = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized — admin access required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { channel = "instagram", senderId, text, pageId } = body;

    if (!senderId || !text) {
      return NextResponse.json(
        { error: "Missing senderId or text" },
        { status: 400 }
      );
    }

    // If no pageId provided, try to find the first account with this channel connected
    let effectivePageId = pageId;
    let accessToken = null;

    if (!effectivePageId) {
      const supabase = getSupabase();

      const columnMap = {
        instagram: { pageCol: "instagram_page_id", tokenCol: "instagram_access_token", connectedCol: "instagram_connected" },
        facebook: { pageCol: "facebook_page_id", tokenCol: "facebook_access_token", connectedCol: "facebook_connected" },
        whatsapp: { pageCol: "whatsapp_phone_number_id", tokenCol: "whatsapp_access_token", connectedCol: "whatsapp_connected" },
      };

      const mapping = columnMap[channel];
      if (!mapping) {
        return NextResponse.json(
          { error: `Invalid channel: ${channel}. Must be instagram, facebook, or whatsapp` },
          { status: 400 }
        );
      }

      const { data: accounts, error: acctErr } = await supabase
        .from("accounts")
        .select(`id, ${mapping.pageCol}, ${mapping.tokenCol}, ${mapping.connectedCol}`)
        .eq(mapping.connectedCol, true)
        .limit(5);

      if (acctErr) {
        return NextResponse.json({
          error: "Failed to query accounts: " + acctErr.message,
          hint: "Check if the accounts table has the expected columns",
        }, { status: 500 });
      }

      if (!accounts || accounts.length === 0) {
        return NextResponse.json({
          error: `No connected ${channel} accounts found`,
          hint: `Connect your ${channel} account first in Settings > Channels`,
          accounts_checked: accounts?.length || 0,
        }, { status: 404 });
      }

      const account = accounts[0];
      effectivePageId = account[mapping.pageCol];
      accessToken = account[mapping.tokenCol];

      if (!effectivePageId) {
        return NextResponse.json({
          error: `Account ${account.id} is marked as ${channel}_connected=true but has no ${mapping.pageCol}`,
          hint: "Re-connect the channel in Settings to set the page ID",
          account_id: account.id,
        }, { status: 400 });
      }
    }

    console.log(`[TEST-INCOMING] Simulating ${channel} message from ${senderId}: "${text}" (pageId: ${effectivePageId})`);

    // Process through the full pipeline
    await processIncomingMessage({
      senderId,
      senderName: "Test User",
      senderProfilePic: null,
      text,
      mediaUrls: [],
      channel,
      pageId: effectivePageId,
      platformMessageId: `test_${Date.now()}`,
      accessToken,
    });

    return NextResponse.json({
      success: true,
      message: `Test message processed for ${channel} channel`,
      details: {
        channel,
        senderId,
        text,
        pageId: effectivePageId,
      },
    });
  } catch (err) {
    console.error("[TEST-INCOMING] Error:", err.message);
    console.error("[TEST-INCOMING] Stack:", err.stack);
    // 🔒 SECURITY: Don't leak stack trace to client
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
