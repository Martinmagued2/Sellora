import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import ZAI from "z-ai-web-dev-sdk";

export async function POST(req) {
  try {
    // ─── Auth ───
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

    // ─── Parse input ───
    const body = await req.json();
    const { image_base64, image_url, conversation_id } = body;

    if (!image_base64 && !image_url) {
      return Response.json({ error: "No image data provided" }, { status: 400 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // ─── Analyze image with AI Vision ───
    let analysisText = "";

    // Build the image source for vision
    let imageSrc = "";
    if (image_base64) {
      // Determine MIME type from base64 header or default to jpeg
      const mimeType = image_base64.startsWith("iVBOR") ? "image/png"
        : image_base64.startsWith("UklGR") ? "image/webp"
        : image_base64.startsWith("R0lGOD") ? "image/gif"
        : "image/jpeg";
      imageSrc = `data:${mimeType};base64,${image_base64}`;
    } else if (image_url) {
      imageSrc = image_url;
    }

    // Attempt 1: z-ai-web-dev-sdk VLM
    try {
      const zai = await ZAI.create();
      const result = await zai.chat.completions.createVision({
        model: "glm-4.6v",
        messages: [
          {
            role: "system",
            content: [
              { type: "text", text: "You are a product recognition assistant for an e-commerce store. Analyze images and extract product attributes. Output only valid JSON with this structure: {\"category\": \"string\", \"color\": \"string\", \"style\": \"string\", \"type\": \"string\", \"description\": \"string\", \"keywords\": [\"string\"]}. If the image is not a product, set category to \"non_product\" and describe what you see." }
            ]
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this image and identify any products visible. Extract product attributes including category, color, style, type, and keywords that could be used to search a product catalog." },
              { type: "image_url", image_url: { url: imageSrc } }
            ]
          }
        ],
        thinking: { type: "disabled" }
      });

      const reply = result.choices?.[0]?.message?.content;
      if (reply) {
        analysisText = reply;
        console.log("[ImageRecognize] VLM result:", analysisText.substring(0, 150));
      }
    } catch (vlmError) {
      console.error("[ImageRecognize] VLM failed:", vlmError?.message?.substring(0, 150));
    }

    // Attempt 2: Fallback to Google Gemini Vision via existing project infrastructure
    if (!analysisText) {
      try {
        const { analyzeImage } = await import("@/lib/ai/index");
        const desc = await analyzeImage(
          imageSrc,
          "Identify the product in this image. Extract category, color, style, type, and keywords for catalog search."
        );
        if (desc) {
          analysisText = desc;
          console.log("[ImageRecognize] Gemini fallback:", analysisText.substring(0, 150));
        }
      } catch (geminiError) {
        console.error("[ImageRecognize] Gemini fallback failed:", geminiError?.message?.substring(0, 150));
      }
    }

    // Attempt 3: Fallback to NVIDIA Vision
    if (!analysisText && process.env.NVIDIA_API_KEY) {
      try {
        const { generateText } = await import("ai");
        const { createOpenAI } = await import("@ai-sdk/openai");

        const nvidia = createOpenAI({
          apiKey: process.env.NVIDIA_API_KEY,
          baseURL: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
          compatibility: "compatible",
        });

        const result = await generateText({
          model: nvidia("meta/llama-3.2-90b-vision-instruct"),
          messages: [{
            role: "user",
            content: [
              { type: "text", text: "Analyze this image and identify any products. Extract: category, color, style, type, and keywords for e-commerce catalog search. Describe what you see." },
              { type: "image", image: imageSrc },
            ],
          }],
          maxTokens: 300,
        });

        if (result.text) {
          analysisText = result.text;
          console.log("[ImageRecognize] NVIDIA fallback:", analysisText.substring(0, 150));
        }
      } catch (nvidiaError) {
        console.error("[ImageRecognize] NVIDIA fallback failed:", nvidiaError?.message?.substring(0, 150));
      }
    }

    if (!analysisText) {
      return Response.json({
        success: true,
        analysis: "Could not analyze the image.",
        products: [],
        message: "Image analysis unavailable. Please try again.",
      });
    }

    // ─── Parse analysis and search product catalog ───
    let searchKeywords = [];
    let category = "";
    let color = "";
    let style = "";
    let productType = "";

    // Try to parse structured JSON from analysis
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        category = parsed.category || "";
        color = parsed.color || "";
        style = parsed.style || "";
        productType = parsed.type || "";
        searchKeywords = parsed.keywords || [];
      }
    } catch (parseErr) {
      // If JSON parsing fails, use the raw text as keywords
      searchKeywords = analysisText
        .split(/[,.\n]/)
        .map((k) => k.trim().toLowerCase())
        .filter((k) => k.length > 2 && k.length < 30)
        .slice(0, 10);
    }

    // Build search terms from all extracted attributes
    const allSearchTerms = [
      category,
      color,
      style,
      productType,
      ...searchKeywords,
    ].filter(Boolean).map((t) => t.toLowerCase());

    // ─── Search the merchant's product catalog ───
    let matchingProducts = [];

    try {
      // Fetch active products for this account
      const { data: products } = await adminClient
        .from("products")
        .select("id, name, price, description, category, stock, image_urls, status")
        .eq("account_id", user.id)
        .eq("status", "active");

      if (products && products.length > 0) {
        // Score each product by relevance to the image analysis
        const scored = products.map((product) => {
          let score = 0;
          const productName = (product.name || "").toLowerCase();
          const productDesc = (product.description || "").toLowerCase();
          const productCategory = (product.category || "").toLowerCase();
          const searchableText = `${productName} ${productDesc} ${productCategory}`;

          // Score based on keyword matches
          for (const term of allSearchTerms) {
            if (searchableText.includes(term)) {
              score += 10;
            }
            // Partial match bonus
            if (productName.includes(term)) {
              score += 15;
            }
            if (productCategory === category?.toLowerCase()) {
              score += 20;
            }
          }

          // Color match bonus
          if (color && searchableText.includes(color.toLowerCase())) {
            score += 15;
          }

          // Style match bonus
          if (style && searchableText.includes(style.toLowerCase())) {
            score += 10;
          }

          // Category match bonus
          if (category && productCategory === category.toLowerCase()) {
            score += 25;
          }

          return {
            ...product,
            match_score: score,
            confidence: Math.min(Math.round((score / 100) * 100), 100),
          };
        });

        // Filter and sort by score
        matchingProducts = scored
          .filter((p) => p.match_score > 0)
          .sort((a, b) => b.match_score - a.match_score)
          .slice(0, 5);

        // If no matches found, return top 3 products as suggestions
        if (matchingProducts.length === 0 && products.length > 0) {
          matchingProducts = products.slice(0, 3).map((p) => ({
            ...p,
            match_score: 0,
            confidence: 0,
            note: "No direct match found — showing popular products",
          }));
        }
      }
    } catch (dbError) {
      console.error("[ImageRecognize] Product search failed:", dbError?.message);
    }

    // ─── Generate AI response for the image ───
    let aiResponse = null;
    if (conversation_id) {
      try {
        const { generateAIReply } = await import("@/lib/ai/index");

        const { data: account } = await adminClient
          .from("accounts")
          .select("plan, business_name, country, currency")
          .eq("id", user.id)
          .single();

        const { data: conversation } = await adminClient
          .from("conversations")
          .select("id, customer_id")
          .eq("id", conversation_id)
          .eq("account_id", user.id)  // SECURITY: Ownership check prevents IDOR
          .single();

        if (conversation?.customer_id) {
          const { data: customer } = await adminClient
            .from("customers")
            .select("name")
            .eq("id", conversation.customer_id)
            .single();

          const { data: recentMessages } = await adminClient
            .from("messages")
            .select("content, direction, is_ai, created_at")
            .eq("conversation_id", conversation_id)
            .order("created_at", { ascending: false })
            .limit(6);

          const conversationHistory = (recentMessages || [])
            .reverse()
            .map((m) => ({
              content: m.content,
              direction: m.direction,
              is_ai: m.is_ai,
              created_at: m.created_at,
            }));

          // Build a message that includes the image analysis results
          const productsContext = matchingProducts.length > 0
            ? `\n\nMatching products from catalog:\n${matchingProducts.map((p) => `• ${p.name} — ${p.price} ${account?.currency || "EGP"} (Confidence: ${p.confidence}%, Stock: ${p.stock})`).join("\n")}`
            : "\n\nNo matching products found in the catalog.";

          const aiMessage = `[Customer sent an image]\nImage analysis: ${analysisText}${productsContext}\n\nPlease respond to the customer about the image they sent. If matching products were found, recommend them. If no matches, acknowledge the image and ask how you can help.`;

          const aiResult = await generateAIReply({
            accountId: user.id,
            customerId: conversation.customer_id,
            customerMessage: aiMessage,
            customerName: customer?.name || "Customer",
            personality: "",
            country: account?.country || "Egypt",
            businessName: account?.business_name || "My Store",
            conversationHistory,
            plan: account?.plan || "starter",
          });

          aiResponse = aiResult.reply || null;
        }
      } catch (aiErr) {
        console.error("[ImageRecognize] AI response generation failed:", aiErr?.message);
      }
    }

    return Response.json({
      success: true,
      analysis: analysisText,
      attributes: { category, color, style, type: productType, keywords: searchKeywords },
      products: matchingProducts,
      ai_response: aiResponse,
    });
  } catch (error) {
    console.error("[ImageRecognize] Error:", error);
    return Response.json(
      { error: error.message || "Image recognition failed" },
      { status: 500 }
    );
  }
}
