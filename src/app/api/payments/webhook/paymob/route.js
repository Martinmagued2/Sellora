import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from 'crypto';
import { sendOrderConfirmationEmail } from "@/lib/email";

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

// Define subscription durations dynamically
const PLAN_DURATIONS = {
  starter: 30,
  professional: 30,
  business: 30,
  starter_annual: 365,
  professional_annual: 365,
  business_annual: 365,
};

// Paymob uses SHA512 and concatenates specific fields from `obj` alphabetically.
function calculateMac(obj, hmacSecret) {
  const fields = [
    'amount_cents',
    'created_at',
    'currency',
    'error_occured',
    'has_parent_transaction',
    'id',
    'integration_id',
    'is_3d_secure',
    'is_auth',
    'is_capture',
    'is_refunded',
    'is_standalone_payment',
    'is_voided',
    'order.id',
    'owner',
    'pending',
    'source_data.pan',
    'source_data.sub_type',
    'source_data.type',
    'success'
  ];

  let concatenatedString = '';
  for (const field of fields) {
    if (field === 'order.id') {
      concatenatedString += obj.order?.id || '';
    } else if (field.startsWith('source_data.')) {
      const subField = field.split('.')[1];
      concatenatedString += obj.source_data?.[subField] || '';
    } else {
      // Paymob passes booleans as true/false implicitly in JS, must safely cast string
      let val = obj[field];
      if (val === true) val = "true";
      if (val === false) val = "false";
      concatenatedString += val || '';
    }
  }

  return crypto.createHmac('sha512', hmacSecret).update(concatenatedString).digest('hex');
}

