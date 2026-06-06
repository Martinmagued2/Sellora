import { createClient } from "@/lib/supabase/server";

// GET: Get test details and results
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { data, error } = await supabase
      .from("ab_tests")
      .select("*")
      .eq("id", id)
      .eq("account_id", user.id)
      .single();

    if (error) throw error;
    if (!data) return Response.json({ error: "Test not found" }, { status: 404 });

    // Calculate statistical significance
    const significance = calculateSignificance(data);

    return Response.json({ test: data, significance });
  } catch (err) {
    console.error("AB Test GET error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// PATCH: Update test (start/pause/stop)
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!["draft", "running", "paused", "completed"].includes(status)) {
      return Response.json({ error: "Invalid status" }, { status: 400 });
    }

    const updates = { status };

    if (status === "running") {
      updates.started_at = new Date().toISOString();
    }
    if (status === "completed") {
      updates.ended_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("ab_tests")
      .update(updates)
      .eq("id", id)
      .eq("account_id", user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return Response.json({ error: "Test not found" }, { status: 404 });

    return Response.json({ test: data });
  } catch (err) {
    console.error("AB Test PATCH error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Simple statistical significance calculator
 * Uses a basic z-test for comparing two proportions
 */
function calculateSignificance(test) {
  const variants = test.variants || [];
  const results = test.results || {};

  if (variants.length < 2) {
    return { status: "insufficient_variants", message: "Need at least 2 variants" };
  }

  const variantResults = variants.map((v) => ({
    name: v.name,
    impressions: results[v.name]?.impressions || 0,
    conversions: results[v.name]?.conversions || 0,
    revenue: results[v.name]?.revenue || 0,
    rate: results[v.name]?.impressions > 0
      ? (results[v.name]?.conversions / results[v.name]?.impressions) * 100
      : 0,
  }));

  const [a, b] = variantResults;

  // Minimum sample size check
  const minSample = 30;
  if (a.impressions < minSample || b.impressions < minSample) {
    return {
      status: "not_enough_data",
      message: "Not enough data",
      confidence: 0,
      variantResults,
      winner: null,
    };
  }

  // Z-test for two proportions
  const p1 = a.conversions / a.impressions;
  const p2 = b.conversions / b.impressions;
  const p = (a.conversions + b.conversions) / (a.impressions + b.impressions);
  const se = Math.sqrt(p * (1 - p) * (1 / a.impressions + 1 / b.impressions));

  if (se === 0) {
    return {
      status: "equal",
      message: "Both variants performing equally",
      confidence: 0,
      variantResults,
      winner: null,
    };
  }

  const z = Math.abs(p1 - p2) / se;

  // Z-score to confidence level (approximate)
  let confidence = 0;
  if (z >= 2.576) confidence = 99;
  else if (z >= 2.326) confidence = 98;
  else if (z >= 1.96) confidence = 95;
  else if (z >= 1.645) confidence = 90;
  else if (z >= 1.28) confidence = 80;

  const winner = p1 > p2 ? a.name : p2 > p1 ? b.name : null;

  if (confidence >= 95) {
    return {
      status: "significant",
      message: "Statistically significant",
      confidence,
      variantResults,
      winner,
    };
  } else if (confidence >= 80) {
    return {
      status: "trending",
      message: `Variant ${winner || "??"} is winning`,
      confidence,
      variantResults,
      winner,
    };
  } else {
    return {
      status: "inconclusive",
      message: "Not enough data to determine winner",
      confidence,
      variantResults,
      winner: null,
    };
  }
}
