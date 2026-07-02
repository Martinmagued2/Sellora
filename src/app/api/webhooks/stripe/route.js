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

// 🔒 SECURITY: Track processed Stripe event IDs for idempotency
// In-memory set — in production, use a database table or Redis
const processedEventIds = new Set();
const EVENT_ID_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

// Periodic cleanup
setInterval(() => {
  processedEventIds.clear();
}, EVENT_ID_MAX_AGE);

export async function POST(request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  // 🔒 SECURITY: Check if Stripe is configured
  if (!stripe) {
    console.error("[STRIPE-WEBHOOK] Stripe is not configured (STRIPE_SECRET_KEY missing)");
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

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

  // 🔒 SECURITY: Idempotency check — skip already-processed events
  if (processedEventIds.has(event.id)) {
    console.log(`[STRIPE-WEBHOOK] Duplicate event ${event.id} skipped`);
    return NextResponse.json({ received: true, duplicate: true });
  }
  processedEventIds.add(event.id);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const { userId, plan } = session.metadata;

        if (!userId) {
          console.error("[STRIPE-WEBHOOK] checkout.session.completed missing userId in metadata");
          break;
        }

        // 🔒 SECURITY: Only update if account doesn't already have this plan (idempotency)
        const { data: existingAccount } = await getSupabase()
          .from("accounts")
          .select("stripe_customer_id, plan")
          .eq("id", userId)
          .single();

        // Update account with Stripe customer ID and plan
        const updateData = {
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          plan: plan,
          plan_status: "trialing",
        };

        // If account already has this plan and customer ID, skip to avoid unnecessary updates
        if (existingAccount?.stripe_customer_id === session.customer && existingAccount?.plan === plan) {
          console.log(`[STRIPE-WEBHOOK] Account ${userId} already has plan ${plan}, skipping update`);
        } else {
          await getSupabase()
            .from("accounts")
            .update(updateData)
            .eq("id", userId);
        }

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
                accountId: userId,
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
