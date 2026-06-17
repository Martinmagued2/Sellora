/**
 * Extended Funnel Analytics
 * GET /api/funnel?range=30d
 *
 * Multi-step funnel: message → conversation → product_inquiry → cart →
 * order → paid → delivered → reviewed
 *
 * Each step has a count and conversion rate from the previous step.
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

const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90 };

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const rangeKey = searchParams.get("range") || "30d";
    const days = RANGE_DAYS[rangeKey] || 30;
    const since = new Date(Date.now() - days * 86400_000).toISOString();

    const admin = getAdminClient();

    // 1. Total incoming messages (= customers who reached out)
    const { count: messagesCount } = await admin
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("direction", "incoming")
      .gte("created_at", since)
      .in("conversation_id",
        (await admin.from("conversations").select("id").eq("account_id", user.id)).data?.map((c) => c.id) || []
      );

    // 2. Conversations started
    const { count: conversationsCount } = await admin
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("account_id", user.id)
      .gte("created_at", since);

    // 3. Product inquiries (messages tagged with product_info intent)
    const { count: productInquiries } = await admin
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("direction", "incoming")
      .eq("intent", "product_info")
      .gte("created_at", since);

    // 4. Carts created
    const { count: cartsCount } = await admin
      .from("carts")
      .select("*", { count: "exact", head: true })
      .eq("account_id", user.id)
      .gte("created_at", since);

    // 5. Orders created
    const { count: ordersCount } = await admin
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("account_id", user.id)
      .gte("created_at", since);

    // 6. Orders paid
    const { count: paidCount } = await admin
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("account_id", user.id)
      .eq("payment_status", "paid")
      .gte("created_at", since);

    // 7. Orders delivered
    const { count: deliveredCount } = await admin
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("account_id", user.id)
      .eq("status", "delivered")
      .gte("updated_at", since);

    // 8. Reviews submitted
    const { count: reviewsCount } = await admin
      .from("product_reviews")
      .select("*", { count: "exact", head: true })
      .eq("account_id", user.id)
      .gte("created_at", since);

    const steps = [
      { label: "Messages received", count: messagesCount || 0, color: "var(--accent-secondary)" },
      { label: "Conversations started", count: conversationsCount || 0, color: "var(--accent-primary)" },
      { label: "Product inquiries", count: productInquiries || 0, color: "var(--accent-primary-light)" },
      { label: "Carts created", count: cartsCount || 0, color: "var(--accent-orange)" },
      { label: "Orders placed", count: ordersCount || 0, color: "var(--accent-pink)" },
      { label: "Paid orders", count: paidCount || 0, color: "var(--accent-green)" },
      { label: "Delivered", count: deliveredCount || 0, color: "#3BA55C" },
      { label: "Reviewed", count: reviewsCount || 0, color: "#f5b400" },
    ];

    // Compute conversion rates
    const stepsWithConversion = steps.map((s, i) => ({
      ...s,
      conversionFromPrev: i === 0 ? null : (steps[i - 1].count > 0 ? Math.round((s.count / steps[i - 1].count) * 1000) / 10 : 0),
      conversionFromFirst: steps[0].count > 0 ? Math.round((s.count / steps[0].count) * 1000) / 10 : 100,
    }));

    return NextResponse.json({
      range: rangeKey,
      steps: stepsWithConversion,
      overallConversion: steps[0].count > 0
        ? Math.round(((steps[5].count || 0) / steps[0].count) * 1000) / 10
        : 0,
    });
  } catch (err) {
    console.error("[FUNNEL] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