export async function POST(req) {
  try {
    console.log("[PAYMOB_WEBHOOK_INIT] Received webhook from Paymob");
    const url = new URL(req.url);
    const hmacParam = url.searchParams.get("hmac");
    const body = await req.json();

    // 1. Verify HMAC
    if (!hmacParam) {
      console.warn("[PAYMOB_HMAC] Error: Missing HMAC parameter");
      return NextResponse.json({ error: "Missing HMAC" }, { status: 400 });
    }
    
    if (!body || !body.obj) {
      console.warn("[PAYMOB_WEBHOOK] Error: Invalid body schema");
      return NextResponse.json({ error: "Invalid body schema" }, { status: 400 });
    }

    // 🔒 SECURITY: Verify HMAC secret is configured before verification
    if (!process.env.PAYMOB_HMAC_SECRET) {
      console.error("[PAYMOB_HMAC] CRITICAL: PAYMOB_HMAC_SECRET is not set — cannot verify webhook authenticity");
      return NextResponse.json({ error: "Webhook verification not configured" }, { status: 500 });
    }

    const calculatedHmac = calculateMac(body.obj, process.env.PAYMOB_HMAC_SECRET);
    try {
      const isValid = crypto.timingSafeEqual(
        Buffer.from(calculatedHmac, 'hex'),
        Buffer.from(hmacParam, 'hex')
      );
      if (!isValid) {
        console.error("[PAYMOB_HMAC] Validation FAILED! Signature mismatch.");
        return NextResponse.json({ error: "Invalid HMAC signature" }, { status: 401 });
      }
    } catch (e) {
      console.error("[PAYMOB_HMAC] Comparison error:", e.message);
      return NextResponse.json({ error: "Invalid HMAC signature" }, { status: 401 });
    }
    console.log("[PAYMOB_HMAC] Validation SUCCESS.");

    // 2. Extract specific payload data
    const transaction = body.obj;
    const isSuccess = transaction.success === true || transaction.success === "true";
    const paymobOrderId = transaction.order?.id?.toString();
    const merchantOrderId = transaction.order?.merchant_order_id;
    const transactionId = transaction.id?.toString();
    const paymentMethod = transaction.source_data?.sub_type || transaction.source_data?.type || 'unknown';

    // 3. Find processing record
    const { data: paymentRecord } = await getSupabaseAdmin()
      .from("payments")
      .select("*")
      .eq("merchant_order_id", merchantOrderId)
      .single();

    if (!paymentRecord) {
      console.warn(`[PAYMOB_WEBHOOK] Unknown payment order: ${merchantOrderId}`);
      return NextResponse.json({ message: "Unknown payment order" }, { status: 404 });
    }

    // Idempotency check
    if (paymentRecord.status === 'success') {
      console.log(`[PAYMOB_WEBHOOK] Duplicate webhook ignored for ${merchantOrderId}`);
      return NextResponse.json({ message: "Already processed successfully" }, { status: 200 });
    }

    // 4. Handle Failure
    if (!isSuccess) {
      console.log(`[PAYMOB_WEBHOOK] Payment marked as FAILED for ${merchantOrderId}`);
      await getSupabaseAdmin().from("payments").update({
        status: "failed",
        paymob_transaction_id: transactionId,
        payment_method: paymentMethod,
        updated_at: new Date().toISOString()
      }).eq("id", paymentRecord.id);
      return NextResponse.json({ message: "Payment failed logged" });
    }

    // 5. Handle Success
    console.log(`[PAYMOB_WEBHOOK] Payment SUCCESS mapped for ${merchantOrderId}. Type: ${paymentRecord.plan_purchased ? 'subscription' : 'order'}`);
    
    // Update Payments table
    await getSupabaseAdmin().from("payments").update({
      status: "success",
      paymob_transaction_id: transactionId,
      payment_method: paymentMethod,
      updated_at: new Date().toISOString()
    }).eq("id", paymentRecord.id);

    // ─── ORDER PAYMENT (not a subscription) ───
    if (!paymentRecord.plan_purchased) {
      // Find the order by the merchant_order_id pattern: ord_ORD-XXX_timestamp
      const orderNumber = merchantOrderId?.split("_")?.[1]; // Extract "ORD-XXX" from "ord_ORD-XXX_timestamp"
      
      if (orderNumber) {
        const { data: order } = await getSupabaseAdmin()
          .from("orders")
          .select("id, order_number")
          .eq("order_number", orderNumber)
          .single();

        if (order) {
          await getSupabaseAdmin().from("orders").update({
            payment_status: "paid",
            payment_method: `paymob_${paymentMethod}`,
            updated_at: new Date().toISOString(),
          }).eq("id", order.id);

          console.log(`[PAYMOB_WEBHOOK] Order ${order.order_number} marked as PAID via ${paymentMethod}`);

          // Send order confirmation email to the business owner (fire-and-forget)
          try {
            const { data: fullOrder } = await getSupabaseAdmin()
              .from("orders")
              .select("id, order_number, items, total, currency, account_id, customer:customers(name)")
              .eq("id", order.id)
              .single();

            if (fullOrder) {
              const { data: accountData } = await getSupabaseAdmin()
                .from("accounts")
                .select("email")
                .eq("id", fullOrder.account_id)
                .single();

              if (accountData?.email) {
                sendOrderConfirmationEmail({
                  to: accountData.email,
                  orderNumber: fullOrder.order_number,
                  customerName: fullOrder.customer?.name || "Customer",
                  items: Array.isArray(fullOrder.items) ? fullOrder.items : [],
                  total: fullOrder.total || 0,
                  currency: fullOrder.currency || "EGP",
                }).catch(err => console.warn("[PAYMOB] Order confirmation email failed:", err.message));
              }
            }
          } catch (emailErr) {
            console.warn("[PAYMOB] Order confirmation email prep failed:", emailErr.message);
          }
        } else {
          console.warn(`[PAYMOB_WEBHOOK] Could not find order with number ${orderNumber}`);
        }
      }

      console.log(`[PAYMOB_WEBHOOK_COMPLETE] Order payment processed for ${merchantOrderId}`);
      return NextResponse.json({ message: "Order payment processed" });
    }

    // ─── SUBSCRIPTION PAYMENT ───
    // Get current account parameters
    const { data: account } = await getSupabaseAdmin()
      .from("accounts")
      .select("subscription_ends_at")
      .eq("id", paymentRecord.account_id)
      .single();

    if (!account) return NextResponse.json({ error: "Account missing" }, { status: 500 });

    // Subscription logic: extend GREATEST(NOW, ends_at) + plan duration
    const now = new Date();
    const currentEnd = account.subscription_ends_at ? new Date(account.subscription_ends_at) : now;
    const baseDate = currentEnd > now ? currentEnd : now;
    
    const addedDays = PLAN_DURATIONS[paymentRecord.plan_purchased] || 30; // Default 30 if unrecognized
    const nextEnd = new Date(baseDate);
    nextEnd.setDate(nextEnd.getDate() + addedDays);

    // Update Accounts table safely
    await getSupabaseAdmin().from("accounts").update({
      plan: paymentRecord.plan_purchased,
      plan_status: "active",
      subscription_started_at: now.toISOString(),
      subscription_ends_at: nextEnd.toISOString(),
      paymob_order_id: paymobOrderId,
      last_payment_at: now.toISOString(),
      updated_at: now.toISOString()
    }).eq("id", paymentRecord.account_id);

    console.log(`[PAYMOB_WEBHOOK_COMPLETE] Subscription fully extended by ${addedDays} days for account ${paymentRecord.account_id}`);
    return NextResponse.json({ message: "Webhook processed completely" });

  } catch (error) {
    console.error("Webhook processing error:", error.message);
    // Return 500 to tell Paymob to retry it if our network failed
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
