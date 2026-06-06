import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Service role client (lazy-initialized)
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabase;
}

/**
 * GET /api/shipping/config - Get shipping integration config for the user
 */
export async function GET(req) {
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { getAll() { return cookieStore.getAll(); } } }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();

    const { data: account, error } = await supabase
      .from("accounts")
      .select("aftership_api_key, aftership_default_carrier, auto_track_shipments")
      .eq("id", user.id)
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to fetch config: " + error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      config: {
        api_key: account?.aftership_api_key || "",
        api_key_set: !!account?.aftership_api_key,
        default_carrier: account?.aftership_default_carrier || "aramex",
        auto_track: account?.auto_track_shipments !== false,
        connected: !!account?.aftership_api_key,
      },
    });
  } catch (error) {
    console.error("Shipping config GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/shipping/config - Save shipping config
 * Body: { api_key, default_carrier, auto_track }
 */
export async function PUT(req) {
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { getAll() { return cookieStore.getAll(); } } }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { api_key, default_carrier, auto_track } = body;

    const supabase = getSupabase();

    const updates = {};
    if (api_key !== undefined) updates.aftership_api_key = api_key || null;
    if (default_carrier !== undefined) updates.aftership_default_carrier = default_carrier;
    if (auto_track !== undefined) updates.auto_track_shipments = auto_track;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No config fields to update" }, { status: 400 });
    }

    const { error } = await supabase
      .from("accounts")
      .update(updates)
      .eq("id", user.id);

    if (error) {
      return NextResponse.json({ error: "Failed to save config: " + error.message }, { status: 500 });
    }

    // Verify the connection if API key was provided
    let connected = false;
    if (api_key) {
      try {
        const response = await fetch("https://api.aftership.com/v4/couriers", {
          headers: {
            "aftership-api-key": api_key,
            "Content-Type": "application/json",
          },
        });
        const data = await response.json();
        connected = data.meta?.code === 200;
      } catch (err) {
        connected = false;
      }
    }

    return NextResponse.json({
      success: true,
      connected,
    });
  } catch (error) {
    console.error("Shipping config PUT error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
