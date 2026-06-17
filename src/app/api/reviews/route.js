/**
 * Reviews API
 *
 * GET    /api/reviews                       — list reviews (with filters)
 * POST   /api/reviews                       — create a review (from WhatsApp/inline)
 * PATCH  /api/reviews/[id]                  — update status (publish/reject) or reply
 *
 * The post-delivery flow:
 *   1. order becomes 'delivered' → process-post-delivery cron sends WhatsApp
 *      message with a 1-5 star rating prompt + unique review URL
 *   2. customer taps a star → opens /review/[token] public page → submits
 *   3. review lands in 'pending' status — merchant approves/rejects from dashboard
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";

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

/** GET /api/reviews — list reviews for the authenticated account */
export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "all";
    const productId = searchParams.get("productId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

    const admin = getAdminClient();
    let query = admin
      .from("product_reviews")
      .select(`
        id, rating, title, body, status, source, reply, reply_at, created_at,
        product_id, customer_id, order_id,
        products!inner(name),
        customers(name)
      `)
      .eq("account_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status !== "all") query = query.eq("status", status);
    if (productId) query = query.eq("product_id", productId);

    const { data: reviews, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Compute summary stats
    const { data: allReviews } = await admin
      .from("product_reviews")
      .select("rating, status")
      .eq("account_id", user.id);
    const published = (allReviews || []).filter((r) => r.status === "published");
    const avgRating = published.length > 0
      ? (published.reduce((s, r) => s + r.rating, 0) / published.length).toFixed(2)
      : null;
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    published.forEach((r) => { ratingDistribution[r.rating]++; });

    return NextResponse.json({
      reviews: reviews || [],
      stats: {
        total: (allReviews || []).length,
        published: published.length,
        pending: (allReviews || []).filter((r) => r.status === "pending").length,
        avgRating: avgRating ? parseFloat(avgRating) : null,
        ratingDistribution,
      },
    });
  } catch (err) {
    console.error("[REVIEWS] GET error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** POST /api/reviews — create a review (public, called from the review landing page) */
export async function POST(req) {
  try {
    const body = await req.json();
    const { orderId, productId, customerId, rating, title, body: reviewBody, source = "whatsapp" } = body;

    if (!orderId || !productId || !rating) {
      return NextResponse.json({ error: "orderId, productId, and rating are required" }, { status: 400 });
    }
    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: "rating must be 1-5" }, { status: 400 });
    }

    const admin = getAdminClient();

    // Verify the order exists and belongs to a valid account
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("id, account_id, customer_id, status")
      .eq("id", orderId)
      .single();
    if (orderErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Insert the review (pending status — merchant approves)
    const { data: review, error: reviewErr } = await admin
      .from("product_reviews")
      .insert({
        account_id: order.account_id,
        product_id: productId,
        customer_id: customerId || order.customer_id,
        order_id: orderId,
        rating,
        title: title || null,
        body: reviewBody || null,
        status: "pending",
        source,
      })
      .select("*")
      .single();

    if (reviewErr) {
      // Duplicate review (UNIQUE constraint on order+product+customer)
      if (reviewErr.code === "23505") {
        return NextResponse.json({ error: "You've already reviewed this product" }, { status: 409 });
      }
      console.error("[REVIEWS] insert failed:", reviewErr);
      return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
    }

    return NextResponse.json({ review });
  } catch (err) {
    console.error("[REVIEWS] POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
