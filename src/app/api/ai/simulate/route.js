import { simulateChat } from "@/lib/ai/bot";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isRateLimited } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-logger";
import { getPlanLimits } from "@/lib/plan-limits";

// Admin client for rate limiting (bypasses RLS)
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Daily limit is now plan-aware — see below

export async function POST(req) {
  try {
    // 1. Authenticate user with getUser() (secure server-side validation)
    const cookieStore = await cookies();
    const supabase = createServerClient(
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    const ip = req.headers.get("x-forwarded-for") || "unknown";

    if (authError || !user) {
      // Log unauthorized attempt if suspicious
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1.5 Burst Rate Limiting (10 requests per 10 seconds)
    // Key by user.id with IP fallback
    const rateLimitKey = user?.id || ip;
    if (isRateLimited(rateLimitKey, 10, 10000)) {
      await logSecurityEvent({
        eventType: "rate_limit_hit",
        userId: user?.id,
        ipAddress: ip,
        route: "/api/ai/simulate",
        details: { limit: "10_per_10s" }
      });
      return Response.json({ error: "Too many requests, please slow down." }, { status: 429 });
    }

    // 2. Validate input
    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { messages } = body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "Messages array is required and must not be empty" }, { status: 400 });
    }

    // Validate each message has required fields and reasonable length
    if (messages.length > 15) {
      return Response.json({ error: "Maximum of 15 messages allowed per request to prevent abuse." }, { status: 400 });
    }

    for (const msg of messages) {
      if (!msg.role || !msg.content || typeof msg.content !== "string") {
        return Response.json({ error: "Each message must have a role and content string" }, { status: 400 });
      }
      if (msg.content.length > 1000) {
        return Response.json({ error: "Message content exceeds the maximum allowed length of 1000 characters." }, { status: 400 });
      }
    }

    // 3. Rate limiting — plan-aware daily AI limit
    const { data: accountData } = await adminClient
      .from("accounts")
      .select("plan")
      .eq("id", user.id)
      .single();

    const planLimits = getPlanLimits(accountData?.plan || "starter");
    const maxPerDay = planLimits.ai_simulate_per_day;

    if (maxPerDay !== -1) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await adminClient
        .from("rate_limits")
        .select("*", { count: "exact", head: true })
        .eq("email", user.email)
        .eq("action", "ai_simulate")
        .gte("created_at", oneDayAgo);

      if (count >= maxPerDay) {
        return Response.json(
          { error: `Daily AI limit reached (${maxPerDay} requests). Upgrade your plan for more.`, upgrade: true },
          { status: 429 }
        );
      }
    }

    // Log the request
    await adminClient.from("rate_limits").insert({
      email: user.email,
      action: "ai_simulate",
    });

    // 4. Generate response with timeout (30 seconds)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const aiText = await Promise.race([
        simulateChat(user.id, messages),
        new Promise((_, reject) => {
          controller.signal.addEventListener("abort", () =>
            reject(new Error("AI response timed out after 30 seconds"))
          );
        }),
      ]);

      clearTimeout(timeout);
      return Response.json({ content: aiText });
    } catch (aiError) {
      clearTimeout(timeout);
      if (aiError.message.includes("timed out")) {
        return Response.json({ error: "AI took too long to respond. Please try again." }, { status: 504 });
      }
      throw aiError;
    }

  } catch (error) {
    console.error("Simulation API Error:", error);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
