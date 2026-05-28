import ZAI from "z-ai-web-dev-sdk";
import { getZAIConfig } from "@/lib/ai/z-ai-config";

/**
 * Shared image generation utility with automatic fallback chain:
 *
 * 1. ZAI SDK (works on the deployed platform)
 * 2. Pollinations.ai (free, no API key needed, works everywhere)
 *
 * Returns: { success: true, imageBase64, source: "zai" | "pollinations" }
 */

const ZAI_TIMEOUT_MS = 8000; // 8s timeout for ZAI before falling back

/**
 * Generate a product image using AI with automatic fallback.
 * @param {string} prompt - The image generation prompt
 * @param {object} options - Optional: { size: "1024x1024" }
 * @returns {{ success: boolean, imageBase64?: string, source?: string, error?: string }}
 */
export async function generateProductImage(prompt, options = {}) {
  const size = options.size || "1024x1024";
  const [width, height] = size.split("x").map(Number);

  // ─── Attempt 1: ZAI SDK ───
  try {
    const zaiConfig = getZAIConfig();
    if (zaiConfig) {
      console.log("[ImageGen] Trying ZAI SDK...");
      const zai = new ZAI(zaiConfig);

      // Wrap ZAI call with a timeout so we don't hang for 10+ seconds
      const zaiResult = await Promise.race([
        zai.images.generations.create({ prompt, size }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("ZAI timeout")), ZAI_TIMEOUT_MS)
        ),
      ]);

      const imageBase64 = zaiResult?.data?.[0]?.base64;
      if (imageBase64) {
        console.log("[ImageGen] ✅ Image generated via ZAI SDK");
        return { success: true, imageBase64, source: "zai" };
      }
      throw new Error("No image data in ZAI response");
    }
  } catch (zaiError) {
    const msg = zaiError?.message || "";
    if (
      msg.includes("timeout") ||
      msg.includes("Timeout") ||
      msg.includes("fetch failed") ||
      msg.includes("ECONNREFUSED") ||
      msg.includes("ConnectTimeoutError") ||
      msg.includes("UND_ERR_CONNECT_TIMEOUT")
    ) {
      console.warn("[ImageGen] ZAI SDK unreachable (likely localhost/internal network), falling back to Pollinations.ai");
    } else {
      console.warn("[ImageGen] ZAI SDK failed:", msg.substring(0, 200));
    }
  }

  // ─── Attempt 2: Pollinations.ai (free, no API key, works everywhere) ───
  try {
    console.log("[ImageGen] Trying Pollinations.ai...");
    const encodedPrompt = encodeURIComponent(prompt);
    const seed = Math.floor(Math.random() * 1000000);

    // Pollinations.ai returns an image directly from a GET URL
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width || 1024}&height=${height || 1024}&seed=${seed}&nologo=true&model=flux`;

    const response = await fetch(imageUrl, {
      signal: AbortSignal.timeout(60000), // 60s timeout (can be slow for first generation)
      headers: {
        "Accept": "image/png,image/*",
      },
    });

    if (!response.ok) {
      throw new Error(`Pollinations.ai returned ${response.status}`);
    }

    // Convert the image response to base64
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const imageBase64 = buffer.toString("base64");

    if (!imageBase64 || imageBase64.length < 100) {
      throw new Error("Pollinations.ai returned empty or invalid image data");
    }

    console.log(`[ImageGen] ✅ Image generated via Pollinations.ai (${(imageBase64.length / 1024).toFixed(0)}KB base64)`);
    return { success: true, imageBase64, source: "pollinations" };
  } catch (pollinationsError) {
    console.error("[ImageGen] Pollinations.ai failed:", pollinationsError.message);
    return {
      success: false,
      error: `Image generation failed. ZAI SDK is unreachable from this environment, and the fallback image service (Pollinations.ai) also failed: ${pollinationsError.message}`,
    };
  }
}
