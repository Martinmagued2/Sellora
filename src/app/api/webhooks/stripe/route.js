import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import { sendPlanUpgradeEmail } from "@/lib/email";

// Use service role for webhook — no user session available (lazy-initialized)
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

export async function POST(request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const { userId, plan } = session.metadata;

        // Update account with Stripe customer ID and plan
        await getSupabase()
          .from("accounts")
          .update({
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            plan: plan,
            plan_status: "trialing",
          })
          .eq("id", userId);

        // Send plan upgrade confirmation email (fire-and-forget)
        try {
          const { data: account } = await getSupabase()
            .from("accounts")
            .select("email")
            .eq("id", userId)
            .single();

          if (account?.email && plan) {
            const planConfig = { starter: { name: "Starter", amount: 0 }, professional: { name: "Professional", amount: 29 }, business: { name: "Business", amount: 79 } }[plan];
            if (planConfig && planConfig.amount > 0) {
              sendPlanUpgradeEmail({
                to: account.email,
                planName: planConfig.name,
                amount: planConfig.amount,
                currency: "USD",
                interval: session.mode === "subscription" ? "monthly" : "one-time",
              }).catch(err => console.warn("[STRIPE] Plan upgrade email failed:", err.message));
            }
          }
        } catch (emailErr) {
          console.warn("[STRIPE] Plan upgrade email prep failed:", emailErr.message);
        }

        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const { userId, plan } = subscription.metadata;

        const status = subscription.status === "active"
          ? "active"
          : subscription.status === "trialing"
          ? "trialing"
          : subscription.status === "past_due"
          ? "past_due"
          : "canceled";

        await getSupabase()
          .from("accounts")
          .update({
            plan: plan || undefined,
            plan_status: status,
            current_period_end: new Date(
              subscription.current_period_end * 1000
            ).toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;

        await getSupabase()
          .from("accounts")
          .update({
            plan: "starter",
            plan_status: "canceled",
            stripe_subscription_id: null,
          })
          .eq("stripe_subscription_id", subscription.id);

        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;

        // Record payment in our database
        if (invoice.subscription) {
          await getSupabase()
            .from("accounts")
            .update({ plan_status: "active" })
            .eq("stripe_subscription_id", invoice.subscription);
        }

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;

        if (invoice.subscription) {
          await getSupabase()
            .from("accounts")
            .update({ plan_status: "past_due" })
            .eq("stripe_subscription_id", invoice.subscription);
        }

        break;
      }

      default:
        console.warn(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error("Error processing webhook:", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
