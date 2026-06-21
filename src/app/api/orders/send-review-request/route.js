import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth-helper';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { sendMessage } from '@/lib/channels/meta';

let _admin = null;
function admin() {
  if (!_admin) {
    _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return _admin;
}

/**
 * POST /api/orders/send-review-request
 * Body: { orderId }
 *
 * Manually sends a review request message to the customer for a specific order.
 * Uses the order's channel (WhatsApp/IG/FB) to send the message.
 * Records the event so the automated cron doesn't double-send.
 */
export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { orderId } = await req.json();
    if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 });

    const db = admin();

    // Get the order with customer + account info — scoped to authenticated user
    const { data: order, error: orderError } = await db.from('orders')
      .select(`
        id, order_number, items, channel, customer_id, account_id,
        customer:customers(id, name, phone, platform_id),
        account:accounts(id, whatsapp_access_token, whatsapp_phone_number_id, instagram_access_token, instagram_page_id, facebook_access_token, facebook_page_id, business_name)
      `)
      .eq('id', orderId)
      .eq('account_id', user.id)  // 🔒 IDOR protection
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (!order.customer) {
      return NextResponse.json({ error: 'No customer linked to this order' }, { status: 400 });
    }

    // Check if a review request was already sent
    const { data: existing } = await db.from('order_post_delivery_events')
      .select('id, sent_at')
      .eq('order_id', orderId)
      .eq('event_type', 'review_request')
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        error: 'A review request was already sent for this order',
        sentAt: existing.sent_at,
      }, { status: 409 });
    }

    // Build the review URL
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sellora-ruby.vercel.app';
    const firstItem = (order.items || [])[0];
    const productId = firstItem?.product_id || firstItem?.id || '';
    const reviewUrl = `${APP_URL}/review?order=${order.id}&product=${productId}`;

    const customerName = order.customer.name || 'there';
    const message = `Hi ${customerName}! 🌟 Your order ${order.order_number} was delivered — we'd love to hear what you think!\n\nTap a star to rate your experience:\n${reviewUrl}\n\nIt takes 10 seconds and means the world to us. Thank you! 🙏`;

    const account = Array.isArray(order.account) ? order.account[0] : order.account;
    const customer = Array.isArray(order.customer) ? order.customer[0] : order.customer;
    const recipientId = customer?.phone || customer?.platform_id;

    if (!recipientId) {
      return NextResponse.json({ error: 'Customer has no phone or platform ID — cannot send message' }, { status: 400 });
    }

    let sent = false;
    let sendError = null;

    if (order.channel === 'whatsapp' && account?.whatsapp_access_token) {
      try {
        await sendWhatsAppMessage({
          to: recipientId,
          message,
          phoneNumberId: account.whatsapp_phone_number_id,
          accessToken: account.whatsapp_access_token,
        });
        sent = true;
      } catch (e) { sendError = e.message; }
    } else if (order.channel === 'instagram' && account?.instagram_access_token) {
      try {
        await sendMessage({
          recipientId,
          message,
          pageId: account.instagram_page_id,
          accessToken: account.instagram_access_token,
        });
        sent = true;
      } catch (e) { sendError = e.message; }
    } else if (order.channel === 'facebook' && account?.facebook_access_token) {
      try {
        await sendMessage({
          recipientId,
          message,
          pageId: account.facebook_page_id,
          accessToken: account.facebook_access_token,
        });
        sent = true;
      } catch (e) { sendError = e.message; }
    } else {
      return NextResponse.json({
        error: `Channel "${order.channel}" is not connected. Connect it in Settings → Channels first.`,
      }, { status: 400 });
    }

    if (!sent) {
      return NextResponse.json({
        error: `Failed to send message: ${sendError || 'unknown error'}`,
      }, { status: 500 });
    }

    // Record the event
    await db.from('order_post_delivery_events').insert({
      order_id: order.id,
      account_id: user.id,
      event_type: 'review_request',
      sent_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `Review request sent to ${customerName} via ${order.channel}`,
      reviewUrl,
    });
  } catch (e) {
    console.error('[send-review-request]', e);
    return NextResponse.json({ error: 'Failed to send review request' }, { status: 500 });
  }
}
