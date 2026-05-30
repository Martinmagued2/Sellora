import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { parseInstagramWebhook, getUserProfile } from "@/lib/channels/meta";
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
 * GET — Instagram webhook verification
 * Meta sends a GET to verify the webhook URL during setup
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (!verifyToken) {
    console.error("[IG-WEBHOOK] META_WEBHOOK_VERIFY_TOKEN is not set! Webhook verification will fail. Add it to your Vercel environment variables.");
    return NextResponse.json({ error: "Webhook verify token not configured on server" }, { status: 500 });
  }

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[IG-WEBHOOK] Webhook verified successfully");
    return new Response(challenge, { status: 200 });
  }

  console.warn(`[IG-WEBHOOK] Verification failed. Expected: ${verifyToken?.substring(0, 4)}***, Got: ${token?.substring(0, 4)}***`);
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
      const { data: account } = await getSupabase()
        .from("accounts")
        .select("instagram_access_token")
        .eq("instagram_page_id", event.pageId)
        .single();

      if (!account?.instagram_access_token) {
        console.error("[IG-WEBHOOK] No Instagram token found for page:", event.pageId);
        continue;
      }

      // Try to get the sender's profile (name + pic)
      const profile = await getUserProfile({
        userId: event.senderId,
        accessToken: account.instagram_access_token,
      });

      // Extract media URLs from attachments
      const mediaUrls = (event.attachments || [])
        .filter((a) => a.type === "image" || a.type === "video")
        .map((a) => a.payload?.url)
        .filter(Boolean);

      // Process through the shared pipeline
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
      });

      console.log(`[IG-WEBHOOK] Processed message from ${event.senderId}: "${event.text?.substring(0, 50)}..."`);

    } catch (err) {
      console.error("[IG-WEBHOOK] Error processing Instagram message:", err.message);
    }
  }

  // Always return 200 to prevent Meta from retrying
  return NextResponse.json({ status: "ok" });
}
