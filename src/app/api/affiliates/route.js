/**
 * Affiliates API
 * GET    /api/affiliates              — list affiliates
 * POST   /api/affiliates              — create affiliate { name, email, commission_percent }
 * PATCH  /api/affiliates/[id]         — update
 * GET    /api/affiliates/track?code=  — public: track a click + return affiliate_id
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";

let _adminClient = null;
function getAdminClient() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _adminClient;
}

function generateCode(name) {
  const base = name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${base || "AFF"}${rand}`;
}

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = getAdminClient();
    const { data, error } = await admin
      .from("affiliates")
      .select("*")
      .eq("account_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ affiliates: data || [] });
  } catch (err) {
    console.error("[AFFILIATES] GET error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, email, phone, commission_percent = 5.00, code } = body;
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

    const admin = getAdminClient();
    const finalCode = (code || generateCode(name)).toUpperCase().replace(/[^A-Z0-9]/g, "");

    const { data, error } = await admin
      .from("affiliates")
      .insert({
        account_id: user.id,
        name, email, phone,
        code: finalCode,
        commission_percent,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Code already in use — try a different one" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ affiliate: data });
  } catch (err) {
    console.error("[AFFILIATES] POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
