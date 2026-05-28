import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCheckoutSession, createBillingPortalSession } from "@/lib/stripe";

/**
 * POST /api/billing/checkout
 * Creates a Stripe Checkout session for plan upgrade
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { plan, interval } = await request.json();

    if (!plan || !["starter", "professional", "business"].includes(plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    // Get account info
    const { data: account } = await supabase
      .from("accounts")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    // If user already has a Stripe customer, use billing portal
    if (account?.stripe_customer_id) {
      const session = await createBillingPortalSession({
        customerId: account.stripe_customer_id,
      });
      return NextResponse.json({ url: session.url });
    }

    // Create new checkout session
    const session = await createCheckoutSession({
      userId: user.id,
      email: user.email,
      plan,
      interval: interval || "monthly",
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
