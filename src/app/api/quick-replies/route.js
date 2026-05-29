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
        { account_id: user.id, title: "Thanks for your order!", content: "Thanks for your order! 🎉 We're processing it now and will send you a confirmation shortly.", category: "Orders", short_code: "/thanks", is_default: true },
        { account_id: user.id, title: "Shipping takes 2-3 days", content: "Shipping typically takes 2-3 business days. We'll send you a tracking number once your order ships!", category: "Shipping", short_code: "/shipping", is_default: true },
        { account_id: user.id, title: "Our hours are 9AM-9PM", content: "Our business hours are 9AM-9PM daily. We'll get back to you as soon as possible during those hours!", category: "General", short_code: "/hours", is_default: true },
        { account_id: user.id, title: "Let me check and get back to you", content: "Let me check on that for you and get back to you shortly! 👍", category: "General", short_code: "/check", is_default: false },
        { account_id: user.id, title: "Order status update", content: "Hi {name}! Your order {order_number} is currently {status}. Let us know if you have any questions!", category: "Orders", short_code: "/status", is_default: false },
        { account_id: user.id, title: "Return policy", content: "You can return items within 14 days of delivery. Items must be in original condition. Just reply here and we'll help you process the return!", category: "Returns", short_code: "/return", is_default: true },
        { account_id: user.id, title: "Payment received", content: "We've received your payment of {amount} for order {order_number}. Thank you! 🎉", category: "Payment", short_code: "/paid", is_default: true },
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
 * Body: { title, content, category? }
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
    const { title, content, category, short_code, is_default } = body;

    if (!title || !content) {
      return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // If this is set as default, unset any existing default in same category
    if (is_default) {
      await supabase
        .from("quick_replies")
        .update({ is_default: false })
        .eq("account_id", user.id)
        .eq("category", category || "General")
        .eq("is_default", true);
    }

    const { data, error } = await supabase
      .from("quick_replies")
      .insert({
        account_id: user.id,
        title: title.trim(),
        content: content.trim(),
        category: category || "General",
        short_code: short_code?.trim() || null,
        is_default: is_default || false,
      })
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
 * Body: { id, title?, content?, category? }
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
    const { id, title, content, category, short_code, is_default } = body;

    if (!id) {
      return NextResponse.json({ error: "Quick reply ID is required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // If this is set as default, unset any existing default in same category
    if (is_default) {
      await supabase
        .from("quick_replies")
        .update({ is_default: false })
        .eq("account_id", user.id)
        .eq("category", category || "General")
        .eq("is_default", true);
    }

    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (content !== undefined) updates.content = content.trim();
    if (category !== undefined) updates.category = category;
    if (short_code !== undefined) updates.short_code = short_code?.trim() || null;
    if (is_default !== undefined) updates.is_default = is_default;

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
