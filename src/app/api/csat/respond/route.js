/** POST /api/csat/respond — public endpoint called when customer taps a CSAT button */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

let _adminClient = null;
function getAdminClient() {
  if (!_adminClient) _adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _adminClient;
}

export async function POST(req) {
  try {
    const { surveyId, rating } = await req.json();
    if (!surveyId || !rating) return NextResponse.json({ error: "surveyId and rating required" }, { status: 400 });

    const admin = getAdminClient();
    const { data, error } = await admin.from("csat_surveys")
      .update({ rating: parseInt(rating), responded_at: new Date().toISOString() })
      .eq("id", surveyId).select("*").single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, survey: data });
  } catch (e) { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}
