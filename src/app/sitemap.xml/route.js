import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const baseUrl = "https://sellora-ruby.vercel.app";
    const now = new Date().toISOString();

    const staticPages = [
      { url: "/", priority: "1.0", changefreq: "daily" },
      { url: "/login", priority: "0.8", changefreq: "monthly" },
      { url: "/signup", priority: "0.9", changefreq: "monthly" },
      { url: "/help", priority: "0.7", changefreq: "weekly" },
      { url: "/blog", priority: "0.8", changefreq: "daily" },
      { url: "/affiliates", priority: "0.6", changefreq: "monthly" },
    ];

    const { data: stores } = await supabase
      .from("stores").select("slug, updated_at")
      .eq("is_published", true).eq("is_active", true);

    const storePages = (stores || []).map(s => ({
      url: `/store/${s.slug}`, priority: "0.9", changefreq: "daily", lastmod: s.updated_at,
    }));

    const { data: posts } = await supabase
      .from("blog_posts").select("slug, published_at")
      .eq("status", "published").order("published_at", { ascending: false });

    const blogPages = (posts || []).map(p => ({
      url: `/blog/${p.slug}`, priority: "0.7", changefreq: "weekly", lastmod: p.published_at,
    }));

    const allPages = [...staticPages, ...storePages, ...blogPages];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(p => `  <url>
    <loc>${baseUrl}${p.url}</loc>
    <lastmod>${p.lastmod || now}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join("\n")}
</urlset>`;

    return new NextResponse(xml, {
      headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600, s-maxage=3600" },
    });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
