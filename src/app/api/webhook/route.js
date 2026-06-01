/**
 * UNIFIED Meta Webhook Endpoint
 *
 * Meta App Dashboard requires ONE callback URL for all events.
 * This endpoint handles BOTH Instagram and Facebook events in one place,
 * routing based on the `body.object` field:
 *   - "instagram" → Instagram DM events
 *   - "page"      → Facebook Messenger events
 *
 * Configure this URL in your Meta App Dashboard:
 *   https://sellora-ruby.vercel.app/api/webhook
 *
 * For Instagram: Subscribe to "messages" and "messaging_postbacks" events
 * For Messenger: Subscribe to "messages" and "messaging_postbacks" events
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  parseInstagramWebhook,
  parseFacebookWebhook,
  getUserProfile,
} from "@/lib/channels/meta";
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
 * GET — Webhook verification for BOTH Instagram and Facebook
 * Meta sends a GET request during webhook setup to verify the URL
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  console.log("[WEBHOOK] GET verification request:", {
    mode,
    token: token?.substring(0, 4) + "***",
    challenge: challenge?.substring(0, 10) + "...",
  });

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (!verifyToken) {
    console.error(
      "[WEBHOOK] CRITICAL: META_WEBHOOK_VERIFY_TOKEN is not set! " +
        "Add it to your Vercel environment variables."
    );
    return NextResponse.json(
      { error: "Webhook verify token not configured on server" },
      { status: 500 }
    );
  }

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[WEBHOOK] Verification successful!");
    return new Response(challenge, { status: 200 });
  }

  console.warn(
    `[WEBHOOK] Verification FAILED. Expected: ${verifyToken?.substring(0, 4)}***, Got: ${token?.substring(0, 4)}***`
  );
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * POST — Handle incoming messages from BOTH Instagram and Facebook
 *
 * Flow:
 *   Customer sends DM → Meta delivers here → parse → store → AI replies →
 *   reply shows up in customer's inbox
 */
export async function POST(request) {
  const rawBody = await request.text();
  const headersList = await headers();
  const signature = headersList.get("x-hub-signature-256");
  const ip = request.headers.get("x-forwarded-for") || "unknown";

  // ─── Signature Verification ───
  const appSecret = process.env.META_APP_SECRET;

  if (!appSecret) {
    console.error(
      "[WEBHOOK] CRITICAL: META_APP_SECRET is not set! " +
        "Cannot verify webhook signatures. Add it to Vercel environment variables."
    );
    // In production, we MUST reject. But log the payload for debugging.
    console.log("[WEBHOOK] Raw body (first 500 chars):", rawBody.substring(0, 500));
    return NextResponse.json(
      { error: "App secret not configured" },
      { status: 500 }
    );
  }

  if (!verifyMetaSignature(rawBody, signature, appSecret)) {
    console.error("[WEBHOOK] Invalid signature. Possible causes:");
    console.error("  1. META_APP_SECRET env var doesn't match the Meta App");
    console.error("  2. Request is not from Meta (possible attack)");
    console.error("  3. Body was modified by a proxy/middleware");
    console.log("[WEBHOOK] Signature header:", signature);
    console.log("[WEBHOOK] Raw body (first 200 chars):", rawBody.substring(0, 200));

    await logSecurityEvent({
      eventType: "invalid_hmac",
      ipAddress: ip,
      route: "/api/webhook",
      details: { signature_present: !!signature },
    });

    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // ─── Parse and Route ───
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch (e) {
    console.error("[WEBHOOK] Failed to parse JSON body:", e.message);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const objectType = body.object;
  console.log(`[WEBHOOK] Received ${objectType} event`);

  // Route based on object type
  if (objectType === "instagram") {
    return await handleInstagramEvent(body);
  } else if (objectType === "page") {
    return await handleFacebookEvent(body);
  } else {
    console.log(`[WEBHOOK] Unknown object type: ${objectType}. Ignoring.`);
    return NextResponse.json({ status: "unknown_object" });
  }
}

/**
 * Process Instagram DM events
 */
async function handleInstagramEvent(body) {
  const parsed = parseInstagramWebhook(body);

  if (!parsed || parsed.length === 0) {
    console.log("[WEBHOOK-IG] No message events in payload (could be read/delivery receipt)");
    return NextResponse.json({ status: "ok" });
  }

  console.log(`[WEBHOOK-IG] Processing ${parsed.length} event(s)`);

  let processedCount = 0;
  let errorCount = 0;

  for (const event of parsed) {
    if (event.type !== "message") {
      console.log(`[WEBHOOK-IG] Skipping ${event.type} event`);
      continue;
    }

    try {
      console.log(`[WEBHOOK-IG] Message from ${event.senderId}: "${event.text?.substring(0, 50)}..." (pageId: ${event.pageId})`);

      // Look up the account that this page belongs to
      // Use .limit(1) instead of .single() to handle duplicate page_ids gracefully
      const { data: accounts, error: accountError } = await getSupabase()
        .from("accounts")
        .select("id, instagram_access_token")
        .eq("instagram_page_id", event.pageId);

      if (accountError) {
        console.error(`[WEBHOOK-IG] Account lookup error for pageId ${event.pageId}:`, accountError.message);
        errorCount++;
        continue;
      }

      if (!accounts || accounts.length === 0) {
        console.error(`[WEBHOOK-IG] No account found for instagram_page_id: ${event.pageId}`);
        console.error(`[WEBHOOK-IG] HINT: Make sure instagram_page_id in the accounts table matches the Facebook Page ID: ${event.pageId}`);
        errorCount++;
        continue;
      }

      if (accounts.length > 1) {
        console.warn(`[WEBHOOK-IG] Multiple accounts (${accounts.length}) share instagram_page_id: ${event.pageId}. Picking the one with a valid access token.`);
      }

      // Prefer the account that has a valid access token
      const account = accounts.find(a => a.instagram_access_token) || accounts[0];

      if (!account?.instagram_access_token) {
        console.error(`[WEBHOOK-IG] No Instagram access token for page: ${event.pageId}`);
        console.error(`[WEBHOOK-IG] HINT: Re-connect Instagram in Settings to refresh the token`);
        errorCount++;
        continue;
      }

      // Try to get the sender's profile (name + pic)
      let profile = null;
      try {
        profile = await getUserProfile({
          userId: event.senderId,
          accessToken: account.instagram_access_token,
        });
      } catch (profileErr) {
        console.warn(`[WEBHOOK-IG] Could not fetch profile for ${event.senderId}:`, profileErr.message);
      }

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
        channel: "instagram",
        pageId: event.pageId,
        platformMessageId: event.messageId,
        accessToken: account.instagram_access_token,
        accountId: account.id,
      });

      processedCount++;
      console.log(`[WEBHOOK-IG] Successfully processed message from ${event.senderId}`);
    } catch (err) {
      console.error("[WEBHOOK-IG] Error processing Instagram message:", err.message);
      console.error("[WEBHOOK-IG] Stack:", err.stack);
      errorCount++;
    }
  }

  console.log(`[WEBHOOK-IG] Done: ${processedCount} processed, ${errorCount} errors`);
  return NextResponse.json({ status: "ok", processed: processedCount, errors: errorCount });
}

