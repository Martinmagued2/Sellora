import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
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

/**
 * POST /api/recommendations - Get product recommendations for a customer
 * Body: { customer_id, account_id, current_product_id?, limit? }
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
    const { customer_id, current_product_id, limit = 4 } = body;
    const account_id = user.id;

    if (!customer_id) {
      return NextResponse.json({ error: "customer_id is required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Get account currency
    const { data: accountData } = await supabase.from("accounts").select("currency").eq("id", account_id).single();
    const currency = accountData?.currency || "EGP";

    // 1. Get customer's order history - find products they've bought
    const { data: customerOrders } = await supabase
      .from("orders")
      .select("items")
      .eq("customer_id", customer_id)
      .eq("account_id", account_id)
      .order("created_at", { ascending: false })
      .limit(10);

    const purchasedProductIds = new Set();
    const purchasedCategories = new Set();

    if (customerOrders) {
      for (const order of customerOrders) {
        if (order.items && Array.isArray(order.items)) {
          for (const item of order.items) {
            if (item.product_id) purchasedProductIds.add(item.product_id);
          }
        }
      }
    }

    // 2. Get all active products for this account
    const { data: allProducts } = await supabase
      .from("products")
      .select("id, name, description, price, stock, category, image_urls")
      .eq("account_id", account_id)
      .eq("status", "active");

    if (!allProducts || allProducts.length === 0) {
      return NextResponse.json({ success: true, recommendations: [], currency });
    }

    // Collect categories from purchased products
    for (const pid of purchasedProductIds) {
      const prod = allProducts.find((p) => p.id === pid);
      if (prod?.category) purchasedCategories.add(prod.category);
    }

    // 3. Collaborative filtering (simplified):
    // Find other customers who bought the same products
    let collabProductScores = {};
    if (purchasedProductIds.size > 0) {
      const pidArray = Array.from(purchasedProductIds);
      const { data: otherOrders } = await supabase
        .from("orders")
        .select("customer_id, items")
        .eq("account_id", account_id)
        .neq("customer_id", customer_id)
        .limit(100);

      if (otherOrders) {
        // Find customers who share at least 1 purchased product
        const similarCustomers = new Set();
        for (const order of otherOrders) {
          if (order.items && Array.isArray(order.items)) {
            for (const item of order.items) {
              if (pidArray.includes(item.product_id)) {
                similarCustomers.add(order.customer_id);
                break;
              }
            }
          }
        }

        // Find what those similar customers also bought
        if (similarCustomers.size > 0) {
          const { data: similarOrders } = await supabase
            .from("orders")
            .select("items")
            .eq("account_id", account_id)
            .in("customer_id", Array.from(similarCustomers))
            .limit(200);

          if (similarOrders) {
            for (const order of similarOrders) {
              if (order.items && Array.isArray(order.items)) {
                for (const item of order.items) {
                  if (item.product_id && !purchasedProductIds.has(item.product_id)) {
                    collabProductScores[item.product_id] = (collabProductScores[item.product_id] || 0) + 1;
                  }
                }
              }
            }
          }
        }
      }
    }

    // 4. Score each product
    const scored = allProducts
      .filter((p) => p.id !== current_product_id)
      .map((product) => {
        let score = 0;
        let reason = "Popular product";

        // Collaborative filtering score
        if (collabProductScores[product.id]) {
          score += collabProductScores[product.id] * 10;
          reason = "Popular with similar customers";
        }

        // Same category as purchased products
        if (purchasedCategories.has(product.category) && !purchasedProductIds.has(product.id)) {
          score += 5;
          reason = "Similar category to your purchases";
        }

        // In stock boost
        if (product.stock > 0) score += 2;

        // If customer hasn't bought anything, just recommend popular items
        if (purchasedProductIds.size === 0) {
          score += Math.random() * 3; // Slight randomization for variety
          reason = "Trending product";
        }

        // Filter out already purchased products (optional)
        // if (purchasedProductIds.has(product.id)) score -= 20;

        // If current product, recommend frequently bought together
        if (current_product_id && product.category === allProducts.find(p => p.id === current_product_id)?.category) {
          score += 3;
          reason = "Frequently bought together";
        }

        return { ...product, score, reason };
      });

    // Sort by score and take top N
    const recommendations = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ score, ...rest }) => rest);

    return NextResponse.json({
      success: true,
      recommendations,
      currency,
      customer_id,
    });
  } catch (error) {
    console.error("Recommendations POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
