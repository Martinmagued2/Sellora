import ZAI from "z-ai-web-dev-sdk";
import { getZAIConfig } from "@/lib/ai/z-ai-config";

/**
 * Shared image generation utility with automatic fallback.
 *
 * 1. Tries ZAI SDK first (works on the platform/deployed environment)
 * 2. If ZAI is unreachable (e.g. localhost, internal IPs), falls back to Google Imagen 3
 *
 * Returns: { success: true, imageBase64, source: "zai" | "google" }
 * Throws on complete failure.
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
      console.warn("[ImageGen] ZAI SDK unreachable (likely localhost/internal network), falling back to Google Imagen");
    } else {
      console.warn("[ImageGen] ZAI SDK failed:", msg.substring(0, 200));
    }
  }

  // ─── Attempt 2: Google Imagen 3 REST API ───
  const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!googleApiKey) {
    return {
      success: false,
      error: "Image generation unavailable. ZAI SDK is not reachable from this environment, and no Google API key is configured for fallback.",
    };
  }

  try {
    console.log("[ImageGen] Trying Google Imagen 3 REST API...");

    // Map the size to an aspect ratio
    const sizeToAspectRatio = {
      "1024x1024": "1:1",
      "768x1344": "9:16",
      "864x1152": "3:4",
      "1344x768": "16:9",
      "1152x864": "4:3",
      "1440x720": "2:1",
      "720x1440": "1:2",
    };
    const aspectRatio = sizeToAspectRatio[size] || "1:1";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${googleApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio,
          },
        }),
        signal: AbortSignal.timeout(30000), // 30s timeout
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error("[ImageGen] Google Imagen API error:", response.status, errorText.substring(0, 300));

      // If Imagen 3 doesn't work, try the generateImages endpoint (newer API format)
      if (response.status === 404 || errorText.includes("not found")) {
        console.log("[ImageGen] Trying alternate generateImages endpoint...");
        return await tryGoogleGenerateImages(prompt, googleApiKey, aspectRatio);
      }

      throw new Error(`Google Imagen API returned ${response.status}: ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    const imageBase64 = data?.predictions?.[0]?.bytesBase64Encoded;

    if (!imageBase64) {
      throw new Error("No image data in Google Imagen response");
    }

    console.log("[ImageGen] ✅ Image generated via Google Imagen 3");
    return { success: true, imageBase64, source: "google" };
  } catch (googleError) {
    console.error("[ImageGen] Google Imagen failed:", googleError.message);

    // Try alternate endpoint as final fallback
    if (googleApiKey) {
      try {
        return await tryGoogleGenerateImages(prompt, googleApiKey, "1:1");
      } catch (altError) {
        console.error("[ImageGen] Alternate endpoint also failed:", altError.message);
      }
    }

    return {
      success: false,
      error: `Image generation failed. ZAI SDK is unreachable from this environment, and Google Imagen fallback failed: ${googleError.message}`,
    };
  }
}

/**
 * Try the newer generateImages API endpoint as fallback
 */
async function tryGoogleGenerateImages(prompt, apiKey, aspectRatio) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:generateImages?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        config: {
          numberOfImages: 1,
          aspectRatio,
        },
      }),
      signal: AbortSignal.timeout(30000),
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Google generateImages API returned ${response.status}: ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  const imageBase64 =
    data?.generatedImages?.[0]?.image?.imageBytes ||
    data?.images?.[0]?.imageBytes ||
    data?.predictions?.[0]?.bytesBase64Encoded;

  if (!imageBase64) {
    throw new Error("No image data in Google generateImages response");
  }

  console.log("[ImageGen] ✅ Image generated via Google generateImages endpoint");
  return { success: true, imageBase64, source: "google" };
}
