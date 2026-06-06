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

// Helper: generate demo tracking data
function generateDemoTracking(trackingNumber, carrier, carrierCode) {
  const now = new Date();
  const statuses = ["pending", "info_received", "in_transit", "out_for_delivery", "delivered"];
  const randomStatusIdx = Math.floor(Math.random() * statuses.length);
  // Bias toward in_transit and delivered for realistic demo
  const statusWeights = [1, 2, 4, 3, 3];
  const totalWeight = statusWeights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * totalWeight;
  let selectedIdx = 0;
  for (let i = 0; i < statusWeights.length; i++) {
    rand -= statusWeights[i];
    if (rand <= 0) { selectedIdx = i; break; }
  }
  const status = statuses[selectedIdx];

  const locations = [
    "Cairo, Egypt", "Alexandria, Egypt", "Dubai, UAE", "London, UK",
    "Frankfurt, Germany", "Paris, France", "New York, USA", "Singapore",
    "Mumbai, India", "Istanbul, Turkey", "Riyadh, Saudi Arabia", "Doha, Qatar"
  ];

  const checkpoints = [];
  const numCheckpoints = Math.min(selectedIdx + 1, 5);

  for (let i = numCheckpoints - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setHours(date.getHours() - (i * 8 + Math.floor(Math.random() * 4)));
    const locIdx = Math.floor(Math.random() * locations.length);
    const tag = statuses[Math.min(i, statuses.length - 1)];

    let message = "";
    switch (tag) {
      case "pending": message = "Shipment information received"; break;
      case "info_received": message = "Package picked up by carrier"; break;
      case "in_transit": message = `In transit - departed ${locations[locIdx]}`; break;
      case "out_for_delivery": message = "Out for delivery - with local courier"; break;
      case "delivered": message = "Delivered - signed by recipient"; break;
      default: message = "Status update"; break;
    }

    checkpoints.push({
      location: locations[locIdx],
      message,
      tag,
      checkpoint_time: date.toISOString(),
    });
  }

  const estimatedDelivery = new Date(now);
  estimatedDelivery.setDate(estimatedDelivery.getDate() + Math.floor(Math.random() * 5) + 1);

  return {
    tracking_number: trackingNumber,
    carrier: carrier || "Aramex",
    carrier_code: carrierCode || "aramex",
    status,
    checkpoints,
    estimated_delivery: status === "delivered" ? null : estimatedDelivery.toISOString(),
    last_checked_at: now.toISOString(),
  };
}

/**
 * GET /api/shipping/track - Track a shipment by tracking number
 * Query params: tracking_number, carrier_code
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

    const { searchParams } = new URL(req.url);
    const trackingNumber = searchParams.get("tracking_number");
    const carrierCode = searchParams.get("carrier_code");

    if (!trackingNumber) {
      return NextResponse.json({ error: "tracking_number is required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Check if AfterShip API key is configured
    const { data: account } = await supabase
      .from("accounts")
      .select("aftership_api_key")
      .eq("id", user.id)
      .single();

    const apiKey = account?.aftership_api_key;

    if (apiKey) {
      // Call AfterShip API
      try {
        const url = carrierCode
          ? `https://api.aftership.com/v4/trackings/${carrierCode}/${trackingNumber}`
          : `https://api.aftership.com/v4/trackings/${trackingNumber}`;

        const response = await fetch(url, {
          headers: {
            "aftership-api-key": apiKey,
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();

        if (data.meta?.code === 200 && data.data?.tracking) {
          const tracking = data.data.tracking;
          return NextResponse.json({
            success: true,
            tracking: {
              tracking_number: tracking.tracking_number || trackingNumber,
              carrier: tracking.title || tracking.slug,
              carrier_code: tracking.slug || carrierCode,
              status: mapAfterShipStatus(tracking.tag),
              checkpoints: (tracking.checkpoints || []).map((cp) => ({
                location: cp.location || "",
                message: cp.message || "",
                tag: mapAfterShipStatus(cp.tag),
                checkpoint_time: cp.checkpoint_time || cp.created_at,
              })),
              estimated_delivery: tracking.expected_delivery || null,
              last_checked_at: new Date().toISOString(),
            },
          });
        }

        // AfterShip returned an error - fall back to demo
      } catch (err) {
        console.error("AfterShip API error:", err.message);
      }
    }

    // No API key or AfterShip failed - return demo data
    const demoData = generateDemoTracking(trackingNumber, null, carrierCode);
    return NextResponse.json({
      success: true,
      tracking: demoData,
      demo: true,
    });
  } catch (error) {
    console.error("Shipping track GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/shipping/track - Add a new tracking number
 * Body: { order_id, tracking_number, carrier, carrier_code, title }
 */
