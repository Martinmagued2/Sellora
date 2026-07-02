import { NextResponse } from "next/server";

/** GET /api/seo/blog?slug=xxx — returns metadata for a blog post */
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    if (slug) {
      // Single post metadata
      const { data: post } = await supabase
        .from("blog_posts")
        .select("title, excerpt, cover_image, author, published_at")
        .eq("slug", slug)
        .eq("status", "published")
        .single();

      if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

      return NextResponse.json({
        title: `${post.title} — Sellora Blog`,
        description: post.excerpt?.substring(0, 155) || post.title,
        image: post.cover_image || null,
        url: `https://sellorachat.com/blog/${slug}`,
        type: "article",
        author: post.author || "Sellora Team",
        publishedTime: post.published_at,
      });
    } else {
      // Blog index metadata
      return NextResponse.json({
        title: "Sellora Blog — Guides for MENA Sellers",
        description: "Tips, guides, and stories about selling on WhatsApp, Instagram, and Facebook in Egypt and the MENA region.",
        image: null,
        url: "https://sellorachat.com/blog",
        type: "website",
      });
    }
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
