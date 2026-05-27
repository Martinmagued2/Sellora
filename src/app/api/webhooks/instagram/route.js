import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { parseInstagramWebhook, getUserProfile } from "@/lib/channels/meta";
import { processIncomingMessage } from "@/lib/channels/processor";
import { createClient } from "@supabase/supabase-js";
import { verifyMetaSignature } from "@/lib/channels/verify";
import { logSecurityEvent } from "@/lib/security-logger";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET — Instagram webhook verification
 * Meta sends a GET to verify the webhook URL during setup
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    // Webhook verified successfully
    return new Response(challenge, { status: 200 });
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
    console.error("Invalid Instagram webhook signature");
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

  if (!parsed || parsed.type !== "message") {
    // Could be a postback, read receipt, etc. — acknowledge it
    return NextResponse.json({ status: "ok" });
  }

  try {
    // Look up the account that this page belongs to
    const { data: account } = await supabase
      .from("accounts")
      .select("instagram_access_token")
      .eq("instagram_page_id", parsed.pageId)
      .single();

    if (!account?.instagram_access_token) {
      console.error("No Instagram token found for page:", parsed.pageId);
      return NextResponse.json({ status: "no_token" });
    }

    // Try to get the sender's profile (name + pic)
    const profile = await getUserProfile({
      userId: parsed.senderId,
      accessToken: account.instagram_access_token,
    });

    // Extract media URLs from attachments
    const mediaUrls = (parsed.attachments || [])
      .filter((a) => a.type === "image" || a.type === "video")
      .map((a) => a.payload?.url)
      .filter(Boolean);

    // Process through the shared pipeline
    await processIncomingMessage({
      senderId: parsed.senderId,
      senderName: profile?.name || null,
      senderProfilePic: profile?.profile_pic || null,
      text: parsed.text,
      mediaUrls,
      channel: "instagram",
      pageId: parsed.pageId,
      platformMessageId: parsed.messageId,
      accessToken: account.instagram_access_token,
    });

  } catch (err) {
    console.error("Error processing Instagram message:", err);
  }

  // Always return 200 to prevent Meta from retrying
  return NextResponse.json({ status: "ok" });
}
