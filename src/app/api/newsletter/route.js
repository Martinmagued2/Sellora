/** POST /api/newsletter — subscribe to newsletter (public) */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

let _admin = null;
function getAdmin() {
  if (!_admin) _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

export async function POST(req) {
  try {
    const { email, source = "homepage_footer" } = await req.json();
    if (!email || !email.includes("@")) return NextResponse.json({ error: "Valid email required" }, { status: 400 });

    const admin = getAdmin();
    const { error } = await admin.from("newsletter_subscribers").upsert({ email, source }, { onConflict: "email" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, message: "Subscribed!" });
  } catch (e) { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}
