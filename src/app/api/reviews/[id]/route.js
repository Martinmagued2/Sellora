/**
 * PATCH /api/reviews/[id]
 *   body: { action: "publish" | "reject" | "flag", reply?: string }
 *
 * Merchants use this from the dashboard to moderate reviews.
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

export async function PATCH(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { action, reply } = await req.json();

    const admin = getAdminClient();

    // Verify ownership
    const { data: review } = await admin
      .from("product_reviews")
      .select("id, account_id, status")
      .eq("id", id)
      .single();
    if (!review || review.account_id !== user.id) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const update = {};
    if (action === "publish") update.status = "published";
    else if (action === "reject") update.status = "rejected";
    else if (action === "flag") update.status = "flagged";
    else if (reply !== undefined) {
      update.reply = reply;
      update.reply_at = new Date().toISOString();
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const { data: updated, error } = await admin
      .from("product_reviews")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // If a review is ≤2 stars and was just published, flag for merchant follow-up
    if (action === "publish" && updated.rating <= 2) {
      try {
        await admin.from("notifications").insert({
          account_id: user.id,
          type: "low_review",
          title: `Low review (${updated.rating}★) needs follow-up`,
          body: `A customer just left a ${updated.rating}-star review. Consider reaching out to make it right.`,
          link: "/dashboard/reviews",
        });
      } catch (e) { /* ignore */ }
    }

    return NextResponse.json({ review: updated });
  } catch (err) {
    console.error("[REVIEWS] PATCH error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
