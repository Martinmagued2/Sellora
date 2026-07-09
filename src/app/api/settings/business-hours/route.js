/**
 * GET/PUT /api/settings/business-hours
 * Manages business hours + after-hours auto-pilot setting.
 *
 * GET: returns { business_hours, after_hours_auto_pilot, timezone }
 * PUT: { business_hours, after_hours_auto_pilot, timezone }
 *
 * business_hours format:
 * {
 *   "monday": { "start": "09:00", "end": "18:00", "enabled": true },
 *   "tuesday": { ... },
 *   ...
 *   "friday": { "enabled": false }  // weekend
 * }
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { resolveEffectiveAccount } from "@/lib/team-auth";

let _admin = null;
function admin() {
  if (!_admin)
    _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { effectiveAccountId } = await resolveEffectiveAccount(user);
    if (!effectiveAccountId) return NextResponse.json({ error: "No account" }, { status: 404 });

    const db = admin();
    const { data: account } = await db
      .from("accounts")
      .select("business_hours, after_hours_auto_pilot, timezone")
      .eq("id", effectiveAccountId)
      .maybeSingle();

    return NextResponse.json({
      business_hours: account?.business_hours || {},
      after_hours_auto_pilot: account?.after_hours_auto_pilot ?? true,
      timezone: account?.timezone || "Africa/Cairo",
    });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { effectiveAccountId, role } = await resolveEffectiveAccount(user);
    if (!effectiveAccountId) return NextResponse.json({ error: "No account" }, { status: 404 });
    if (role === "agent") return NextResponse.json({ error: "Only owner/admin can change settings" }, { status: 403 });

    const body = await req.json();
    const updates = {};
    if (body.business_hours !== undefined) updates.business_hours = body.business_hours;
    if (body.after_hours_auto_pilot !== undefined) updates.after_hours_auto_pilot = body.after_hours_auto_pilot;
    if (body.timezone !== undefined) updates.timezone = body.timezone;

    const db = admin();
    const { error } = await db
      .from("accounts")
      .update(updates)
      .eq("id", effectiveAccountId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, ...updates });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * Check if the business is currently open based on business_hours + timezone.
 * Returns true if open, false if closed (after-hours).
 */
export function isBusinessOpen(businessHours, timezone = "Africa/Cairo") {
  if (!businessHours || Object.keys(businessHours).length === 0) return true; // No hours set = always open

  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  try {
    const now = new Date();
    // Get current day + time in the business's timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const weekday = parts.find((p) => p.type === "weekday")?.value?.toLowerCase() || days[now.getDay()];
    const timeStr = `${parts.find((p) => p.type === "hour")?.value || "00"}:${parts.find((p) => p.type === "minute")?.value || "00"}`;

    const todayHours = businessHours[weekday];
    if (!todayHours || !todayHours.enabled) return false; // Closed today

    const currentMinutes = parseInt(timeStr.slice(0, 2)) * 60 + parseInt(timeStr.slice(3, 5));
    const startMinutes = parseInt((todayHours.start || "00:00").slice(0, 2)) * 60 + parseInt((todayHours.start || "00:00").slice(3, 5));
    const endMinutes = parseInt((todayHours.end || "23:59").slice(0, 2)) * 60 + parseInt((todayHours.end || "23:59").slice(3, 5));

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } catch (e) {
    console.warn("[BUSINESS-HOURS] check failed:", e.message);
    return true; // On error, assume open
  }
}
