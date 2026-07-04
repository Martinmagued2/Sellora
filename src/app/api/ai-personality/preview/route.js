import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const google = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  ? createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })
  : null;

// POST: Generate a preview AI response using current personality settings
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      aiName = "Sellora AI",
      personalityType = "friendly",
      customDescription = "",
      formality = 5,
      enthusiasm = 7,
      verbosity = 5,
      empathy = 7,
      maxResponseLength = 500,
      forbiddenTopics = [],
      escalationKeywords = [],
      customerMessage = "Hi, I'm looking for a product recommendation!",
      businessName = "My Store",
      country = "Egypt",
    } = body;

    // Build personality description
    const personalityLabels = {
      professional: "Professional and business-like",
      friendly: "Friendly and approachable",
      casual: "Casual and relaxed",
      luxury: "Premium and sophisticated",
      playful: "Playful and fun",
    };

    const formalityDesc = formality <= 3 ? "very casual and informal" : formality <= 6 ? "moderately formal" : "very formal and professional";
    const enthusiasmDesc = enthusiasm <= 3 ? "calm and measured" : enthusiasm <= 6 ? "moderately enthusiastic" : "highly energetic and enthusiastic";
    const verbosityDesc = verbosity <= 3 ? "concise and to-the-point" : verbosity <= 6 ? "moderately detailed" : "thorough and detailed";
    const empathyDesc = empathy <= 3 ? "factual and direct" : empathy <= 6 ? "moderately empathetic" : "deeply empathetic and caring";

    let personalityText = `You are ${aiName}, a ${personalityLabels[personalityType] || "friendly"} AI assistant for "${businessName}" located in ${country}. `;
    personalityText += `Your communication style is ${formalityDesc}, ${enthusiasmDesc}, ${verbosityDesc}, and ${empathyDesc}. `;

    if (customDescription && customDescription.trim()) {
      personalityText += `Custom personality override: ${customDescription.trim()}. `;
    }

    if (forbiddenTopics.length > 0) {
      personalityText += `NEVER discuss these topics: ${forbiddenTopics.join(", ")}. `;
    }

    if (escalationKeywords.length > 0) {
      personalityText += `If the customer mentions any of these keywords: ${escalationKeywords.join(", ")}, consider escalating to a human agent. `;
    }

    personalityText += "Use emojis sparingly and appropriately. ";
    personalityText += `Keep your response under ${maxResponseLength} characters. `;
    personalityText += "This is a PREVIEW response — respond to the customer message as you would in a real conversation.";

    const systemPrompt = personalityText;

    // Try providers in order
    const providers = [];

    if (process.env.GROQ_API_KEY) {
      const groqProvider = createGroq();
      providers.push({ name: "groq", model: groqProvider("meta-llama/llama-4-scout-17b-16e-instruct") });
    }

    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY && google) {
      providers.push({ name: "google", model: google("gemini-2.0-flash") });
    }

    if (process.env.NVIDIA_API_KEY) {
      try {
        const nvidia = createOpenAI({
          apiKey: process.env.NVIDIA_API_KEY,
          baseURL: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
          compatibility: "compatible",
        });
        providers.push({ name: "nvidia", model: nvidia("meta/llama-3.3-70b-instruct") });
      } catch (e) {}
    }

    if (providers.length === 0) {
      return Response.json({ error: "No AI providers configured" }, { status: 500 });
    }

    let text = "";
    let usedProvider = "";

    for (const provider of providers) {
      try {
        const result = await generateText({
          model: provider.model,
          system: systemPrompt,
          messages: [{ role: "user", content: customerMessage }],
          maxTokens: Math.min(maxResponseLength * 2, 1000),
        });
        if (result.text && result.text.trim()) {
          text = result.text.trim();
          usedProvider = provider.name;
          break;
        }
      } catch (providerError) {
        console.warn(`[AI Preview] ${provider.name} failed: ${providerError.message}`);
      }
    }

    if (!text) {
      return Response.json({ error: "All AI providers failed to generate a preview" }, { status: 500 });
    }

    // Truncate if over max response length
    if (text.length > maxResponseLength) {
      text = text.substring(0, maxResponseLength) + "...";
    }

    return Response.json({ preview: text, provider: usedProvider });
  } catch (err) {
    console.error("AI personality preview error:", err);
    return Response.json({ error: "Failed to generate preview" }, { status: 500 });
  }
}
