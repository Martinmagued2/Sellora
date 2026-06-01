import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { parseFacebookWebhook, getUserProfile } from "@/lib/channels/meta";
import { processIncomingMessage } from "@/lib/channels/processor";
import { createClient } from "@supabase/supabase-js";
import { verifyMetaSignature } from "@/lib/channels/verify";
import { logSecurityEvent } from "@/lib/security-logger";

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
 * GET — Facebook Messenger webhook verification
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (!verifyToken) {
    console.error("[FB-WEBHOOK] META_WEBHOOK_VERIFY_TOKEN is not set! Webhook verification will fail. Add it to your Vercel environment variables.");
    return NextResponse.json({ error: "Webhook verify token not configured on server" }, { status: 500 });
  }

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[FB-WEBHOOK] Webhook verified successfully");
    return new Response(challenge, { status: 200 });
  }

  console.warn(`[FB-WEBHOOK] Verification failed. Expected: ${verifyToken?.substring(0, 4)}***, Got: ${token?.substring(0, 4)}***`);
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * POST — Handle incoming Facebook Messenger messages
 * 
 * Flow: Customer sends FB message → Meta delivers here → we store + AI replies → 
 * reply shows up in customer's Messenger inbox
 */
export async function POST(request) {
  const rawBody = await request.text();
  const headersList = await headers();
  const signature = headersList.get("x-hub-signature-256");
  const ip = request.headers.get("x-forwarded-for") || "unknown";

  // Verify the webhook signature securely
  if (!verifyMetaSignature(rawBody, signature, process.env.META_APP_SECRET)) {
    console.error("[FB-WEBHOOK] Invalid Facebook webhook signature");
    await logSecurityEvent({
      eventType: "invalid_hmac",
      ipAddress: ip,
      route: "/api/webhooks/facebook",
      details: { channel: "facebook" }
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody);

  // Verify this is a page event (Messenger)
  if (body.object !== "page") {
    return NextResponse.json({ status: "not_page" });
  }

  const parsed = parseFacebookWebhook(body);

  if (!parsed || parsed.length === 0) {
    return NextResponse.json({ status: "ok" });
  }

  // Process ALL parsed events (handles batched webhooks)
  for (const event of parsed) {
    if (event.type !== "message") {
      continue;
    }

    try {
      // Look up the account that this page belongs to
      // Handle duplicate page_ids gracefully by preferring accounts with valid tokens
      const { data: accounts } = await getSupabase()
        .from("accounts")
        .select("id, facebook_access_token")
        .eq("facebook_page_id", event.pageId);

      if (!accounts || accounts.length === 0) {
        console.error("[FB-WEBHOOK] No account found for facebook_page_id:", event.pageId);
        continue;
      }

      if (accounts.length > 1) {
        console.warn(`[FB-WEBHOOK] Multiple accounts (${accounts.length}) share facebook_page_id: ${event.pageId}. Picking the one with a valid access token.`);
      }

      // Prefer the account that has a valid access token
      const account = accounts.find(a => a.facebook_access_token) || accounts[0];

      if (!account?.facebook_access_token) {
        console.error("[FB-WEBHOOK] No Facebook token found for page:", event.pageId);
        continue;
      }

      // Try to get the sender's profile
      const profile = await getUserProfile({
        userId: event.senderId,
        accessToken: account.facebook_access_token,
      });

      // Extract media URLs from attachments
      const mediaUrls = (event.attachments || [])
        .filter((a) => a.type === "image" || a.type === "video")
        .map((a) => a.payload?.url)
        .filter(Boolean);

      // Process through the shared pipeline
      // Pass accountId so processor uses the correct account (handles duplicate page_ids)
      await processIncomingMessage({
        senderId: event.senderId,
        senderName: profile?.name || null,
        senderProfilePic: profile?.profile_pic || null,
        text: event.text,
        mediaUrls,
        channel: "facebook",
        pageId: event.pageId,
        platformMessageId: event.messageId,
        accessToken: account.facebook_access_token,
        accountId: account.id,
      });

      console.log(`[FB-WEBHOOK] Processed message from ${event.senderId}: "${event.text?.substring(0, 50)}..."`);

    } catch (err) {
      console.error("[FB-WEBHOOK] Error processing Facebook message:", err.message);
    }
  }

  // Always return 200 to prevent Meta from retrying
  return NextResponse.json({ status: "ok" });
}
