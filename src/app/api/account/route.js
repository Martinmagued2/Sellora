import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

let _supabase = null;
function getServiceRoleClient() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabase;
}

/**
 * Get authenticated user from either:
 *   1. Bearer token in Authorization header (preferred, more reliable)
 *   2. Cookie-based session (fallback)
 */
async function getAuthUser(request) {
  // ── Method 1: Bearer token ──
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    try {
      const token = authHeader.replace("Bearer ", "");
      const supabase = getServiceRoleClient();
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) {
        console.log("[Account API] Authenticated via Bearer token for user", data.user.id);
        return data.user;
      }
      console.warn("[Account API] Bearer token auth failed:", error?.message);
    } catch (err) {
      console.warn("[Account API] Bearer token exception:", err.message);
    }
  }

  // ── Method 2: Cookie-based session ──
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();

    if (!allCookies || allCookies.length === 0) {
      console.error("[Account API] No cookies found — user not authenticated");
      return null;
    }

    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return allCookies;
          },
          setAll() {
            // No-op — we don't need to set cookies in an API route
          },
        },
      }
    );

    const { data, error } = await supabaseAuth.auth.getUser();

    if (error) {
      console.error("[Account API] Cookie auth error:", error.message);
      return null;
    }

    if (!data?.user) {
      console.error("[Account API] No user found in session");
      return null;
    }

    console.log("[Account API] Authenticated via cookies for user", data.user.id);
    return data.user;
  } catch (err) {
    console.error("[Account API] Cookie auth exception:", err.message);
    return null;
  }
}

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

    console.log("[Account API] Updating user", user.id, "with fields:", Object.keys(updates));

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

    console.log("[Account API] Update successful for user", user.id);
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
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
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
