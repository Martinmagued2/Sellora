export function validateShopifyDomain(shopDomain) {
  if (!/^[a-z0-9][a-z0-9\-]*\.myshopify\.com$/i.test(shopDomain)) {
    throw new Error('Invalid Shopify domain format');
  }
}

export async function fetchShopifyProducts(shopDomain, accessToken) {
  validateShopifyDomain(shopDomain);

  // Shopify's `status=any` parameter is buggy on dev stores — it silently
  // returns [] even when count.json reports 2 products. The fix: fetch each
  // status individually (active, draft, archived) and combine the results.
  // This is a documented Shopify REST API quirk.
  const STATUSES = ['active', 'draft', 'archived'];
  const allProducts = [];

  for (const status of STATUSES) {
    // Paginate up to 250 products per status (Shopify's max page size)
    let pageInfo = null;
    let safety = 0;
    while (safety++ < 20) {
      const url = new URL(`https://${shopDomain}/admin/api/2024-04/products.json`);
      url.searchParams.set('limit', '250');
      url.searchParams.set('status', status);
      url.searchParams.set('published_status', 'any');
      if (pageInfo) url.searchParams.set('page_info', pageInfo);

      const res = await fetch(url.toString(), {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error(`[Shopify] Products fetch failed (status=${status}):`, res.status, errBody.substring(0, 200));
        throw new Error(`Failed to fetch Shopify products (status ${res.status})`);
      }

      const data = await res.json();
      if (Array.isArray(data.products)) {
        allProducts.push(...data.products);
      }

      // Follow Link header for pagination (Shopify uses cursor-based pagination)
      const linkHeader = res.headers.get('link') || '';
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      if (nextMatch) {
        // Extract page_info from the next URL
        const nextUrl = new URL(nextMatch[1]);
        pageInfo = nextUrl.searchParams.get('page_info');
      } else {
        break;
      }
    }
  }

  // Dedupe by product ID (a product shouldn't appear in multiple statuses, but just in case)
  const seen = new Set();
  const deduped = allProducts.filter(p => {
    const id = String(p.id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  return deduped;
}

export async function fetchShopifyOrders(shopDomain, accessToken) {
  validateShopifyDomain(shopDomain);

  const res = await fetch(`https://${shopDomain}/admin/api/2024-04/orders.json?status=any`, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error('[Shopify] Orders fetch failed:', res.status, errBody.substring(0, 200));
    throw new Error(`Failed to fetch Shopify orders (status ${res.status})`);
  }

  const data = await res.json();
  return data.orders;
}

export async function registerShopifyWebhooks(shopDomain, accessToken, appUrl) {
  validateShopifyDomain(shopDomain);

  const webhooks = [
    { topic: 'products/create', address: `${appUrl}/api/integrations/shopify/webhooks` },
    { topic: 'products/update', address: `${appUrl}/api/integrations/shopify/webhooks` },
    { topic: 'products/delete', address: `${appUrl}/api/integrations/shopify/webhooks` },
    { topic: 'orders/create', address: `${appUrl}/api/integrations/shopify/webhooks` },
    { topic: 'orders/updated', address: `${appUrl}/api/integrations/shopify/webhooks` },
    { topic: 'app/uninstalled', address: `${appUrl}/api/integrations/shopify/webhooks` }
  ];

  for (const webhook of webhooks) {
    const regRes = await fetch(`https://${shopDomain}/admin/api/2024-04/webhooks.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ webhook })
    });
    if (!regRes.ok) {
      console.error(`[Shopify] Failed to register webhook ${webhook.topic}:`, regRes.status);
    }
  }
}