export async function POST(req) {
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
    const { order_id, tracking_number, carrier, carrier_code, title } = body;

    if (!tracking_number || !tracking_number.trim()) {
      return NextResponse.json({ error: "Tracking number is required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Get tracking info from AfterShip or demo
    let trackingData;
    const { data: account } = await supabase
      .from("accounts")
      .select("aftership_api_key")
      .eq("id", user.id)
      .single();

    const apiKey = account?.aftership_api_key;

    if (apiKey) {
      // Register with AfterShip
      try {
        const registerRes = await fetch("https://api.aftership.com/v4/trackings", {
          method: "POST",
          headers: {
            "aftership-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tracking: {
              tracking_number: tracking_number.trim(),
              slug: carrier_code || "aramex",
              title: title || undefined,
            },
          }),
        });

        const registerData = await registerRes.json();

        if (registerData.meta?.code === 201 && registerData.data?.tracking) {
          const t = registerData.data.tracking;
          trackingData = {
            status: mapAfterShipStatus(t.tag),
            checkpoints: (t.checkpoints || []).map((cp) => ({
              location: cp.location || "",
              message: cp.message || "",
              tag: mapAfterShipStatus(cp.tag),
              checkpoint_time: cp.checkpoint_time || cp.created_at,
            })),
            estimated_delivery: t.expected_delivery || null,
          };
        }
      } catch (err) {
        console.error("AfterShip register error:", err.message);
      }
    }

    if (!trackingData) {
      const demo = generateDemoTracking(tracking_number, carrier, carrier_code);
      trackingData = {
        status: demo.status,
        checkpoints: demo.checkpoints,
        estimated_delivery: demo.estimated_delivery,
      };
    }

    // Get order_number for display
    let orderDisplay = null;
    if (order_id) {
      const { data: order } = await supabase
        .from("orders")
        .select("order_number")
        .eq("id", order_id)
        .single();
      orderDisplay = order?.order_number || null;
    }

    // Save to database
    const { data, error } = await supabase
      .from("shipment_trackings")
      .insert({
        account_id: user.id,
        order_id: order_id || null,
        tracking_number: tracking_number.trim(),
        carrier: carrier || "Unknown",
        carrier_code: carrier_code || "aramex",
        status: trackingData.status,
        title: title || orderDisplay || null,
        checkpoints: trackingData.checkpoints,
        estimated_delivery: trackingData.estimated_delivery,
        last_checked_at: new Date().toISOString(),
        auto_track: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to save tracking: " + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, tracking: data });
  } catch (error) {
    console.error("Shipping track POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/shipping/track - Refresh tracking data for a specific tracking record
 * Body: { id } - the tracking record ID to refresh
 */
export async function PATCH(req) {
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
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Tracking record ID is required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Fetch the existing record
    const { data: existing, error: fetchError } = await supabase
      .from("shipment_trackings")
      .select("*")
      .eq("id", id)
      .eq("account_id", user.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Tracking record not found" }, { status: 404 });
    }

    // Check if AfterShip API key is configured
    const { data: account } = await supabase
      .from("accounts")
      .select("aftership_api_key")
      .eq("id", user.id)
      .single();

    const apiKey = account?.aftership_api_key;
    let updatedData;

    if (apiKey) {
      // Re-fetch from AfterShip
      try {
        const url = existing.carrier_code
          ? `https://api.aftership.com/v4/trackings/${existing.carrier_code}/${existing.tracking_number}`
          : `https://api.aftership.com/v4/trackings/${existing.tracking_number}`;

        const response = await fetch(url, {
          headers: {
            "aftership-api-key": apiKey,
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();

        if (data.meta?.code === 200 && data.data?.tracking) {
          const tracking = data.data.tracking;
          updatedData = {
            status: mapAfterShipStatus(tracking.tag),
            checkpoints: (tracking.checkpoints || []).map((cp) => ({
              location: cp.location || "",
              message: cp.message || "",
              tag: mapAfterShipStatus(cp.tag),
              checkpoint_time: cp.checkpoint_time || cp.created_at,
            })),
            estimated_delivery: tracking.expected_delivery || null,
            last_checked_at: new Date().toISOString(),
          };
        }
      } catch (err) {
        console.error("AfterShip refresh error:", err.message);
      }
    }

    if (!updatedData) {
      // Regenerate demo data with progression
      const demo = generateDemoTracking(
        existing.tracking_number,
        existing.carrier,
        existing.carrier_code
      );
      updatedData = {
        status: demo.status,
        checkpoints: demo.checkpoints,
        estimated_delivery: demo.estimated_delivery,
        last_checked_at: new Date().toISOString(),
      };
    }

    // Update the database
    const { data, error } = await supabase
      .from("shipment_trackings")
      .update(updatedData)
      .eq("id", id)
      .eq("account_id", user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to update tracking: " + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, tracking: data });
  } catch (error) {
    console.error("Shipping track PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/shipping/track - Delete a tracking record
 * Body: { id }
 */
export async function DELETE(req) {
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

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Tracking record ID is required" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from("shipment_trackings")
      .delete()
      .eq("id", id)
      .eq("account_id", user.id);

    if (error) {
      return NextResponse.json({ error: "Failed to delete tracking: " + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Shipping track DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Map AfterShip tag to our status
function mapAfterShipStatus(tag) {
  if (!tag) return "pending";
  const normalized = tag.toLowerCase().replace(/[\s-]/g, "_");
  const mapping = {
    pending: "pending",
    info_received: "info_received",
    intransit: "in_transit",
    in_transit: "in_transit",
    outfordelivery: "out_for_delivery",
    out_for_delivery: "out_for_delivery",
    delivered: "delivered",
    failed_attempt: "failed_attempt",
    exception: "exception",
    expired: "expired",
  };
  return mapping[normalized] || "pending";
}
