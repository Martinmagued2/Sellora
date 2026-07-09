import { NextResponse } from "next/server";
import { getServiceRoleClient, getAuthUser } from "@/lib/auth-helper";

/**
 * GET /api/faqs - List FAQs for the authenticated user's account
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
      .from("faqs")
      .select("*")
      .eq("account_id", user.id)
      .order("created_at", { ascending: false });

    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Failed to fetch FAQs" }, { status: 500 });
    }

    return NextResponse.json({ success: true, faqs: data || [] });
  } catch (error) {
    console.error("FAQs GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/faqs - Create a new FAQ entry
 */
export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { question, answer, category, is_active } = body;

    if (!question || !answer) {
      return NextResponse.json({ error: "Question and answer are required" }, { status: 400 });
    }

    const supabase = getServiceRoleClient();
    const { data, error } = await supabase
      .from("faqs")
      .insert({
        account_id: user.id,
        question,
        answer,
        category: category || "General",
        is_active: is_active !== undefined ? is_active : true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to create FAQ: " + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, faq: data });
  } catch (error) {
    console.error("FAQs POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/faqs - Update an existing FAQ entry
 */
export async function PUT(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, question, answer, category, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: "FAQ ID is required" }, { status: 400 });
    }

    const supabase = getServiceRoleClient();
    const updates = {};
    if (question !== undefined) updates.question = question;
    if (answer !== undefined) updates.answer = answer;
    if (category !== undefined) updates.category = category;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data, error } = await supabase
      .from("faqs")
      .update(updates)
      .eq("id", id)
      .eq("account_id", user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to update FAQ" }, { status: 500 });
    }

    return NextResponse.json({ success: true, faq: data });
  } catch (error) {
    console.error("FAQs PUT error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/faqs - Delete an FAQ entry
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
      return NextResponse.json({ error: "FAQ ID is required" }, { status: 400 });
    }

    const supabase = getServiceRoleClient();
    const { error } = await supabase
      .from("faqs")
      .delete()
      .eq("id", id)
      .eq("account_id", user.id);

    if (error) {
      console.error("[FAQs DELETE] Supabase error:", error.message);
      return NextResponse.json({ error: "Failed to delete FAQ" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("FAQs DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
