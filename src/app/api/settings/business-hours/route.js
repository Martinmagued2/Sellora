/**
 * GET/PUT /api/settings/business-hours
 * Manages business hours + after-hours auto-pilot setting.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { resolveEffectiveAccount } from "@/lib/team-auth";
export { isBusinessOpen } from "@/lib/business-hours";

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

// isBusinessOpen is now imported from @/lib/business-hours (re-exported above)
