/**
 * GET/PUT /api/settings/push-thresholds
 * Manages VIP push notification thresholds for an account.
 *
 * GET: returns current thresholds
 * PUT: { thresholds } — e.g. { orders: { min_amount: 3000 }, messages: { vip_only: true } }
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
      .select("push_thresholds")
      .eq("id", effectiveAccountId)
      .maybeSingle();

    const thresholds = account?.push_thresholds || {};
    return NextResponse.json({ thresholds });
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

    const { thresholds } = await req.json();
    const db = admin();

    const { error } = await db
      .from("accounts")
      .update({ push_thresholds: thresholds })
      .eq("id", effectiveAccountId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, thresholds });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
