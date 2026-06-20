/** GET /api/blog — list published blog posts (public) */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

let _admin = null;
function getAdmin() {
  if (!_admin) _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const admin = getAdmin();
    const { data, error } = await admin
      .from("blog_posts")
      .select("id, title, slug, excerpt, cover_image, author, category, tags, published_at, views")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ posts: data || [] });
  } catch (e) { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}
