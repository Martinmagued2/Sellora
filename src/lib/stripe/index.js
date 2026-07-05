import Stripe from "stripe";

export const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
  typescript: false,
}) : null;

// Price mapping for plans
export const PLANS = {
  starter: {
    name: "Starter",
    monthly: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID,
    annual: process.env.STRIPE_STARTER_ANNUAL_PRICE_ID,
    limits: {
      channels: 1,
      products: 25,
      conversations_per_month: 100,
    },
  },
  professional: {
    name: "Professional",
    monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    annual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
    limits: {
      channels: 2,
      products: -1, // unlimited
      conversations_per_month: 1000,
    },
  },
  business: {
    name: "Business",
    monthly: process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID,
    annual: process.env.STRIPE_BUSINESS_ANNUAL_PRICE_ID,
    limits: {
      channels: 3,
      products: -1,
      conversations_per_month: -1,
    },
  },
};

export async function createCheckoutSession({ userId, email, plan, interval }) {
  if (!stripe) throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY.");

  const planConfig = PLANS[plan];
  if (!planConfig) throw new Error(`Invalid plan: ${plan}`);

  // 🔒 SECURITY: Validate interval against allowed values
  const validInterval = ["monthly", "annual"].includes(interval) ? interval : "monthly";
  const priceId = validInterval === "annual" ? planConfig.annual : planConfig.monthly;

  if (!priceId) throw new Error(`No price ID configured for plan ${plan} (${validInterval})`);

  const session = await stripe.checkout.sessions.create({
    customer_email: email,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?canceled=true`,
    subscription_data: {
      trial_period_days: 14,
      metadata: { userId, plan },
    },
    metadata: { userId, plan },
  });

  return session;
}

export async function createBillingPortalSession({ customerId }) {
  if (!stripe) throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY.");

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
  });

  return session;
}
