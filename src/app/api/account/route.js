import { NextResponse } from "next/server";
import { getServiceRoleClient, getAuthUser } from "@/lib/auth-helper";

/**
 * PATCH /api/account
 *
 * Updates the authenticated user's account profile.
 * Uses the service role key to bypass RLS policies.
 * Only allows updating safe profile fields.
 */
const ALLOWED_FIELDS = new Set([
  "business_name",
  "business_description",
  "industry",
  "phone",
  "country",
  "currency",
  "ai_enabled",
  "ai_personality",
  "notify_escalations",
  "instagram_url",
  "facebook_url",
  "website_url",
  "auto_greeting",
  "auto_greeting_message",
  "greeting_per_channel",
  "instagram_greeting",
  "facebook_greeting",
  "whatsapp_greeting",
  "greeting_delay_seconds",
  "auto_follow_up_enabled",
  "abandoned_cart_enabled",
  "abandoned_cart_hours",
  "abandoned_cart_auto_reminder",
  "abandoned_cart_reminder_hours",
  "abandoned_cart_auto_second_reminder",
  "abandoned_cart_second_reminder_hours",
  "abandoned_cart_discount_percent",
  "notification_prefs",
  "logo_url",
]);

export async function PATCH(request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated — please log in again" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Filter to only allowed fields
    const updates = {};
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_FIELDS.has(key)) {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const supabase = getServiceRoleClient();
    const { error: updateError } = await supabase
      .from("accounts")
      .update(updates)
      .eq("id", user.id);

    if (updateError) {
      console.error("[Account API] Update failed:", updateError.message);
      return NextResponse.json(
        { error: "Failed to save: " + updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Account API] PATCH exception:", err);
    return NextResponse.json(
      { error: "Failed to save changes: " + (err.message || "Unknown error") },
      { status: 500 }
    );
  }
}

/**
 * GET /api/account
 *
 * Fetches the authenticated user's account profile.
 * Uses the service role key to bypass RLS policies.
 */
export async function GET(request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const supabase = getServiceRoleClient();
    // SECURITY: Use SAFE_ACCOUNT_FIELDS to exclude sensitive columns
    // (totp_secret, *_access_token, shopify_access_token, etc.)
    // Never use select("*") on accounts — that exposes live platform tokens.
    const { SAFE_ACCOUNT_FIELDS } = await import("@/lib/safe-fields");
    const { data, error } = await supabase
      .from("accounts")
      .select(SAFE_ACCOUNT_FIELDS)
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("[Account API] GET failed:", error.message);
      return NextResponse.json(
        { error: "Failed to fetch account" },
        { status: 500 }
      );
    }

    return NextResponse.json({ account: data });
  } catch (err) {
    console.error("[Account API] GET exception:", err);
    return NextResponse.json(
      { error: "Failed to fetch account" },
      { status: 500 }
    );
  }
}
