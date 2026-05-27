import { streamText } from "ai";
import { groq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createCopilotTools } from "@/lib/ai/copilot-tools";
import { getPlanLimits } from "@/lib/plan-limits";
import { createClient } from "@supabase/supabase-js";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
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
    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const { data: account } = await adminClient
      .from("accounts")
      .select("plan, business_name")
      .eq("id", user.id)
      .single();

    const planLimits = getPlanLimits(account?.plan || "starter");
    const maxMsgs = planLimits.copilot_msgs_per_day;

    if (maxMsgs === 0) {
      return Response.json({ error: "Copilot is not available on your current plan. Please upgrade." }, { status: 403 });
    }

    // Basic rate limit check (skip in development)
    if (maxMsgs !== -1 && process.env.NODE_ENV === "production") {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await adminClient
        .from("rate_limits")
        .select("*", { count: "exact", head: true })
        .eq("email", user.email)
        .eq("action", "copilot_msg")
        .gte("created_at", oneDayAgo);

      if (count >= maxMsgs) {
        return Response.json({ error: "Daily Copilot limit reached. Upgrade for more." }, { status: 429 });
      }
    }

    // Only log rate limits in production
    if (process.env.NODE_ENV === "production") {
      await adminClient.from("rate_limits").insert({
        email: user.email,
        action: "copilot_msg",
      });
    }

    const { messages } = body;
    const coreMessages = (messages || []).map((msg) => {
      let content = "";
      if (msg.parts && Array.isArray(msg.parts)) {
        content = msg.parts
          .filter((p) => p.type === "text")
          .map((p) => p.text)
          .join("");
      }
      if (!content && typeof msg.content === "string") {
        content = msg.content;
      }
      return {
        role: msg.role === "user" ? "user" : "assistant",
        content: content || "",
      };
    });

    const systemPrompt = `You are Sellora Copilot, a helpful AI assistant for the owner of "${account?.business_name || 'this store'}". 
Your job is to help them analyze their store data, write product descriptions, and manage their business. 
You can use tools to fetch live data about their store. Be concise, professional, and use markdown formatting.`;

    let model;
    if (process.env.VECTORENGINE_API_KEY) {
      const customOpenAI = createOpenAI({
        apiKey: process.env.VECTORENGINE_API_KEY,
        baseURL: process.env.VECTORENGINE_BASE_URL || "https://api.vectorengine.ai/v1",
        compatibility: "compatible",
      });
      model = customOpenAI("gpt-5.5-pro");
    } else if (process.env.GROQ_API_KEY) {
      model = groq("meta-llama/llama-4-scout-17b-16e-instruct");
    } else if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      const google = createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      });
      model = google("gemini-1.5-flash");
    } else {
      return Response.json({ error: "AI is not configured. Please add VECTORENGINE_API_KEY, GROQ_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY to your .env.local file." }, { status: 500 });
    }

    const tools = createCopilotTools(user.id);
    const providerModels = [];

    if (process.env.VECTORENGINE_API_KEY) {
      const customOpenAI = createOpenAI({
        apiKey: process.env.VECTORENGINE_API_KEY,
        baseURL: process.env.VECTORENGINE_BASE_URL || "https://api.vectorengine.ai/v1",
        compatibility: "compatible",
      });
      providerModels.push({ name: 'vectorengine', model: customOpenAI('gpt-5.5-pro') });
    }

    if (process.env.GROQ_API_KEY) {
      providerModels.push({ name: 'groq', model: groq('meta-llama/llama-4-scout-17b-16e-instruct') });
    }

    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
      providerModels.push({ name: 'google', model: google('gemini-1.5-flash') });
    }

    if (process.env.OPENAI_API_KEY) {
      const { openai } = await import('@ai-sdk/openai');
      providerModels.push({ name: 'openai', model: openai('gpt-4o-mini') });
    }

    if (providerModels.length === 0) {
      return Response.json({ error: 'AI is not configured. Please add GROQ_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or OPENAI_API_KEY to your .env.local file.' }, { status: 500 });
    }

    let lastError = null;
    for (const providerEntry of providerModels) {
      try {
        const result = await streamText({
          model: providerEntry.model,
          maxSteps: 5,
          temperature: 0.2,
          system: systemPrompt,
          messages: coreMessages,
          tools,
        });
        return result.toUIMessageStreamResponse();
      } catch (providerError) {
        lastError = providerError;
        console.warn(`Copilot provider ${providerEntry.name} failed:`, providerError?.message || providerError);
      }
    }

    console.error('Copilot API Error: all providers failed', lastError);
    return Response.json({ error: lastError?.message || 'Something went wrong with all AI providers.' }, { status: 500 });
  } catch (error) {
    console.error("Copilot API Error:", error);
    return Response.json({ error: error.message || "Something went wrong." }, { status: 500 });
  }
}
