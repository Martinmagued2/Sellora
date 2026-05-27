import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isRateLimited } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-logger";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const merchantOrderId = url.searchParams.get("merchant_order_id");
    const ip = req.headers.get("x-forwarded-for") || "unknown";

    if (!merchantOrderId) {
      return NextResponse.json({ error: "Missing merchant_order_id" }, { status: 400 });
    }

    // Authenticate user session
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      await logSecurityEvent({
        eventType: "unauthorized_access",
        ipAddress: ip,
        route: "/api/payments/verify-latest",
        details: { reason: "missing_auth_header" }
      });
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authUserError } = await supabaseAdmin.auth.getUser(token);
    if (authUserError || !user) {
      await logSecurityEvent({
        eventType: "unauthorized_access",
        ipAddress: ip,
        route: "/api/payments/verify-latest",
        details: { reason: "invalid_token" }
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate Limiting (10 requests per 10 seconds)
    if (isRateLimited(user.id, 10, 10000)) {
      await logSecurityEvent({
        eventType: "rate_limit_hit",
        userId: user.id,
        ipAddress: ip,
        route: "/api/payments/verify-latest",
        details: { limit: "10_per_10s" }
      });
      return NextResponse.json({ error: "Too many requests, please slow down." }, { status: 429 });
    }

    // Fetch latest status of this specific transaction intent
    const { data: paymentRecord } = await supabaseAdmin
      .from("payments")
      .select("status, plan_purchased, updated_at")
      .eq("merchant_order_id", merchantOrderId)
      .eq("account_id", user.id) // Ensure cross-check safety
      .single();

    if (!paymentRecord) {
      return NextResponse.json({ error: "Payment intent not found" }, { status: 404 });
    }

    // Also fetch the current account status proactively
    const { data: account } = await supabaseAdmin
      .from("accounts")
      .select("plan_status, subscription_ends_at, plan")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      intent_status: paymentRecord.status, // "pending", "success", "failed"
      plan_purchased: paymentRecord.plan_purchased,
      account_status: account?.plan_status,
      subscription_ends_at: account?.subscription_ends_at
    });

  } catch (error) {
    console.error("[PAYMOB_VERIFY_SYNC] Error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
