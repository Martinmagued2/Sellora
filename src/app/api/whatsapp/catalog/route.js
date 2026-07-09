import { createClient } from "@/lib/supabase/server";

const WHATSAPP_API_URL = "https://graph.facebook.com/v21.0";

// GET: Get current WhatsApp catalog status and product count
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get account WhatsApp config
    const { data: account } = await supabase
      .from("accounts")
      .select("whatsapp_catalog_id, whatsapp_access_token, whatsapp_catalog_sync_enabled, whatsapp_catalog_last_sync, business_name, currency")
      .eq("id", user.id)
      .single();

    const catalogId = account?.whatsapp_catalog_id;
    const accessToken = account?.whatsapp_access_token;
    const isConnected = !!(catalogId && accessToken);

    // Get active products count
    const { count: productCount } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("account_id", user.id)
      .eq("status", "active");

    // If connected, try to get catalog product count from WhatsApp
    let catalogProductCount = 0;
    if (isConnected) {
      try {
        const response = await fetch(
          `${WHATSAPP_API_URL}/${catalogId}/products?limit=100`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(10000),
          }
        );
        if (response.ok) {
          const data = await response.json();
          catalogProductCount = data.data?.length || 0;
        }
      } catch (e) {
        console.warn("Failed to fetch WhatsApp catalog products:", e.message);
      }
    }

    return Response.json({
      connected: isConnected,
      catalogId,
      syncEnabled: account?.whatsapp_catalog_sync_enabled || false,
      lastSync: account?.whatsapp_catalog_last_sync || null,
      localProductCount: productCount || 0,
      catalogProductCount,
    });
  } catch (err) {
    console.error("WhatsApp Catalog GET error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// POST: Sync all active products to WhatsApp catalog
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("whatsapp_catalog_id, whatsapp_access_token, business_name, currency")
      .eq("id", user.id)
      .single();

    const catalogId = account?.whatsapp_catalog_id;
    const accessToken = account?.whatsapp_access_token;

    if (!catalogId || !accessToken) {
      return Response.json({ error: "WhatsApp catalog not configured. Please set your catalog ID and access token in settings." }, { status: 400 });
    }

    // Fetch all active products
    const { data: products, error } = await supabase
      .from("products")
      .select("id, name, description, price, category, image_url")
      .eq("account_id", user.id)
      .eq("status", "active");

    if (error) throw error;

    const results = { synced: 0, failed: 0, errors: [] };
    const currency = account?.currency || "EGP";

    for (const product of products || []) {
      try {
        const payload = {
          name: product.name,
          description: product.description || `${product.name} - ${product.category || "General"}`,
          price: Math.round(product.price * 100), // WhatsApp expects price in cents
          currency,
          url: `${process.env.NEXT_PUBLIC_APP_URL || "https://sellora.com"}/product/${product.id}`,
          image_url: product.image_url || undefined,
          availability: "in stock",
          retailer_id: product.id,
        };

        const response = await fetch(
          `${WHATSAPP_API_URL}/${catalogId}/products`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15000),
          }
        );

        if (response.ok) {
          results.synced++;
        } else {
          const errData = await response.json().catch(() => ({}));
          // If product already exists, try updating
          if (errData.error?.code === 100 || response.status === 400) {
            try {
              const updateResp = await fetch(
                `${WHATSAPP_API_URL}/${catalogId}/products`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                  },
                  body: JSON.stringify({ ...payload, retailer_id: product.id }),
                  signal: AbortSignal.timeout(15000),
                }
              );
              if (updateResp.ok) {
                results.synced++;
              } else {
                results.failed++;
                results.errors.push({ product: product.name, error: "Failed to update" });
              }
            } catch {
              results.failed++;
              results.errors.push({ product: product.name, error: "Update timeout" });
            }
          } else {
            results.failed++;
            results.errors.push({ product: product.name, error: errData.error?.message || "Unknown error" });
          }
        }
      } catch (e) {
        results.failed++;
        results.errors.push({ product: product.name, error: e.message });
      }
    }

    // Update last sync time
    await supabase
      .from("accounts")
      .update({ whatsapp_catalog_last_sync: new Date().toISOString() })
      .eq("id", user.id);

    return Response.json({
      success: true,
      total: products?.length || 0,
      ...results,
    });
  } catch (err) {
    console.error("WhatsApp Catalog sync error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Remove all products from WhatsApp catalog
export async function DELETE(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("whatsapp_catalog_id, whatsapp_access_token")
      .eq("id", user.id)
      .single();

    const catalogId = account?.whatsapp_catalog_id;
    const accessToken = account?.whatsapp_access_token;

    if (!catalogId || !accessToken) {
      return Response.json({ error: "WhatsApp catalog not configured" }, { status: 400 });
    }

    // Fetch all catalog products
    const response = await fetch(
      `${WHATSAPP_API_URL}/${catalogId}/products?limit=100`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch catalog products");
    }

    const data = await response.json();
    const products = data.data || [];

    let deleted = 0;
    let failed = 0;

    for (const product of products) {
      try {
        const delResp = await fetch(
          `${WHATSAPP_API_URL}/${product.id}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(10000),
          }
        );
        if (delResp.ok) deleted++;
        else failed++;
      } catch {
        failed++;
      }
    }

    return Response.json({
      success: true,
      deleted,
      failed,
      total: products.length,
    });
  } catch (err) {
    console.error("WhatsApp Catalog DELETE error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
