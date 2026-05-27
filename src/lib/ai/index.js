import { generateText } from "ai";
import { groq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { routeMessage } from "./router";
import { createSalesTools, createSupportTools } from "./tools";
import { getSalesAgentPrompt, getSupportAgentPrompt, getOrderTrackerAgentPrompt } from "./agents";
import { getAIModelForPlan } from "@/lib/plan-limits";

const google = process.env.GOOGLE_GENERATIVE_AI_API_KEY 
  ? createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })
  : null;

async function getModelInstance(plan) {
  if (process.env.VECTORENGINE_API_KEY) {
    const customOpenAI = createOpenAI({
      apiKey: process.env.VECTORENGINE_API_KEY,
      baseURL: process.env.VECTORENGINE_BASE_URL || "https://api.vectorengine.ai/v1",
      compatibility: "compatible",
    });
    return customOpenAI("gpt-5.5-pro");
  }

  // Use Groq as primary provider (fast and reliable)
  if (process.env.GROQ_API_KEY) return groq("llama-3.3-70b-versatile");
  // Fallback to Google Gemini
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY && google) return google("gemini-2.0-flash");
  throw new Error("No AI provider configured. Set GROQ_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY.");
}

/**
 * Generate an AI reply based on customer message and business context
 */
export async function generateAIReply({
  accountId,
  customerId,
  customerMessage,
  customerName,
  personality,
  country = "Egypt",
  businessName = "My Store",
  conversationHistory = [],
  plan = "starter",
}) {
  try {
    // 1. Route the message
    const intent = plan === "starter" ? "sales" : await routeMessage(customerMessage, conversationHistory);

    // 2. Setup Agent Prompt and Tools
    let systemPrompt = "";
    let tools = {};

    switch(intent) {
      case "support":
        systemPrompt = getSupportAgentPrompt(businessName, personality);
        tools = createSupportTools(accountId, customerId);
        break;
      case "order_tracking":
        systemPrompt = getOrderTrackerAgentPrompt(businessName, personality);
        tools = createSupportTools(accountId, customerId);
        break;
      case "sales":
      default:
        systemPrompt = getSalesAgentPrompt(businessName, country, personality);
        tools = createSalesTools(accountId, customerId);
        break;
    }

    // 3. Format History
    const formattedMessages = conversationHistory.slice(-6).map((msg) => ({
      role: msg.direction === "incoming" ? "user" : "assistant",
      content: msg.content,
    }));
    
    formattedMessages.push({ role: "user", content: customerMessage });

    let text = "";
    let toolCalls = null;

    try {
      const model = await getModelInstance(plan);
      const result = await generateText({
        model,
        system: systemPrompt,
        messages: formattedMessages,
        tools: tools,
        maxSteps: plan === "starter" ? 2 : 5,
      });
      text = result.text;
      toolCalls = result.toolCalls;
    } catch (primaryError) {
      console.warn(`Primary AI model failed for plan '${plan}': ${primaryError.message}. Falling back...`);
      if (process.env.GOOGLE_GENERATIVE_AI_API_KEY && google) {
        const result = await generateText({
          model: google("gemini-2.0-flash"),
          system: systemPrompt,
          messages: formattedMessages,
          tools: tools,
          maxSteps: 3,
        });
        text = result.text;
        toolCalls = result.toolCalls;
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
        toolCalls = result.toolCalls;
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
        toolCalls = result.toolCalls;
      } else {
        throw new Error("All AI providers exhausted. Please set GROQ_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY.");
      }
    }

    return { reply: text || null, intent, toolCalls };
  } catch (err) {
    console.error("Error generating AI reply:", err);
    return { reply: null, intent: "general", toolCalls: null };
  }
}

/**
 * Analyze customer intent from their message using fast routing
 */
export async function analyzeIntent(message) {
  try {
     const intent = await routeMessage(message);
     return { intent };
  } catch {
    return { intent: "general" };
  }
}
