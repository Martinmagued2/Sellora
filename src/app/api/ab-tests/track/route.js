import { createClient } from "@/lib/supabase/server";

/**
 * POST: Track an event (impression, conversion, revenue) for a variant
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { testId, variantName, eventType, value } = await request.json();

    if (!testId || !variantName || !eventType) {
      return Response.json({ error: "testId, variantName, and eventType are required" }, { status: 400 });
    }

    if (!["impression", "conversion", "revenue"].includes(eventType)) {
      return Response.json({ error: "eventType must be impression, conversion, or revenue" }, { status: 400 });
    }

    // Fetch the test
    const { data: test, error } = await supabase
      .from("ab_tests")
      .select("*")
      .eq("id", testId)
      .eq("account_id", user.id)
      .single();

    if (error) throw error;
    if (!test) return Response.json({ error: "Test not found" }, { status: 404 });
    if (test.status !== "running") {
      return Response.json({ error: "Test is not running" }, { status: 400 });
    }

    // Validate variant exists
    const variantExists = test.variants.some((v) => v.name === variantName);
    if (!variantExists) {
      return Response.json({ error: "Variant not found in test" }, { status: 400 });
    }

    // Update results
    const results = { ...test.results };
    if (!results[variantName]) {
      results[variantName] = { impressions: 0, conversions: 0, revenue: 0 };
    }

    switch (eventType) {
      case "impression":
        results[variantName].impressions += 1;
        break;
      case "conversion":
        results[variantName].conversions += 1;
        break;
      case "revenue":
        results[variantName].revenue += (value || 0);
        break;
    }

    const { data: updated, error: updateError } = await supabase
      .from("ab_tests")
      .update({ results })
      .eq("id", testId)
      .eq("account_id", user.id)
      .select()
      .single();

    if (updateError) throw updateError;

    return Response.json({ test: updated });
  } catch (err) {
    console.error("AB Test track error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
