import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Service role client (lazy-initialized)
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabase;
}

/**
 * GET /api/quick-replies - List quick replies for the authenticated user
 */
export async function GET(req) {
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    let query = supabase
      .from("quick_replies")
      .select("*")
      .eq("account_id", user.id)
      .order("created_at", { ascending: true });

    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Failed to fetch quick replies" }, { status: 500 });
    }

    // If no quick replies exist, seed with defaults
    if (!data || data.length === 0) {
      const defaults = [
        { account_id: user.id, title: "Thanks for your order!", content: "Thanks for your order! 🎉 We're processing it now and will send you a confirmation shortly.", category: "Orders" },
        { account_id: user.id, title: "Shipping takes 2-3 days", content: "Shipping typically takes 2-3 business days. We'll send you a tracking number once your order ships!", category: "Shipping" },
        { account_id: user.id, title: "Our hours are 9AM-9PM", content: "Our business hours are 9AM-9PM daily. We'll get back to you as soon as possible during those hours!", category: "General" },
        { account_id: user.id, title: "Let me check and get back to you", content: "Let me check on that for you and get back to you shortly! 👍", category: "General" },
      ];

      const { data: seeded, error: seedError } = await supabase
        .from("quick_replies")
        .insert(defaults)
        .select();

      if (!seedError && seeded) {
        return NextResponse.json({ success: true, quickReplies: seeded });
      }
    }

    return NextResponse.json({ success: true, quickReplies: data || [] });
  } catch (error) {
    console.error("Quick replies GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/quick-replies - Create a new quick reply
 * Body: { title, content, category?, shortcut? }
 */
export async function POST(req) {
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, content, category, shortcut } = body;

    if (!title || !content) {
      return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
    }

    const supabase = getSupabase();
    const insertData = {
      account_id: user.id,
      title: title.trim(),
      content: content.trim(),
      category: category || "General",
    };
    if (shortcut) insertData.shortcut = shortcut.trim().replace(/^\/+/, '');

    const { data, error } = await supabase
      .from("quick_replies")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to create quick reply: " + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, quickReply: data });
  } catch (error) {
    console.error("Quick replies POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/quick-replies - Update a quick reply
 * Body: { id, title?, content?, category?, shortcut? }
 */
export async function PUT(req) {
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, title, content, category, shortcut } = body;

    if (!id) {
      return NextResponse.json({ error: "Quick reply ID is required" }, { status: 400 });
    }

    const supabase = getSupabase();
    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (content !== undefined) updates.content = content.trim();
    if (category !== undefined) updates.category = category;
    if (shortcut !== undefined) updates.shortcut = shortcut ? shortcut.trim().replace(/^\/+/, '') : null;

    const { data, error } = await supabase
      .from("quick_replies")
      .update(updates)
      .eq("id", id)
      .eq("account_id", user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to update quick reply" }, { status: 500 });
    }

    return NextResponse.json({ success: true, quickReply: data });
  } catch (error) {
    console.error("Quick replies PUT error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/quick-replies - Delete a quick reply
 * Query: ?id=<quick_reply_id>
 */
export async function DELETE(req) {
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Quick reply ID is required" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from("quick_replies")
      .delete()
      .eq("id", id)
      .eq("account_id", user.id);

    if (error) {
      return NextResponse.json({ error: "Failed to delete quick reply" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Quick replies DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
