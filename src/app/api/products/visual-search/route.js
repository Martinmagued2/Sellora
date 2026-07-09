/**
 * Visual Search API (B8)
 * POST /api/products/visual-search
 *
 * Customer sends an image (URL) → AI analyzes it → returns matching
 * products from the catalog based on visual similarity.
 *
 * Uses Gemini Vision to extract a description + keywords, then matches
 * against product names + descriptions + categories.
 *
 * Body: { imageUrl }
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";

let _adminClient = null;
function getAdminClient() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _adminClient;
}

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { imageUrl } = await req.json();
    if (!imageUrl) return NextResponse.json({ error: "imageUrl required" }, { status: 400 });

    const admin = getAdminClient();

    // 1. Analyze the image with Gemini Vision
    let description = "";
    let keywords = [];
    try {
      const { generateText } = await import("ai");
      const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
      const google = process.env.GOOGLE_GENERATIVE_AI_API_KEY
        ? createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })
        : null;

      if (google) {
        const result = await generateText({
          model: google("gemini-2.0-flash"),
          messages: [{
            role: "user",
            content: [
              { type: "text", text: "Analyze this image and describe what product you see in 2-3 keywords (e.g. 'red dress', 'leather shoes', 'wireless earbuds'). Reply with ONLY the keywords, comma-separated, lowercase, no extra text." },
              { type: "image", image: imageUrl },
            ],
          }],
          maxTokens: 50,
        });
        description = result.text || "";
        keywords = description.split(/[,,\n]/).map((k) => k.trim().toLowerCase()).filter(Boolean);
      }
    } catch (visionErr) {
      console.warn("[VISUAL-SEARCH] vision failed:", visionErr.message);
      return NextResponse.json({ error: "Could not analyze image", details: visionErr.message }, { status: 500 });
    }

    if (keywords.length === 0) {
      return NextResponse.json({ error: "Could not identify any products in the image" }, { status: 400 });
    }

    // 2. Search the catalog for matching products
    const { data: products } = await admin
      .from("products")
      .select("id, name, description, price, currency, image_urls, category, stock")
      .eq("account_id", user.id)
      .eq("status", "active")
      .gt("stock", 0);

    if (!products || products.length === 0) {
      return NextResponse.json({ matches: [], keywords });
    }

    // Score each product by keyword matches
    const scored = products.map((p) => {
      const haystack = `${p.name || ""} ${p.description || ""} ${p.category || ""}`.toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        if (haystack.includes(kw)) score += 10;
        // Partial word match
        const words = kw.split(/\s+/);
        for (const w of words) {
          if (w.length > 2 && haystack.includes(w)) score += 2;
        }
      }
      return { product: p, score };
    }).filter((x) => x.score > 0);

    scored.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      keywords,
      matches: scored.slice(0, 5).map((s) => ({
        ...s.product,
        match_score: s.score,
      })),
    });
  } catch (err) {
    console.error("[VISUAL-SEARCH] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
