import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { parseInstagramWebhook, getUserProfile } from "@/lib/channels/meta";
import { processIncomingMessage } from "@/lib/channels/processor";
import { createClient } from "@supabase/supabase-js";
import { verifyMetaSignature } from "@/lib/channels/verify";
import { logSecurityEvent } from "@/lib/security-logger";
import { decryptToken } from "@/lib/token-encryption";
import crypto from 'crypto';

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
 * GET — Instagram webhook verification
 * Meta sends a GET to verify the webhook URL during setup
 *
 * Accepts EITHER META_WEBHOOK_VERIFY_TOKEN or WHATSAPP_WEBHOOK_VERIFY_TOKEN
 * (some users configure the same token for both IG/FB and WhatsApp).
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  console.log("[IG-WEBHOOK] Verification request:", { mode, hasToken: !!token });

  if (mode === "subscribe" && token) {
    const expectedTokens = [
      process.env.META_WEBHOOK_VERIFY_TOKEN,
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    ].filter(Boolean);

    if (expectedTokens.length === 0) {
      console.error("[IG-WEBHOOK] No verify token configured. Set META_WEBHOOK_VERIFY_TOKEN in Vercel env vars.");
      return NextResponse.json({ error: "Webhook verify token not configured on server" }, { status: 500 });
    }

    for (const expectedToken of expectedTokens) {
      if (token === expectedToken) {
        console.log("[IG-WEBHOOK] ✅ Webhook verified successfully");
        return new Response(challenge, { status: 200 });
      }
      if (token.length === expectedToken.length) {
        try {
          if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken))) {
            console.log("[IG-WEBHOOK] ✅ Webhook verified successfully");
            return new Response(challenge, { status: 200 });
          }
        } catch (e) {}
      }
    }

    console.warn("[IG-WEBHOOK] ❌ Verification failed — token mismatch");
    console.warn("[IG-WEBHOOK] Received:", token.substring(0, 4) + "..." + token.slice(-4));
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * POST — Handle incoming Instagram DM messages
 * 
 * Flow: Customer sends IG DM → Meta delivers here → we store + AI replies → 
 * reply shows up in customer's IG DM inbox
 */
export async function POST(request) {
  const rawBody = await request.text();
  const headersList = await headers();
  const signature = headersList.get("x-hub-signature-256");
  const ip = request.headers.get("x-forwarded-for") || "unknown";

  // Verify the webhook signature securely
  if (!verifyMetaSignature(rawBody, signature, process.env.META_APP_SECRET)) {
    console.error("[IG-WEBHOOK] Invalid Instagram webhook signature");
    await logSecurityEvent({
      eventType: "invalid_hmac",
      ipAddress: ip,
      route: "/api/webhooks/instagram",
      details: { channel: "instagram" }
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody);

  // Verify this is an Instagram event
  if (body.object !== "instagram") {
    return NextResponse.json({ status: "not_instagram" });
  }

  const parsed = parseInstagramWebhook(body);

  if (!parsed || parsed.length === 0) {
    // Could be a read receipt, delivery receipt, etc. — acknowledge it
    return NextResponse.json({ status: "ok" });
  }

  // Process ALL parsed events (handles batched webhooks)
  for (const event of parsed) {
    if (event.type !== "message") {
      continue; // Skip postbacks and other non-message events
    }

    try {
      // Look up the account that this page belongs to
      // Handle duplicate page_ids gracefully
      const { data: accounts } = await getSupabase()
        .from("accounts")
        .select("id, instagram_access_token")
        .eq("instagram_page_id", event.pageId);

      if (!accounts || accounts.length === 0) {
        console.error("[IG-WEBHOOK] No account found for instagram_page_id:", event.pageId);
        continue;
      }

      if (accounts.length > 1) {
        console.warn(`[IG-WEBHOOK] Multiple accounts (${accounts.length}) share instagram_page_id: ${event.pageId}. Picking the one with a valid access token.`);
      }

      // Prefer the account that has a valid access token
      const account = accounts.find(a => a.instagram_access_token) || accounts[0];

      // Decrypt the token (no-op if plaintext — backward compatible)
      const igAccessToken = account?.instagram_access_token
        ? decryptToken(account.instagram_access_token)
        : null;

      if (!igAccessToken) {
        console.warn("[IG-WEBHOOK] No Instagram token found for page:", event.pageId);
        console.warn("[IG-WEBHOOK] Message will still be processed & stored, but replies cannot be delivered");
      } else {
        console.log("[IG-WEBHOOK] ✅ Instagram token found and decrypted for page:", event.pageId);
      }

      // Try to get the sender's profile (name + pic) — only if we have a token
      let profile = null;
      if (igAccessToken) {
        try {
          profile = await getUserProfile({
            userId: event.senderId,
            accessToken: igAccessToken,
          });
        } catch (profileErr) {
          console.warn("[IG-WEBHOOK] Could not fetch profile:", profileErr.message);
        }
      }

      // Extract media URLs from attachments
      const mediaUrls = (event.attachments || [])
        .filter((a) => a.type === "image" || a.type === "video")
        .map((a) => a.payload?.url)
        .filter(Boolean);

      // Process through the shared pipeline — pass DECRYPTED token
      await processIncomingMessage({
        senderId: event.senderId,
        senderName: profile?.name || null,
        senderProfilePic: profile?.profile_pic || null,
        text: event.text,
        mediaUrls,
        channel: "instagram",
        pageId: event.pageId,
        platformMessageId: event.messageId,
        accessToken: igAccessToken,
        accountId: account.id,
      });

      console.log(`[IG-WEBHOOK] Processed message from ${event.senderId}: "${event.text?.substring(0, 50)}..."`);

    } catch (err) {
      console.error("[IG-WEBHOOK] Error processing Instagram message:", err.message);
    }
  }

  // Always return 200 to prevent Meta from retrying
  return NextResponse.json({ status: "ok" });
}