/**
 * Process Facebook Messenger events
 */
async function handleFacebookEvent(body) {
  const parsed = parseFacebookWebhook(body);

  if (!parsed || parsed.length === 0) {
    console.log("[WEBHOOK-FB] No message events in payload");
    return NextResponse.json({ status: "ok" });
  }

  console.log(`[WEBHOOK-FB] Processing ${parsed.length} event(s)`);

  let processedCount = 0;
  let errorCount = 0;

  for (const event of parsed) {
    if (event.type !== "message") {
      console.log(`[WEBHOOK-FB] Skipping ${event.type} event`);
      continue;
    }

    try {
      console.log(`[WEBHOOK-FB] Message from ${event.senderId}: "${event.text?.substring(0, 50)}..." (pageId: ${event.pageId})`);

      // Look up the account that this page belongs to
      // Use .limit(1) fallback instead of .single() to handle duplicate page_ids gracefully
      const { data: accounts, error: accountError } = await getSupabase()
        .from("accounts")
        .select("id, facebook_access_token")
        .eq("facebook_page_id", event.pageId);

      if (accountError) {
        console.error(`[WEBHOOK-FB] Account lookup error for pageId ${event.pageId}:`, accountError.message);
        errorCount++;
        continue;
      }

      if (!accounts || accounts.length === 0) {
        console.error(`[WEBHOOK-FB] No account found for facebook_page_id: ${event.pageId}`);
        console.error(`[WEBHOOK-FB] HINT: Make sure facebook_page_id in the accounts table matches: ${event.pageId}`);
        errorCount++;
        continue;
      }

      if (accounts.length > 1) {
        console.warn(`[WEBHOOK-FB] Multiple accounts (${accounts.length}) share facebook_page_id: ${event.pageId}. Picking the one with a valid access token.`);
      }

      // Prefer the account that has a valid access token
      const account = accounts.find(a => a.facebook_access_token) || accounts[0];

      if (!account?.facebook_access_token) {
        console.error(`[WEBHOOK-FB] No Facebook access token for page: ${event.pageId}`);
        console.error(`[WEBHOOK-FB] HINT: Re-connect Facebook in Settings to refresh the token`);
        errorCount++;
        continue;
      }

      // Try to get the sender's profile
      let profile = null;
      try {
        profile = await getUserProfile({
          userId: event.senderId,
          accessToken: account.facebook_access_token,
        });
      } catch (profileErr) {
        console.warn(`[WEBHOOK-FB] Could not fetch profile for ${event.senderId}:`, profileErr.message);
      }

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

      processedCount++;
      console.log(`[WEBHOOK-FB] Successfully processed message from ${event.senderId}`);
    } catch (err) {
      console.error("[WEBHOOK-FB] Error processing Facebook message:", err.message);
      console.error("[WEBHOOK-FB] Stack:", err.stack);
      errorCount++;
    }
  }

  console.log(`[WEBHOOK-FB] Done: ${processedCount} processed, ${errorCount} errors`);
  return NextResponse.json({ status: "ok", processed: processedCount, errors: errorCount });
}
