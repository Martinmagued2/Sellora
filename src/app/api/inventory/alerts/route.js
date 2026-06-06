import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/inventory/alerts — Returns low-stock and out-of-stock products
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch products with stock <= 5 for this user
    const { data: products, error } = await supabase
      .from("products")
      .select("id, name, stock, category, price, image_urls, status, hidden_from_ai")
      .eq("account_id", user.id)
      .lte("stock", 5)
      .order("stock", { ascending: true });

    if (error) {
      console.error("Inventory alerts fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch inventory alerts" }, { status: 500 });
    }

    return NextResponse.json({
      products: products || [],
      out_of_stock: (products || []).filter((p) => p.stock === 0).length,
      low_stock: (products || []).filter((p) => p.stock > 0 && p.stock <= 5).length,
    });
  } catch (err) {
    console.error("Inventory alerts error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/inventory/alerts — Update product stock or hidden_from_ai flag
export async function PATCH(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { product_id, stock, hidden_from_ai } = body;

    if (!product_id) {
      return NextResponse.json({ error: "product_id is required" }, { status: 400 });
    }

    // Verify the product belongs to this user
    const { data: product, error: fetchError } = await supabase
      .from("products")
      .select("id, name, account_id")
      .eq("id", product_id)
      .eq("account_id", user.id)
      .single();

    if (fetchError || !product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Build update payload
    const updates = {};
    if (stock !== undefined) {
      if (typeof stock !== "number" || stock < 0) {
        return NextResponse.json({ error: "Stock must be a non-negative number" }, { status: 400 });
      }
      updates.stock = stock;
    }
    if (hidden_from_ai !== undefined) {
      if (typeof hidden_from_ai !== "boolean") {
        return NextResponse.json({ error: "hidden_from_ai must be a boolean" }, { status: 400 });
      }
      updates.hidden_from_ai = hidden_from_ai;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from("products")
      .update(updates)
      .eq("id", product_id)
      .eq("account_id", user.id);

    if (updateError) {
      console.error("Inventory update error:", updateError);
      return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      product_id,
      ...updates,
    });
  } catch (err) {
    console.error("Inventory update error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
