/** POST /api/orders/auto-update — auto-update order status based on payment/shipping events */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

let _adminClient = null;
function getAdminClient() {
  if (!_adminClient) _adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _adminClient;
}

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { orderId, newStatus, paymentStatus } = await req.json();
    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

    const admin = getAdminClient();
    const { data: order } = await admin.from("orders")
      .select("id, order_number, status, payment_status, total, currency, customer_id, channel, customers(name, phone), accounts(whatsapp_access_token, whatsapp_phone_number_id, business_name)")
      .eq("id", orderId).eq("account_id", user.id).single();
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const update = {};
    let shouldNotify = false;
    let notificationMsg = "";

    // Payment received → auto-confirm order
    if (paymentStatus === "paid" && order.payment_status !== "paid") {
      update.payment_status = "paid";
      if (order.status === "pending") update.status = "confirmed";
      shouldNotify = true;
      notificationMsg = `✅ Payment received for order ${order.order_number}! Your order is now confirmed. We'll ship it soon.`;
    }

    // Status changed
    if (newStatus && newStatus !== order.status) {
      update.status = newStatus;
      if (newStatus === "shipped") {
        update.shipped_at = new Date().toISOString();
        shouldNotify = true;
        notificationMsg = `📦 Your order ${order.order_number} has been shipped!`;
      } else if (newStatus === "delivered") {
        update.delivered_at = new Date().toISOString();
        shouldNotify = true;
        notificationMsg = `🎉 Your order ${order.order_number} has been delivered! How was your experience?`;
      } else if (newStatus === "confirmed") {
        shouldNotify = true;
        notificationMsg = `✅ Your order ${order.order_number} has been confirmed! Total: ${order.currency} ${order.total}.`;
      } else if (newStatus === "cancelled") {
        shouldNotify = true;
        notificationMsg = `❌ Your order ${order.order_number} has been cancelled. If this is a mistake, please contact us.`;
      }
    }

    if (Object.keys(update).length === 0) return NextResponse.json({ success: true, message: "No changes needed" });

    await admin.from("orders").update(update).eq("id", orderId);

    // Send WhatsApp notification
    if (shouldNotify && order.channel === "whatsapp" && order.customers?.phone && order.accounts?.whatsapp_access_token) {
      try {
        await sendWhatsAppMessage({
          to: order.customers.phone,
          message: notificationMsg,
          phoneNumberId: order.accounts.whatsapp_phone_number_id,
          accessToken: order.accounts.whatsapp_access_token,
        });
      } catch (e) { console.warn("[ORDER-AUTO] notify failed:", e.message); }
    }

    return NextResponse.json({ success: true, update, notified: shouldNotify });
  } catch (e) { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}
