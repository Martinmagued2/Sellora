import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { groq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { getAIModelForPlan } from "@/lib/plan-limits";
import { createOpenAI } from "@ai-sdk/openai";
import { routeMessage } from "./router";
import { createSalesTools, createSupportTools } from "./tools";
import { getSalesAgentPrompt, getSupportAgentPrompt, getOrderTrackerAgentPrompt } from "./agents";

const google = process.env.GOOGLE_GENERATIVE_AI_API_KEY 
  ? createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })
  : null;

// Init Supabase with Service Role to bypass RLS for internal API calls
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Dynamically imports and returns the correct AI SDK model instance
 * based on the account's subscription plan.
 */
async function getModelInstance(plan) {
  if (process.env.VECTORENGINE_API_KEY) {
    const customOpenAI = createOpenAI({
      apiKey: process.env.VECTORENGINE_API_KEY,
      baseURL: process.env.VECTORENGINE_BASE_URL || "https://api.vectorengine.ai/v1",
      compatibility: "compatible",
    });
    return customOpenAI("gpt-5.5-pro");
  }

  // Fallback to older ones if needed
  if (process.env.GROQ_API_KEY) return groq("meta-llama/llama-4-scout-17b-16e-instruct");
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY && google) return google("gemini-1.5-flash");
  throw new Error("No AI provider configured");
}

/**
 * Handles a simulated chat with plan-aware model selection and agent routing.
 */
export async function simulateChat(accountId, messages) {
  if (!process.env.GROQ_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.OPENAI_API_KEY) {
    return "AI is not configured yet. Please add your API keys in settings.";
  }

  try {
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("business_name, ai_personality, country, plan")
      .eq("id", accountId)
      .single();

    if (accountError || !account) {
      throw new Error("Account not found");
    }

    const plan = account?.plan || "starter";

    const formattedMessages = messages
      .filter((msg) => msg.content && msg.content.trim())
      .map((msg) => ({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      }));

    if (formattedMessages.length === 0) {
      return "I didn't catch that. Could you please send your message again?";
    }

    const latestMessage = formattedMessages[formattedMessages.length - 1].content;
    
    // Default to sales for simulator (we don't have a real customerId here)
    const intent = plan === "starter" ? "sales" : await routeMessage(latestMessage, formattedMessages);
    
    // In simulator, we pass a dummy customer ID. In production (processor.js), we pass the real one.
    const dummyCustomerId = "00000000-0000-0000-0000-000000000000";

    let systemPrompt = "";
    let tools = {};

    switch(intent) {
      case "support":
        systemPrompt = getSupportAgentPrompt(account.business_name, account.ai_personality);
        tools = createSupportTools(accountId, dummyCustomerId);
        break;
      case "order_tracking":
        systemPrompt = getOrderTrackerAgentPrompt(account.business_name, account.ai_personality);
        tools = createSupportTools(accountId, dummyCustomerId);
        break;
      case "sales":
      default:
        systemPrompt = getSalesAgentPrompt(account.business_name, account.country, account.ai_personality);
        tools = createSalesTools(accountId, dummyCustomerId);
        break;
    }

    let text = "";

    try {
      const model = await getModelInstance(plan);
      const result = await generateText({
        model,
        system: systemPrompt,
        messages: formattedMessages,
        tools: tools,
        maxSteps: plan === "starter" ? 2 : 5, // Allow multi-step tool calls
      });
      text = result.text;
    } catch (primaryError) {
      console.warn(`Primary AI model failed for plan '${plan}': ${primaryError.message}. Falling back...`);
      try {
        if (process.env.GOOGLE_GENERATIVE_AI_API_KEY && google) {
          const result = await generateText({
            model: google("gemini-1.5-flash"),
            system: systemPrompt,
            messages: formattedMessages,
            tools: tools,
            maxSteps: 3,
          });
          text = result.text;
        } else if (process.env.VECTORENGINE_API_KEY) {
          const customOpenAI = createOpenAI({
            apiKey: process.env.VECTORENGINE_API_KEY,
            baseURL: process.env.VECTORENGINE_BASE_URL || "https://api.vectorengine.ai/v1",
            compatibility: "compatible",
          });
          const result = await generateText({
            model: customOpenAI("gpt-5.5-pro"),
            system: systemPrompt,
            messages: formattedMessages,
            tools: tools,
            maxSteps: 3,
          });
          text = result.text;
        } else if (process.env.OPENAI_API_KEY) {
          const { openai } = await import("@ai-sdk/openai");
          const result = await generateText({
            model: openai("gpt-4o-mini"),
            system: systemPrompt,
            messages: formattedMessages,
            tools: tools,
            maxSteps: 3,
          });
          text = result.text;
        } else {
          throw new Error("All AI providers exhausted");
        }
      } catch (fallbackError) {
        throw fallbackError;
      }
    }

    if (!text || !text.trim()) {
      return "I'm not sure how to respond to that. Could you rephrase your question?";
    }

    return text;
  } catch (error) {
    console.error("AI simulateChat error:", error.message);
    if (error.message?.includes("Account not found")) return "Your account is still being set up. Please try again in a moment.";
    if (error.message?.includes("SAFETY")) return "I can't process that message. Please try asking something else.";
    if (error.message?.includes("quota") || error.message?.includes("429")) return "We're experiencing high demand right now. Please try again in a few minutes.";
    return "I'm having trouble connecting right now. A team member will follow up with you shortly.";
  }
}
