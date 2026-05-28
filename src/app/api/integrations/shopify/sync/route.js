import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { decryptShopifyToken } from '@/lib/shopify';
import { fetchShopifyProducts, fetchShopifyOrders, registerShopifyWebhooks } from '@/lib/shopify-api';

export async function POST(req) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { getAll() { return cookieStore.getAll(); } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    // Get account info
    const { data: account, error: accountError } = await adminClient
      .from('accounts')
      .select('id, shopify_shop_domain, shopify_access_token')
      .eq('id', user.id)
      .single();

    if (accountError || !account || !account.shopify_access_token) {
      return NextResponse.json({ error: 'Shopify is not connected' }, { status: 400 });
    }

    const accessToken = decryptShopifyToken(account.shopify_access_token);
    if (!accessToken) {
       return NextResponse.json({ error: 'Invalid Shopify token' }, { status: 400 });
    }

    // Fetch data from Shopify
    const products = await fetchShopifyProducts(account.shopify_shop_domain, accessToken);
    const orders = await fetchShopifyOrders(account.shopify_shop_domain, accessToken);

    // Sync Products
    for (const p of products) {
      await adminClient.from('products').upsert({
        account_id: account.id,
        name: p.title,
        description: p.body_html?.replace(/<[^>]+>/g, '') || '', // strip HTML
        price: p.variants?.[0]?.price || 0,
        stock: p.variants?.[0]?.inventory_quantity || 0,
        category: p.product_type || 'General',
        status: p.status === 'active' ? 'active' : 'draft',
        image_urls: p.images?.map(img => img.src) || [],
        shopify_id: p.id?.toString() || null
      }, { onConflict: 'account_id, shopify_id' });
    }

    // Sync Orders
    let syncedOrders = 0;
    for (const o of orders) {
      if (!o.id) continue;
      // Skip if already synced
      const { data: existing } = await adminClient.from('orders')
        .select('id')
        .eq('account_id', account.id)
        .eq('shopify_order_id', o.id.toString())
        .maybeSingle();
      if (existing) continue;

      await adminClient.from('orders').insert({
        account_id: account.id,
        order_number: o.order_number || o.name || `SH-${o.id}`,
        status: o.financial_status === 'paid' ? 'delivered' : o.fulfillment_status || 'pending',
        total: parseFloat(o.total_price || 0),
        currency: o.currency || 'EGP',
        payment_method: o.gateway || 'shopify',
        payment_status: o.financial_status || 'pending',
        shopify_order_id: o.id.toString(),
        items: (o.line_items || []).map(li => ({
          name: li.title, quantity: li.quantity, price: parseFloat(li.price || 0)
        }))
      });
      syncedOrders++;
    }

    // Register Webhooks
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    await registerShopifyWebhooks(account.shopify_shop_domain, accessToken, appUrl).catch(e => console.error('Webhook reg failed', e));

    return NextResponse.json({ success: true, syncedProducts: products.length, syncedOrders });
  } catch (err) {
    console.error('Shopify Sync Error:', err);
    return NextResponse.json({ error: err.message || 'Unexpected error during sync' }, { status: 500 });
  }
}
