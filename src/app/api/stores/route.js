import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

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

async function getAuthUser(req) {
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll(); } } }
  );
  const { data: { user }, error } = await supabaseAuth.auth.getUser();
  if (error || !user) return null;
  return user;
}

/**
 * GET /api/stores - List all stores for the authenticated user
 * Returns stores with product count, order count, and conversation count
 */
export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabase();

    const { data: stores, error } = await supabase
      .from("stores")
      .select(`
        *,
        products:products(count),
        orders:orders(count),
        conversations:conversations(count)
      `)
      .eq("account_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch stores: " + error.message }, { status: 500 });
    }

    // Transform counts
    const storesWithCounts = (stores || []).map((store) => ({
      ...store,
      product_count: store.products?.[0]?.count || 0,
      order_count: store.orders?.[0]?.count || 0,
      conversation_count: store.conversations?.[0]?.count || 0,
      products: undefined,
      orders: undefined,
      conversations: undefined,
    }));

    return NextResponse.json({ success: true, stores: storesWithCounts });
  } catch (error) {
    console.error("Stores GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/stores - Create a new store
 * Body: { name, slug?, description?, logo_url?, industry?, currency?, country? }
 */
export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, slug, description, logo_url, industry, currency, country } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Store name is required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Check plan limits
    const { data: account } = await supabase
      .from("accounts")
      .select("plan, max_stores")
      .eq("id", user.id)
      .single();

    const { getPlanLimits, isLimitExceeded } = await import("@/lib/plan-limits");
    const limits = getPlanLimits(account?.plan || "starter");
    const storeLimit = limits.stores !== undefined ? limits.stores : (account?.max_stores || 1);

    if (storeLimit !== -1) {
      const { count } = await supabase
        .from("stores")
        .select("*", { count: "exact", head: true })
        .eq("account_id", user.id);

      if (isLimitExceeded(count || 0, storeLimit)) {
        return NextResponse.json({
          error: `Store limit reached. Your ${account?.plan || "starter"} plan allows ${storeLimit} store(s). Please upgrade to add more.`,
          limit: storeLimit,
          current: count,
        }, { status: 403 });
      }
    }

    // Auto-generate slug from name if not provided
    const storeSlug = slug || name.trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Check unique slug per account
    const { data: existing } = await supabase
      .from("stores")
      .select("id")
      .eq("account_id", user.id)
      .eq("slug", storeSlug)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "A store with this slug already exists" }, { status: 409 });
    }

    const { data, error } = await supabase
      .from("stores")
      .insert({
        account_id: user.id,
        name: name.trim(),
        slug: storeSlug,
        description: description || null,
        logo_url: logo_url || null,
        industry: industry || null,
        currency: currency || "EGP",
        country: country || null,
        is_active: true,
        settings: {},
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to create store: " + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, store: data });
  } catch (error) {
    console.error("Stores POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
