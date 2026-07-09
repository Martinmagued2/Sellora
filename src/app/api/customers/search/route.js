/**
 * GET /api/customers/search?q=...
 *
 * Lightweight customer search endpoint used by the @ mention dropdown in
 * the AI Copilot. Returns up to 10 matching customers for the effective
 * account (works for both owners and team members).
 *
 * Response:
 *   { customers: [{ id, name, email, phone, channel, total_spent, last_active_at }] }
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { resolveEffectiveAccount } from "@/lib/team-auth";

let _admin = null;
function admin() {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _admin;
}

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { effectiveAccountId } = await resolveEffectiveAccount(user);
    if (!effectiveAccountId) {
      return NextResponse.json({ error: "No account found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    if (q.length < 1) {
      return NextResponse.json({ customers: [] });
    }

    const db = admin();
    const { data, error } = await db
      .from("customers")
      .select("id, name, email, phone, channel, total_spent, last_active_at")
      .eq("account_id", effectiveAccountId)
      .ilike("name", `%${q}%`)
      .order("total_spent", { ascending: false, nullsFirst: false })
      .limit(10);

    if (error) {
      console.error("[CUSTOMERS SEARCH] error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customers: data || [] });
  } catch (err) {
    console.error("[CUSTOMERS SEARCH] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
