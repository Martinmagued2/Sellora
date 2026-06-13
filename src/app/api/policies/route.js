import { NextResponse } from "next/server";
import { getServiceRoleClient, getAuthUser } from "@/lib/auth-helper";

const VALID_CATEGORIES = [
  "Returns & Refunds",
  "Shipping & Delivery",
  "Exchange",
  "Payment",
  "Privacy",
  "Terms of Service",
  "Warranty",
  "Cancellation",
  "General",
];

/**
 * GET /api/policies - List business policies for the authenticated user
 */
export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServiceRoleClient();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    let query = supabase
      .from("business_policies")
      .select("*")
      .eq("account_id", user.id)
      .order("sort_order", { ascending: true });

    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Failed to fetch policies" }, { status: 500 });
    }

    return NextResponse.json({ success: true, policies: data || [] });
  } catch (error) {
    console.error("Policies GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/policies - Create a new business policy
 */
export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, content, category, is_active, sort_order } = body;

    if (!title || !content) {
      return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
    }

    const finalCategory = category || "General";
    if (!VALID_CATEGORIES.includes(finalCategory)) {
      return NextResponse.json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` }, { status: 400 });
    }

    const supabase = getServiceRoleClient();
    const { data, error } = await supabase
      .from("business_policies")
      .insert({
        account_id: user.id,
        title,
        content,
        category: finalCategory,
        is_active: is_active !== undefined ? is_active : true,
        sort_order: sort_order || 0,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to create policy: " + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, policy: data });
  } catch (error) {
    console.error("Policies POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/policies - Update an existing business policy
 */
export async function PUT(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, title, content, category, is_active, sort_order } = body;

    if (!id) {
      return NextResponse.json({ error: "Policy ID is required" }, { status: 400 });
    }

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (category !== undefined) {
      if (!VALID_CATEGORIES.includes(category)) {
        return NextResponse.json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` }, { status: 400 });
      }
      updates.category = category;
    }
    if (is_active !== undefined) updates.is_active = is_active;
    if (sort_order !== undefined) updates.sort_order = sort_order;

    const supabase = getServiceRoleClient();
    const { data, error } = await supabase
      .from("business_policies")
      .update(updates)
      .eq("id", id)
      .eq("account_id", user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to update policy" }, { status: 500 });
    }

    return NextResponse.json({ success: true, policy: data });
  } catch (error) {
    console.error("Policies PUT error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/policies - Delete a business policy
 */
export async function DELETE(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Policy ID is required" }, { status: 400 });
    }

    const supabase = getServiceRoleClient();
    const { error } = await supabase
      .from("business_policies")
      .delete()
      .eq("id", id)
      .eq("account_id", user.id);

    if (error) {
      return NextResponse.json({ error: "Failed to delete policy" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Policies DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
