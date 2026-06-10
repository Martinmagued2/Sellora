import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createCheckout } from "@/lib/paymob";

// Server-side admin client (bypasses RLS)
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

/**
 * POST /api/paymob/order-checkout
 *
 * Generates a Paymob payment link for a customer order.
 * Supports coupon discounts — the payment amount is adjusted after discount.
 *
 * Body: { orderId, coupon_code?, discount_amount? }
 * Response: { checkoutUrl, paymentLink, adjusted_total? }
 */
export async function POST(request) {
  try {
    const { orderId, coupon_code, discount_amount } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    // Check if Paymob is configured
    if (!process.env.PAYMOB_API_KEY || !process.env.PAYMOB_INTEGRATION_ID || !process.env.PAYMOB_IFRAME_ID) {
      return NextResponse.json({ error: "Paymob is not configured. Add PAYMOB_API_KEY, PAYMOB_INTEGRATION_ID, and PAYMOB_IFRAME_ID to your environment variables." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Get the order with customer info
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, order_number, account_id, items, total, currency, payment_status, payment_link, customer:customers(id, name, phone, email)")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Skip if already paid
    if (order.payment_status === "paid") {
      return NextResponse.json({ error: "Order is already paid", checkoutUrl: order.payment_link }, { status: 400 });
    }

    // 2. If payment link already exists AND no coupon is being applied, return existing link
    if (order.payment_link && !coupon_code) {
      return NextResponse.json({
        checkoutUrl: order.payment_link,
        paymentLink: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/${order.id}`,
        existing: true,
      });
    }

    // 3. Calculate the adjusted total if a coupon is applied
    let finalTotal = parseFloat(order.total);
    let discountAmount = 0;

    if (coupon_code) {
      // If discount_amount is explicitly provided, use it
      if (discount_amount !== undefined && discount_amount !== null) {
        discountAmount = parseFloat(discount_amount);
      } else {
        // Otherwise, validate the coupon to get the discount
        const validateRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/coupons/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: coupon_code,
            order_total: order.total,
            account_id: order.account_id,
            items: order.items,
          }),
        });
        const validateData = await validateRes.json();

        if (validateData.valid) {
          discountAmount = parseFloat(validateData.discount_amount || 0);
        }
      }

      finalTotal = Math.max(0, finalTotal - discountAmount);

      // Update the order with coupon info and adjusted total
      await supabase.from("orders").update({
        coupon_code: coupon_code,
        discount_amount: discountAmount,
        subtotal: parseFloat(order.total),
        total: finalTotal,
      }).eq("id", orderId);
    }

    // 4. Create Paymob checkout session with the (possibly discounted) amount
    const amountCents = Math.round(finalTotal * 100); // Convert to cents
    const merchantOrderId = `ord_${order.order_number}_${Date.now()}`;

    const customerName = order.customer?.name || "Customer";
    const nameParts = customerName.split(" ");

    const checkoutResult = await createCheckout({
      amountCents,
      merchantOrderId,
      items: order.items || [],
      billingData: {
        firstName: nameParts[0] || "Customer",
        lastName: nameParts.slice(1).join(" ") || "Customer",
        email: order.customer?.email || "customer@sellora.com",
        phone: order.customer?.phone || "NA",
        city: "Cairo",
        country: "EG",
      },
    });

    // 5. Save payment link and Paymob order ID to the order
    const paymentLink = `${process.env.NEXT_PUBLIC_APP_URL}/checkout/${order.id}`;

    await supabase.from("orders").update({
      payment_link: paymentLink,
      payment_method: "paymob",
    }).eq("id", orderId);

    // Also save to payments table for tracking
    const { error: paymentInsertError } = await supabase.from("payments").insert({
      account_id: order.account_id,
      merchant_order_id: merchantOrderId,
      paymob_order_id: checkoutResult.paymobOrderId.toString(),
      amount: finalTotal,
      currency: order.currency || "EGP",
      status: "pending",
      plan_purchased: null,
    });

    if (paymentInsertError) {
      console.error("[PAYMOB-ORDER] Failed to insert payment record:", paymentInsertError);
    }

    console.log(`[PAYMOB-ORDER] Checkout created for order ${order.order_number}, Paymob order ID: ${checkoutResult.paymobOrderId}, Amount: ${finalTotal} (discount: ${discountAmount})`);

    const response = {
      checkoutUrl: checkoutResult.checkoutUrl,
      paymentLink,
      paymobOrderId: checkoutResult.paymobOrderId,
    };

    // Include adjusted total if coupon was applied
    if (coupon_code) {
      response.adjusted_total = finalTotal;
      response.discount_amount = discountAmount;
      response.original_total = parseFloat(order.total);
    }

    return NextResponse.json(response);

  } catch (err) {
    console.error("[PAYMOB-ORDER] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
