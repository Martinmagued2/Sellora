import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isRateLimited } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-logger";

// Initialize Supabase admin client for secure DB operations (lazy-initialized)
let _supabaseAdmin = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabaseAdmin;
}

// Map plan identifiers to EGP amount strictly on backend
const PLAN_PRICES = {
  starter: 499,
  professional: 1299,
  business: 2999
};

export async function POST(req) {
  try {
    const { plan_id } = await req.json();
    const ip = req.headers.get("x-forwarded-for") || "unknown";

    if (!PLAN_PRICES[plan_id]) {
      return NextResponse.json({ error: "Invalid plan selected" }, { status: 400 });
    }

    // 1. Authenticate user
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      await logSecurityEvent({
        eventType: "unauthorized_access",
        ipAddress: ip,
        route: "/api/payments/create-subscription",
        details: { reason: "missing_auth_header" }
      });
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");
    
    // Validate user token
    const { data: { user }, error: authUserError } = await getSupabaseAdmin().auth.getUser(token);
    if (authUserError || !user) {
      await logSecurityEvent({
        eventType: "unauthorized_access",
        ipAddress: ip,
        route: "/api/payments/create-subscription",
        details: { reason: "invalid_token" }
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate Limiting (5 requests per 1 minute to prevent spamming payment creation)
    if (isRateLimited(user.id, 5, 60000)) {
      await logSecurityEvent({
        eventType: "rate_limit_hit",
        userId: user.id,
        ipAddress: ip,
        route: "/api/payments/create-subscription",
        details: { limit: "5_per_1m" }
      });
      return NextResponse.json({ error: "Too many payment attempts. Please try again in a minute." }, { status: 429 });
    }

    // Fetch account to get billing details (name, email)
    const { data: account } = await getSupabaseAdmin()
      .from("accounts")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Amount in cents for Paymob
    const amountCents = PLAN_PRICES[plan_id] * 100;

    // --- PAYMOB AUTHENTICATION CYCLE ---
    const apiKey = process.env.PAYMOB_API_KEY;
    const integrationId = process.env.PAYMOB_INTEGRATION_ID;
    
    // Step 1: Authentication Request
    const authRes = await fetch("https://accept.paymob.com/api/auth/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey }),
    });
    
    const authData = await authRes.json();
    if (!authData.token) throw new Error("Paymob auth failed");
    const authToken = authData.token;

    // Step 2: Order Registration
    const merchantOrderId = `sub_${user.id}_${Date.now()}`;
    const orderRes = await fetch("https://accept.paymob.com/api/ecommerce/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_token: authToken,
        delivery_needed: "false",
        amount_cents: amountCents.toString(),
        currency: "EGP",
        merchant_order_id: merchantOrderId,
        items: [{
          name: `${plan_id} subscription`,
          amount_cents: amountCents.toString(),
          description: `BOS Subscription - ${plan_id}`,
          quantity: "1"
        }],
      }),
    });
    
    const orderData = await orderRes.json();
    if (!orderData.id) throw new Error("Paymob order registration failed");
    
    // Step 3: Payment Key Generation
    const paymentKeyRes = await fetch("https://accept.paymob.com/api/acceptance/payment_keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_token: authToken,
        amount_cents: amountCents.toString(),
        expiration: 3600,
        order_id: orderData.id,
        billing_data: {
          apartment: "NA",
          email: account.email || user.email,
          floor: "NA",
          first_name: account.owner_name?.split(" ")[0] || "Owner",
          street: "NA",
          building: "NA",
          phone_number: account.phone || "NA",
          shipping_method: "NA",
          postal_code: "NA",
          city: "NA",
          country: "EG",
          last_name: account.owner_name?.split(" ").slice(1).join(" ") || account.business_name,
          state: "NA"
        },
        currency: "EGP",
        integration_id: integrationId,
      }),
    });
    
    const paymentKeyData = await paymentKeyRes.json();
    if (!paymentKeyData.token) throw new Error("Paymob payment key generation failed");

    // Pre-insert into our newly created payments table to track intent
    await getSupabaseAdmin().from("payments").insert([{
      account_id: user.id,
      merchant_order_id: merchantOrderId,
      paymob_order_id: orderData.id.toString(),
      amount: PLAN_PRICES[plan_id],
      currency: "EGP",
      status: "pending",
      plan_purchased: plan_id
    }]);

    // Construct checkout URL - Hard Redirect works via the standard iframe link when visited directly
    const iframeId = process.env.PAYMOB_IFRAME_ID;
    const checkoutUrl = `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentKeyData.token}`;

    return NextResponse.json({ url: checkoutUrl });

  } catch (error) {
    console.error("Paymob Integration Error:", error);
    // 🔒 SECURITY: Don't leak internal error details to client
    return NextResponse.json({ error: "Failed to create subscription. Please try again." }, { status: 500 });
  }
}
