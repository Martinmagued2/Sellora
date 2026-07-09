import { createClient } from "@/lib/supabase/server";

const WHATSAPP_API_URL = "https://graph.facebook.com/v21.0";

// POST: Add/update a single product in WhatsApp catalog
export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { productId } = await params;
    const { data: account } = await supabase
      .from("accounts")
      .select("whatsapp_catalog_id, whatsapp_access_token, currency")
      .eq("id", user.id)
      .single();

    const catalogId = account?.whatsapp_catalog_id;
    const accessToken = account?.whatsapp_access_token;

    if (!catalogId || !accessToken) {
      return Response.json({ error: "WhatsApp catalog not configured" }, { status: 400 });
    }

    // Fetch the product
    const { data: product, error } = await supabase
      .from("products")
      .select("id, name, description, price, category, image_url")
      .eq("id", productId)
      .eq("account_id", user.id)
      .single();

    if (error || !product) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }

    const payload = {
      name: product.name,
      description: product.description || `${product.name} - ${product.category || "General"}`,
      price: Math.round(product.price * 100),
      currency: account?.currency || "EGP",
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

    const data = await response.json();

    if (!response.ok) {
      return Response.json({ error: data.error?.message || "Failed to sync product" }, { status: 400 });
    }

    return Response.json({ success: true, whatsappProductId: data.id });
  } catch (err) {
    console.error("WhatsApp Catalog product POST error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Remove a single product from WhatsApp catalog
export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { productId } = await params;
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

    // Find the product in WhatsApp catalog by retailer_id
    const listResponse = await fetch(
      `${WHATSAPP_API_URL}/${catalogId}/products?limit=100`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!listResponse.ok) {
      return Response.json({ error: "Failed to list catalog products" }, { status: 400 });
    }

    const listData = await listResponse.json();
    const catalogProduct = (listData.data || []).find(
      (p) => p.retailer_id === productId
    );

    if (!catalogProduct) {
      return Response.json({ error: "Product not found in WhatsApp catalog" }, { status: 404 });
    }

    const delResponse = await fetch(
      `${WHATSAPP_API_URL}/${catalogProduct.id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!delResponse.ok) {
      return Response.json({ error: "Failed to delete product from catalog" }, { status: 400 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("WhatsApp Catalog product DELETE error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
