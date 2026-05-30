import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { generateText } from "ai";
import { groq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

// Service role client (lazy-initialized)
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabase;
}

/**
 * Build provider chain for text generation
 */
function buildProviderChain() {
  const providers = [];

  if (process.env.VECTORENGINE_API_KEY) {
    const customOpenAI = createOpenAI({
      apiKey: process.env.VECTORENGINE_API_KEY,
      baseURL: process.env.VECTORENGINE_BASE_URL || "https://api.vectorengine.ai/v1",
      compatibility: "compatible",
    });
    providers.push({ name: 'vectorengine', model: customOpenAI("gpt-5.5-pro") });
  }

  if (process.env.GROQ_API_KEY) {
    providers.push({ name: 'groq', model: groq("llama-3.3-70b-versatile") });
  }

  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    try {
      const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
      providers.push({ name: 'google', model: google("gemini-2.0-flash") });
    } catch (e) {}
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const { openai } = require("@ai-sdk/openai");
      providers.push({ name: 'openai', model: openai("gpt-4o-mini") });
    } catch (e) {}
  }

  return providers;
}

/**
 * POST /api/ai/generate-description
 * Generates a compelling product description in English and Arabic.
 */
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { product_name, features, category, tone, language } = body;

    if (!product_name && !features) {
      return NextResponse.json({ error: "Product name or features are required" }, { status: 400 });
    }

    const finalName = product_name || "Product";
    const finalFeatures = features || "";
    const finalCategory = category || "General";
    const finalTone = tone || "professional";
    const finalLanguage = language || "both"; // "en", "ar", or "both"

    const prompt = `Generate a compelling, SEO-optimized product description for an e-commerce store.

Product Name: ${finalName}
Category: ${finalCategory}
Key Features/Keywords: ${finalFeatures}
Tone: ${finalTone}

${finalLanguage === "both" || finalLanguage === "en" ? `ENGLISH DESCRIPTION:
Write a ${finalTone} product description (2-3 paragraphs) that highlights the key features, benefits, and unique selling points. Make it engaging and persuasive for online shoppers.

` : ""}${finalLanguage === "both" || finalLanguage === "ar" ? `ARABIC DESCRIPTION:
Write the same product description in Arabic (وصف المنتج بالعربي). Make it natural and culturally appropriate for Arabic-speaking customers.

` : ""}SUGGESTED PRICE RANGE:
Based on the product category and features, suggest a reasonable price range in EGP (Egyptian Pounds).

Format your response as:
---EN---
[English description]

---AR---
[Arabic description]

---PRICE---
[Suggested price range in EGP]`;

    const providers = buildProviderChain();

    if (providers.length === 0) {
      return NextResponse.json({ error: "No AI providers configured" }, { status: 500 });
    }

    let description = null;
    let lastError = null;

    for (const provider of providers) {
      try {
        const result = await generateText({
          model: provider.model,
          prompt,
          maxTokens: 800,
        });
        description = result.text;
        if (description && description.trim()) break;
      } catch (providerError) {
        lastError = providerError;
        console.warn(`[generate-description] ${provider.name} failed:`, providerError.message);
      }
    }

    if (!description) {
      return NextResponse.json({ error: "Failed to generate description", details: lastError?.message }, { status: 500 });
    }

    // Parse the response
    let englishDesc = "";
    let arabicDesc = "";
    let priceSuggestion = "";

    const enMatch = description.match(/---EN---\n?([\s\S]*?)(?=---AR---|$)/);
    const arMatch = description.match(/---AR---\n?([\s\S]*?)(?=---PRICE---|$)/);
    const priceMatch = description.match(/---PRICE---\n?([\s\S]*?)$/);

    if (enMatch) englishDesc = enMatch[1].trim();
    if (arMatch) arabicDesc = arMatch[1].trim();
    if (priceMatch) priceSuggestion = priceMatch[1].trim();

    // Fallback: if parsing didn't work well, use the whole description
    if (!englishDesc && !arabicDesc) {
      englishDesc = description.trim();
    }

    return NextResponse.json({
      success: true,
      english: englishDesc,
      arabic: arabicDesc,
      price_suggestion: priceSuggestion,
      raw: description,
    });
  } catch (error) {
    console.error("Generate description error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
