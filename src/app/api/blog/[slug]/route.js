/** GET /api/blog/[slug] — get a single blog post by slug (public) */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

let _admin = null;
function getAdmin() {
  if (!_admin) _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

export async function GET(req, { params }) {
  try {
    const { slug } = await params;
    const admin = getAdmin();
    const { data, error } = await admin
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .single();

    if (error || !data) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    // Increment views (best-effort, non-blocking)
    admin.from("blog_posts").update({ views: (data.views || 0) + 1 }).eq("id", data.id).then(() => {});

    return NextResponse.json({ post: data });
  } catch (e) { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}
