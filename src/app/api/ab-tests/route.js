import { createClient } from "@/lib/supabase/server";

// GET: List all A/B tests for the user
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("ab_tests")
      .select("*")
      .eq("account_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return Response.json({ tests: data || [] });
  } catch (err) {
    console.error("AB Tests GET error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// POST: Create a new A/B test
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, metric, variants } = body;

    if (!name || !variants || variants.length < 2) {
      return Response.json({ error: "Name and at least 2 variants are required" }, { status: 400 });
    }

    // Validate variant weights sum to 100
    const totalWeight = variants.reduce((sum, v) => sum + (v.weight || 0), 0);
    if (totalWeight !== 100) {
      return Response.json({ error: "Variant weights must sum to 100" }, { status: 400 });
    }

    // Initialize results object
    const results = {};
    variants.forEach((v) => {
      results[v.name] = { impressions: 0, conversions: 0, revenue: 0 };
    });

    const { data, error } = await supabase
      .from("ab_tests")
      .insert({
        account_id: user.id,
        name,
        description: description || null,
        metric: metric || "conversion",
        variants,
        results,
        status: "draft",
      })
      .select()
      .single();

    if (error) throw error;

    return Response.json({ test: data });
  } catch (err) {
    console.error("AB Tests POST error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
