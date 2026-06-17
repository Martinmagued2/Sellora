/**
 * Public Storefront API
 * GET /api/store?slug=<slug>            — fetch store info + products (public)
 * GET /api/store?slug=<slug>&productId=<>— single product detail
 *
 * Powers the public /store/[slug] page where customers can browse products
 * and tap "Order on WhatsApp" to start a chat with a prefilled message.
 *
 * Public — no auth required.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");
    const productId = searchParams.get("productId");

    if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

    const admin = getAdminClient();

    // Look up the store by slug
    const { data: store, error: storeErr } = await admin
      .from("stores")
      .select(`
        id, account_id, slug, name, description, logo_url, banner_url,
        whatsapp_number, instagram_handle, facebook_page,
        is_active, theme, created_at,
        accounts!inner(business_name, country, currency, ai_personality)
      `)
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (storeErr || !store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // Single product detail view
    if (productId) {
      const { data: product, error: prodErr } = await admin
        .from("products")
        .select("id, name, description, price, currency, stock, category, variants, images, status")
        .eq("id", productId)
        .eq("account_id", store.account_id)
        .eq("status", "active")
        .single();

      if (prodErr || !product) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }

      // Fetch published reviews for this product
      const { data: reviews } = await admin
        .from("product_reviews")
        .select("id, rating, title, body, reply, created_at, customers(name)")
        .eq("product_id", productId)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(20);

      const avgRating = reviews && reviews.length > 0
        ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(2)
        : null;

      return NextResponse.json({
        store: {
          id: store.id,
          slug: store.slug,
          name: store.name,
          whatsappNumber: store.whatsapp_number,
          instagramHandle: store.instagram_handle,
          facebookPage: store.facebook_page,
          currency: store.accounts?.currency || "EGP",
          country: store.accounts?.country,
        },
        product,
        reviews: reviews || [],
        avgRating: avgRating ? parseFloat(avgRating) : null,
        reviewCount: (reviews || []).length,
      });
    }

    // List view — return all active products for this store
    const { data: products, error: productsErr } = await admin
      .from("products")
      .select("id, name, description, price, currency, stock, category, images, status")
      .eq("account_id", store.account_id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(100);

    if (productsErr) {
      return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
    }

    return NextResponse.json({
      store: {
        id: store.id,
        slug: store.slug,
        name: store.name,
        description: store.description,
        logoUrl: store.logo_url,
        bannerUrl: store.banner_url,
        whatsappNumber: store.whatsapp_number,
        instagramHandle: store.instagram_handle,
        facebookPage: store.facebook_page,
        currency: store.accounts?.currency || "EGP",
        country: store.accounts?.country,
        businessName: store.accounts?.business_name,
      },
      products: products || [],
    });
  } catch (err) {
    console.error("[STORE] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
