import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { decryptShopifyToken } from '@/lib/shopify';
import { fetchShopifyProducts, fetchShopifyOrders, registerShopifyWebhooks } from '@/lib/shopify-api';

export async function POST(req) {
  const log = []; // diagnostic log, returned in the response so the toast can show real cause

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

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Get account info
    const { data: account, error: accountError } = await adminClient
      .from('accounts')
      .select('id, shopify_shop_domain, shopify_access_token, shopify_installed')
      .eq('id', user.id)
      .maybeSingle();

    if (accountError) {
      console.error('[shopify/sync] account select error:', accountError);
      return NextResponse.json(
        { error: 'Failed to load account: ' + (accountError.message || 'unknown'), log },
        { status: 500 }
      );
    }

    if (!account) {
      return NextResponse.json(
        { error: 'No account found for your user. Please contact support.', log },
        { status: 404 }
      );
    }

    if (!account.shopify_installed || !account.shopify_shop_domain || !account.shopify_access_token) {
      return NextResponse.json(
        { error: 'Shopify is not connected. Click Connect first.', log },
        { status: 400 }
      );
    }

    log.push(`shop=${account.shopify_shop_domain} token_len=${account.shopify_access_token.length}`);

    // 2. Decrypt the stored token — this is the most common failure point.
    let accessToken;
    try {
      accessToken = decryptShopifyToken(account.shopify_access_token);
    } catch (decryptErr) {
      console.error('[shopify/sync] token decrypt failed:', decryptErr);
      return NextResponse.json({
        error: 'Shopify access token could not be decrypted. This usually means SHOPIFY_API_SECRET (or SHOPIFY_TOKEN_ENCRYPTION_KEY) changed since you connected. Disconnect Shopify and reconnect.',
        log: [...log, `decrypt_error: ${decryptErr.message}`],
      }, { status: 500 });
    }

    if (!accessToken) {
      return NextResponse.json({
        error: 'No Shopify access token found. Disconnect and reconnect Shopify.',
        log,
      }, { status: 400 });
    }

    log.push('token_decrypted=ok');

    // 3. Fetch products from Shopify
    let products = [];
    try {
      products = await fetchShopifyProducts(account.shopify_shop_domain, accessToken);
      log.push(`products_fetched=${products.length}`);
    } catch (e) {
      console.error('[shopify/sync] products fetch failed:', e);
      return NextResponse.json({
        error: `Shopify rejected the product sync: ${e.message}. If this says "status 403", your Shopify app is missing the read_products scope — fix that in your Shopify Partner Dashboard → Apps → Sellora → API access.`,
        log: [...log, `products_error: ${e.message}`],
      }, { status: 502 });
    }

    // 4. Fetch orders from Shopify
    let orders = [];
    try {
      orders = await fetchShopifyOrders(account.shopify_shop_domain, accessToken);
      log.push(`orders_fetched=${orders.length}`);
    } catch (e) {
      console.error('[shopify/sync] orders fetch failed:', e);
      // Don't hard-fail if only orders fail — products are the priority
      log.push(`orders_error: ${e.message}`);
    }

    // 5. Sync products
    let syncedProducts = 0;
    let productErrors = 0;
    for (const p of products) {
      try {
        await adminClient.from('products').upsert({
          account_id: account.id,
          name: p.title,
          description: p.body_html?.replace(/<[^>]+>/g, '') || '',
          price: p.variants?.[0]?.price || 0,
          stock: p.variants?.[0]?.inventory_quantity || 0,
          category: p.product_type || 'General',
          status: p.status === 'active' ? 'active' : 'draft',
          image_urls: p.images?.map(img => img.src) || [],
          shopify_id: p.id?.toString() || null
        }, { onConflict: 'account_id, shopify_id' });
        syncedProducts++;
      } catch (e) {
        productErrors++;
        if (productErrors <= 3) console.error('[shopify/sync] product upsert failed:', e.message);
      }
    }
    log.push(`products_synced=${syncedProducts}/${products.length} errors=${productErrors}`);

    // 6. Sync orders
    let syncedOrders = 0;
    for (const o of orders) {
      if (!o.id) continue;
      const { data: existing } = await adminClient.from('orders')
        .select('id')
        .eq('account_id', account.id)
        .eq('shopify_order_id', o.id.toString())
        .maybeSingle();
      if (existing) continue;

      try {
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
      } catch (e) {
        console.error('[shopify/sync] order insert failed:', e.message);
      }
    }
    log.push(`orders_synced=${syncedOrders}/${orders.length}`);

    // 7. Register webhooks (best-effort, never blocks sync)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    await registerShopifyWebhooks(account.shopify_shop_domain, accessToken, appUrl)
      .catch(e => console.warn('[shopify/sync] webhook reg failed:', e.message));

    return NextResponse.json({
      success: true,
      syncedProducts,
      syncedOrders,
      log,
    });
  } catch (err) {
    console.error('[shopify/sync] uncaught:', err);
    return NextResponse.json(
      { error: err?.message || 'Unexpected error during sync', log },
      { status: 500 }
    );
  }
}
