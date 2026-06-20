import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { decryptShopifyToken } from '@/lib/shopify';

// GET /api/integrations/shopify/diagnose
// Shows exactly what Shopify's API returns for this store — used to debug
// "Synced 0 products" issues. Returns:
//   - shop info (validates token)
//   - product count (validates read_products scope)
//   - first 5 products (validates data)
//   - order count (validates read_orders scope)
//   - raw API responses for transparency

async function shopifyGet(shop, token, path) {
  const res = await fetch(`https://${shop}/admin/api/2024-04/${path}`, {
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
    },
  });
  const body = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(body); } catch {}
  return {
    status: res.status,
    ok: res.ok,
    body: parsed || body.substring(0, 1000),
  };
}

export async function GET(req) {
  const out = { ts: new Date().toISOString() };

  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { getAll() { return cookieStore.getAll(); } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ...out, error: 'Unauthorized' }, { status: 401 });

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: account, error: accountErr } = await adminClient
      .from('accounts')
      .select('id, shopify_shop_domain, shopify_access_token, shopify_installed')
      .eq('id', user.id)
      .maybeSingle();

    if (accountErr || !account) {
      return NextResponse.json({ ...out, error: 'No account row', accountErr }, { status: 500 });
    }

    out.account = {
      hasShop: !!account.shopify_shop_domain,
      shop: account.shopify_shop_domain,
      hasToken: !!account.shopify_access_token,
      tokenPayloadLen: account.shopify_access_token?.length || 0,
      shopifyInstalled: account.shopify_installed,
    };

    if (!account.shopify_shop_domain || !account.shopify_access_token) {
      return NextResponse.json({ ...out, error: 'Shopify not connected' });
    }

    // Decrypt token
    let token;
    try {
      token = decryptShopifyToken(account.shopify_access_token);
      out.tokenDecrypted = true;
    } catch (e) {
      out.tokenDecrypted = false;
      out.decryptError = e.message;
      return NextResponse.json({ ...out, error: 'Token decrypt failed: ' + e.message }, { status: 500 });
    }

    // 1. Shop info — validates token + basic access
    out.shopInfo = await shopifyGet(account.shopify_shop_domain, token, 'shop.json');

    // 2. Product count — validates read_products scope
    out.productCount = await shopifyGet(account.shopify_shop_domain, token, 'products/count.json');

    // 3. First 5 products (any status) — validates data
    // Use the EXACT same query as fetchShopifyProducts so we see what sync sees
    out.productsSample = await shopifyGet(account.shopify_shop_domain, token, 'products.json?limit=250&status=any&published_status=any');

    // 3a. Also try without published_status to prove the difference
    out.productsSampleOldQuery = await shopifyGet(account.shopify_shop_domain, token, 'products.json?limit=5&status=any');

    // 4. Order count — validates read_orders scope
    out.orderCount = await shopifyGet(account.shopify_shop_domain, token, 'orders/count.json?status=any');

    // Diagnostic summary
    const newQueryProducts = Array.isArray(out.productsSample.body?.products) ? out.productsSample.body.products : null;
    const oldQueryProducts = Array.isArray(out.productsSampleOldQuery.body?.products) ? out.productsSampleOldQuery.body.products : null;
    out.summary = {
      tokenValid: out.shopInfo.ok,
      shopName: out.shopInfo.body?.shop?.name || null,
      productCountValue: typeof out.productCount.body === 'number' ? out.productCount.body : (out.productCount.body?.count ?? null),
      orderCountValue: typeof out.orderCount.body === 'number' ? out.orderCount.body : (out.orderCount.body?.count ?? null),
      productsReturnedNewQuery: newQueryProducts?.length ?? null,
      productsReturnedOldQuery: oldQueryProducts?.length ?? null,
      newQueryFixWorked: (newQueryProducts?.length || 0) > (oldQueryProducts?.length || 0),
      productsApiStatus: out.productsSample.status,
      productCountApiStatus: out.productCount.status,
      shopApiStatus: out.shopInfo.status,
      hasReadProductsScope: out.productCount.status === 200,
      hasReadOrdersScope: out.orderCount.status === 200,
    };

    return NextResponse.json(out);
  } catch (e) {
    out.uncaughtError = e?.message;
    return NextResponse.json(out, { status: 500 });
  }
}
