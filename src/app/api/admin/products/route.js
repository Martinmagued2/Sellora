import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";

// Service role client (lazy-initialized for use in route handlers)
import { createClient } from "@supabase/supabase-js";
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
 * GET /api/admin/products?search=&status=&account_id=&page=1&limit=20
 * All products across all accounts
 */
export async function GET(request) {
  try {
    const { isAdmin } = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const accountId = searchParams.get("account_id") || "";
    const page = Math.max(1, parseInt(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit")) || 20));
    const offset = (page - 1) * limit;

    // Build products query with account join
    let query = supabase
      .from("products")
      .select(
        `id, name, description, price, currency, category, image_urls, stock,
         status, variants, created_at, updated_at,
         account:accounts!products_account_id_fkey(id, business_name, email, plan)`
      )
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);
    if (accountId) query = query.eq("account_id", accountId);
    if (search) {
      const sanitizedSearch = (search || '').replace(/[%)_(,.]/g, '\\$&');
      query = query.or(`name.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%,category.ilike.%${sanitizedSearch}%`);
    }

    // Get total count
    let countQuery = supabase
      .from("products")
      .select("id", { count: "exact", head: true });

    if (status) countQuery = countQuery.eq("status", status);
    if (accountId) countQuery = countQuery.eq("account_id", accountId);
    if (search) {
      const sanitizedSearch = (search || '').replace(/[%)_(,.]/g, '\\$&');
      countQuery = countQuery.or(`name.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%,category.ilike.%${sanitizedSearch}%`);
    }

    const { count: totalCount } = await countQuery;

    // Fetch paginated products
    const { data: products, error: productsError } = await query.range(offset, offset + limit - 1);

    if (productsError) {
      return NextResponse.json({ error: "Failed to fetch products", details: productsError.message }, { status: 500 });
    }

    // Enrich with account info
    const enriched = (products || []).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      currency: p.currency,
      category: p.category,
      image_urls: p.image_urls,
      stock: p.stock,
      status: p.status,
      variants: p.variants,
      created_at: p.created_at,
      updated_at: p.updated_at,
      account: p.account,
    }));

    return NextResponse.json({
      success: true,
      data: {
        products: enriched,
        pagination: {
          page,
          limit,
          total: totalCount || 0,
          totalPages: Math.ceil((totalCount || 0) / limit),
        },
      },
    });
  } catch (error) {
    console.error("Admin products error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
