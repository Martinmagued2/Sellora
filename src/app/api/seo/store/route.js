import { NextResponse } from "next/server";

/** GET /api/seo/store?slug=my-store — returns metadata for the storefront */
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: store } = await supabase
      .from("stores")
      .select("name, description, logo_url, whatsapp_number, accounts!inner(business_name, country)")
      .eq("slug", slug)
      .eq("is_published", true)
      .single();

    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

    return NextResponse.json({
      title: `${store.name} — Products & WhatsApp Ordering`,
      description: store.description?.substring(0, 155) || `Shop at ${store.name} and order directly via WhatsApp. Browse products, check prices, and chat with us!`,
      image: store.logo_url || null,
      url: `https://sellorachat.com/store/${slug}`,
      type: "website",
      siteName: "Sellora",
    });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
