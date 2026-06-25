import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { parseInstagramWebhook, getUserProfile } from "@/lib/channels/meta";
import { processIncomingMessage } from "@/lib/channels/processor";
import { createClient } from "@supabase/supabase-js";
import { verifyMetaSignature } from "@/lib/channels/verify";
import { logSecurityEvent } from "@/lib/security-logger";
import { notify } from "@/lib/notifications";
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

  // 🔒 SECURITY: Timing-safe comparison to prevent timing attacks
  if (mode === "subscribe" && token && verifyToken) {
    try {
      if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(verifyToken))) {
        console.log("[IG-WEBHOOK] Webhook verified successfully");
        return new Response(challenge, { status: 200 });
      }
    } catch (e) {
      // Length mismatch — fall through to failure
    }
  }

  console.warn("[IG-WEBHOOK] Verification failed");
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

      if (!account?.instagram_access_token) {
        console.warn("[IG-WEBHOOK] No Instagram token found for page:", event.pageId);
        console.warn("[IG-WEBHOOK] Message will still be processed & stored, but replies cannot be delivered");
        // DON'T skip — still process the message so it's stored and AI can generate a reply
      }

      // Try to get the sender's profile (name + pic) — only if we have a token
      let profile = null;
      if (account?.instagram_access_token) {
        try {
          profile = await getUserProfile({
            userId: event.senderId,
            accessToken: account.instagram_access_token,
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

      // 🔧 Set customer typing indicator BEFORE storing the message
      try {
        const { data: customer } = await getSupabase().from("customers")
          .select("id").eq("platform_id", event.senderId).eq("account_id", account.id).maybeSingle();
        if (customer) {
          const { data: conv } = await getSupabase().from("conversations")
            .select("id").eq("customer_id", customer.id).eq("account_id", account.id)
            .order("last_message_at", { ascending: false }).limit(1).maybeSingle();
          if (conv) {
            await getSupabase().from("typing_indicators").upsert({
              account_id: account.id, conversation_id: conv.id,
              is_customer: true, is_team_member: false, created_at: new Date().toISOString(),
            }, { onConflict: 'conversation_id,is_customer' });
          }
        }
      } catch (e) {}

      // Small delay so typing bubble is visible
      await new Promise(resolve => setTimeout(resolve, 800));

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
        accessToken: account.instagram_access_token || null,
        accountId: account.id,
      });

      // 🔧 Clear customer typing indicator (message arrived)
      try {
        await getSupabase().from("typing_indicators")
          .delete().eq("account_id", account.id).eq("is_customer", true);
      } catch (e) {}

      console.log(`[IG-WEBHOOK] Processed message from ${event.senderId}: "${event.text?.substring(0, 50)}..."`);

      // 🔔 Fire notification (best-effort, non-blocking)
      const customerName = profile?.name || event.senderId || "Unknown";
      const messagePreview = (event.text || "").slice(0, 100);
      notify(account.id, {
        category: "messages",
        type: "new_message",
        title: `New Instagram message from ${customerName}`,
        message: messagePreview,
        priority: "normal",
        actionUrl: "/dashboard/conversations",
      }).catch(() => {});

    } catch (err) {
      console.error("[IG-WEBHOOK] Error processing Instagram message:", err.message);
    }
  }

  // Always return 200 to prevent Meta from retrying
  return NextResponse.json({ status: "ok" });
}
