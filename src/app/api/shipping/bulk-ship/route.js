/**
 * Bulk Ship API
 * POST /api/shipping/bulk-ship
 *
 * Marks multiple orders as shipped at once. For each order:
 *   - Sets status to 'shipped'
 *   - Sets shipped_at to now
 *   - Sets carrier + tracking_number if provided
 *   - Sends a WhatsApp/Messenger message to the customer with tracking info
 *
 * Body: {
 *   orderIds: string[],
 *   carrier?: string,         // e.g. "Aramex", "DHL", "Bosta"
 *   trackingNumbers?: { [orderId: string]: string },
 *   notifyCustomers?: boolean // default true
 * }
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { sendMessage } from "@/lib/channels/meta";

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

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { orderIds, carrier, trackingNumbers = {}, notifyCustomers = true } = await req.json();

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: "orderIds required" }, { status: 400 });
    }
    if (orderIds.length > 200) {
      return NextResponse.json({ error: "Max 200 orders per bulk ship" }, { status: 400 });
    }

    const admin = getAdminClient();
    const batchId = `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const results = { success: [], failed: [], notified: 0 };

    // Fetch orders (verify ownership)
    const { data: orders, error: fetchErr } = await admin
      .from("orders")
      .select(`
        id, order_number, customer_id, channel, total, currency,
        customers!inner(name, phone)
      `)
      .in("id", orderIds)
      .eq("account_id", user.id);

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

    // Fetch account tokens for sending notifications
    const { data: account } = await admin
      .from("accounts")
      .select("whatsapp_access_token, whatsapp_phone_number_id, instagram_access_token, instagram_page_id, facebook_access_token, facebook_page_id, business_name")
      .eq("id", user.id)
      .single();

    for (const order of orders) {
      try {
        const trackingNumber = trackingNumbers[order.id] || null;
        const updatePayload = {
          status: "shipped",
          shipped_at: new Date().toISOString(),
          bulk_ship_batch_id: batchId,
        };
        if (carrier) updatePayload.carrier = carrier;
        if (trackingNumber) updatePayload.tracking_number = trackingNumber;

        const { error: updateErr } = await admin
          .from("orders")
          .update(updatePayload)
          .eq("id", order.id);

        if (updateErr) {
          results.failed.push({ orderId: order.id, error: updateErr.message });
          continue;
        }

        results.success.push({
          orderId: order.id,
          orderNumber: order.order_number,
          trackingNumber,
        });

        // Send notification to customer
        if (notifyCustomers && order.customers?.phone) {
          try {
            const msg = `📦 Your order ${order.order_number} has been shipped!${carrier ? `\nCarrier: ${carrier}` : ""}${trackingNumber ? `\nTracking: ${trackingNumber}` : ""}\n\nThank you for shopping with ${account?.business_name || "us"}! 🙏`;

            if (order.channel === "whatsapp") {
              await sendWhatsAppMessage({
                to: order.customers.phone,
                message: msg,
                phoneNumberId: account.whatsapp_phone_number_id,
                accessToken: account.whatsapp_access_token,
              });
            } else if (order.channel === "instagram" && account.instagram_access_token) {
              await sendMessage({
                recipientId: order.customers.phone, // PSID/IGSID ideally — fallback to phone
                message: msg,
                pageId: account.instagram_page_id,
                accessToken: account.instagram_access_token,
              });
            }
            results.notified++;
          } catch (e) {
            // Notification failure shouldn't fail the bulk ship
            console.warn(`[BULK-SHIP] notify failed for ${order.id}:`, e.message);
          }
        }
      } catch (e) {
        results.failed.push({ orderId: order.id, error: e.message });
      }
    }

    return NextResponse.json({
      success: true,
      batchId,
      summary: {
        total: orderIds.length,
        shipped: results.success.length,
        failed: results.failed.length,
        notified: results.notified,
      },
      results,
    });
  } catch (err) {
    console.error("[BULK-SHIP] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
