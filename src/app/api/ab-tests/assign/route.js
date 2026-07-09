import { createClient } from "@/lib/supabase/server";

/**
 * POST: Assign a customer to a variant
 * Uses consistent hashing (customer_id → variant) so same customer always gets same variant
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { testId, customerId } = await request.json();

    if (!testId || !customerId) {
      return Response.json({ error: "testId and customerId are required" }, { status: 400 });
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

    // Consistent hash: customer_id + test_id → number between 0-99
    const hashInput = `${customerId}:${testId}`;
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    const bucket = Math.abs(hash) % 100;

    // Determine which variant this bucket falls into
    let cumulative = 0;
    let assignedVariant = test.variants[0]; // default to first

    for (const variant of test.variants) {
      cumulative += variant.weight || 0;
      if (bucket < cumulative) {
        assignedVariant = variant;
        break;
      }
    }

    return Response.json({
      variant: assignedVariant,
      testName: test.name,
      testId: test.id,
    });
  } catch (err) {
    console.error("AB Test assign error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
