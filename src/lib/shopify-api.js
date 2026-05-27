export async function fetchShopifyProducts(shopDomain, accessToken) {
  const res = await fetch(`https://${shopDomain}/admin/api/2024-04/products.json`, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Shopify products: ${await res.text()}`);
  }

  const data = await res.json();
  return data.products;
}

export async function fetchShopifyOrders(shopDomain, accessToken) {
  const res = await fetch(`https://${shopDomain}/admin/api/2024-04/orders.json?status=any`, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Shopify orders: ${await res.text()}`);
  }

  const data = await res.json();
  return data.orders;
}

export async function registerShopifyWebhooks(shopDomain, accessToken, appUrl) {
  const webhooks = [
    { topic: 'products/create', address: `${appUrl}/api/integrations/shopify/webhooks` },
    { topic: 'products/update', address: `${appUrl}/api/integrations/shopify/webhooks` },
    { topic: 'products/delete', address: `${appUrl}/api/integrations/shopify/webhooks` },
    { topic: 'orders/create', address: `${appUrl}/api/integrations/shopify/webhooks` },
    { topic: 'orders/updated', address: `${appUrl}/api/integrations/shopify/webhooks` },
    { topic: 'app/uninstalled', address: `${appUrl}/api/integrations/shopify/webhooks` }
  ];

  for (const webhook of webhooks) {
    await fetch(`https://${shopDomain}/admin/api/2024-04/webhooks.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ webhook })
    });
  }
}
