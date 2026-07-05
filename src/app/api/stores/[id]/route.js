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
 * GET /api/stores/[id] - Get store details
 */
export async function GET(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("stores")
      .select(`
        *,
        products:products(count),
        orders:orders(count),
        conversations:conversations(count)
      `)
      .eq("id", id)
      .eq("account_id", user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      store: {
        ...data,
        product_count: data.products?.[0]?.count || 0,
        order_count: data.orders?.[0]?.count || 0,
        conversation_count: data.conversations?.[0]?.count || 0,
        products: undefined,
        orders: undefined,
        conversations: undefined,
      },
    });
  } catch (error) {
    console.error("Store GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/stores/[id] - Update store
 * Body: { name?, slug?, description?, logo_url?, industry?, currency?, country?, is_active?, settings? }
 */
export async function PATCH(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const supabase = getSupabase();

    // Verify ownership
    const { data: existing } = await supabase
      .from("stores")
      .select("id, slug")
      .eq("id", id)
      .eq("account_id", user.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // If slug is being changed, check for conflicts
    if (body.slug && body.slug !== existing.slug) {
      const { data: slugConflict } = await supabase
        .from("stores")
        .select("id")
        .eq("account_id", user.id)
        .eq("slug", body.slug)
        .maybeSingle();

      if (slugConflict) {
        return NextResponse.json({ error: "A store with this slug already exists" }, { status: 409 });
      }
    }

    const updateFields = {};
    const allowedFields = ["name", "slug", "description", "logo_url", "industry", "currency", "country", "is_active"];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields[field] = body[field];
      }
    }
    // Handle 'settings' separately with validation
    if (body.settings !== undefined) {
      if (typeof body.settings !== 'object' || Array.isArray(body.settings)) {
        return NextResponse.json({ error: "Settings must be a valid object" }, { status: 400 });
      }
      // Limit settings size
      const settingsStr = JSON.stringify(body.settings);
      if (settingsStr.length > 5000) {
        return NextResponse.json({ error: "Settings object too large (max 5KB)" }, { status: 400 });
      }
      // Only allow known setting keys
      const ALLOWED_SETTING_KEYS = [
        "primary_color", "secondary_color", "font_family", "logo_position",
        "show_prices", "show_stock", "currency_format", "language",
        "enable_search", "enable_filters", "enable_cart", "enable_checkout",
        "shipping_enabled", "shipping_fee", "free_shipping_threshold",
        "tax_enabled", "tax_rate", "whatsapp_number", "social_links"
      ];
      const filteredSettings = {};
      for (const [key, value] of Object.entries(body.settings)) {
        if (ALLOWED_SETTING_KEYS.includes(key)) {
          filteredSettings[key] = value;
        }
      }
      updateFields.settings = filteredSettings;
    }
    updateFields.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("stores")
      .update(updateFields)
      .eq("id", id)
      .eq("account_id", user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to update store: " + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, store: data });
  } catch (error) {
    console.error("Store PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/stores/[id] - Delete store
 * Reassigns data to null (or the first remaining store) and deletes the store
 */
export async function DELETE(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const supabase = getSupabase();

    // Verify ownership
    const { data: existing } = await supabase
      .from("stores")
      .select("id, name")
      .eq("id", id)
      .eq("account_id", user.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // Check if this is the last store
    const { count } = await supabase
      .from("stores")
      .select("*", { count: "exact", head: true })
      .eq("account_id", user.id);

    // Find another store to reassign data to (if available)
    let reassignStoreId = null;
    if (count > 1) {
      const { data: otherStore } = await supabase
        .from("stores")
        .select("id")
        .eq("account_id", user.id)
        .neq("id", id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      reassignStoreId = otherStore?.id || null;
    }

    // Reassign data: update store_id on related records
    const tables = ["products", "orders", "conversations", "customers", "campaigns"];
    for (const table of tables) {
      await supabase
        .from(table)
        .update({ store_id: reassignStoreId })
        .eq("account_id", user.id)
        .eq("store_id", id);
    }

    // Delete the store
    const { error } = await supabase
      .from("stores")
      .delete()
      .eq("id", id)
      .eq("account_id", user.id);

    if (error) {
      return NextResponse.json({ error: "Failed to delete store: " + error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Store "${existing.name}" deleted. Data reassigned to ${reassignStoreId ? "another store" : "no store"}.`,
      reassigned_to: reassignStoreId,
    });
  } catch (error) {
    console.error("Store DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
