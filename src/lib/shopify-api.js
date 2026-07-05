function validateShopifyDomain(shopDomain) {
  if (!/^[a-z0-9][a-z0-9\-]*\.myshopify\.com$/i.test(shopDomain)) {
    throw new Error('Invalid Shopify domain format');
  }
}

export async function fetchShopifyProducts(shopDomain, accessToken) {
  validateShopifyDomain(shopDomain);

  const res = await fetch(`https://${shopDomain}/admin/api/2024-04/products.json`, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error('[Shopify] Products fetch failed:', res.status, errBody.substring(0, 200));
    throw new Error(`Failed to fetch Shopify products (status ${res.status})`);
  }

  const data = await res.json();
  return data.products;
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
