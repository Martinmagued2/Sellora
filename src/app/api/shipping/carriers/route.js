import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Curated list of supported carriers
const CURATED_CARRIERS = [
  { name: "Aramex", code: "aramex", country: "UAE" },
  { name: "DHL Express", code: "dhl", country: "Germany" },
  { name: "FedEx", code: "fedex", country: "USA" },
  { name: "UPS", code: "ups", country: "USA" },
  { name: "Egypt Post", code: "egypt-post", country: "Egypt" },
  { name: "GLS", code: "gls", country: "Germany" },
  { name: "TNT", code: "tnt", country: "Netherlands" },
  { name: "USPS", code: "usps", country: "USA" },
  { name: "SF Express", code: "sf-express", country: "China" },
  { name: "BlueDart", code: "bluedart", country: "India" },
  { name: "Delhivery", code: "delhivery", country: "India" },
  { name: "Correos", code: "correos", country: "Spain" },
];

/**
 * GET /api/shipping/carriers - Return a list of supported shipping carriers
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

    let carriers = [...CURATED_CARRIERS];

    // If AfterShip API key is configured, also fetch full carrier list
    const _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: account } = await _supabase
      .from("accounts")
      .select("aftership_api_key")
      .eq("id", user.id)
      .single();

    const apiKey = account?.aftership_api_key;

    if (apiKey) {
      try {
        const response = await fetch("https://api.aftership.com/v4/couriers", {
          headers: {
            "aftership-api-key": apiKey,
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();

        if (data.meta?.code === 200 && data.data?.couriers) {
          const aftershipCarriers = data.data.couriers.map((c) => ({
            name: c.name || c.other_name,
            code: c.slug,
            country: c.phone || "",
          }));

          // Merge: curated first, then any additional from AfterShip
          const curatedCodes = new Set(carriers.map((c) => c.code));
          const additional = aftershipCarriers.filter((c) => !curatedCodes.has(c.code));
          carriers = [...carriers, ...additional.slice(0, 50)]; // Limit to 50 extra
        }
      } catch (err) {
        console.error("AfterShip carriers fetch error:", err.message);
      }
    }

    return NextResponse.json({ success: true, carriers });
  } catch (error) {
    console.error("Shipping carriers GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
