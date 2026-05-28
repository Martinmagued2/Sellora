import ZAI from "z-ai-web-dev-sdk";
import { getZAIConfig } from "@/lib/ai/z-ai-config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const execFileAsync = promisify(execFile);

/**
 * Shared image generation utility with automatic fallback chain:
 *
 * 1. Gemini 2.5 Flash Image Generation (uses GOOGLE_GENERATIVE_AI_API_KEY)
 * 2. ZAI SDK (works on the deployed platform)
 * 3. z-ai-generate CLI tool (works on server environments)
 * 4. Together AI FLUX.1-schnell-Free (high quality, free key from together.ai)
 * 5. Pollinations.ai (free, no key needed, decent quality with flux-realism)
 *
 * Returns: { success: true, imageBase64, source }
 */

const ZAI_TIMEOUT_MS = 8000;

// Gemini models that support native image generation, tried in order
const GEMINI_IMAGE_MODELS = [
  "gemini-2.0-flash-preview-image-generation",
  "gemini-2.5-flash-preview-image-generation",
];

/**
 * Generate a product image using AI with automatic fallback.
 * @param {string} prompt - The image generation prompt
 * @param {object} options - Optional: { size: "1024x1024" }
 * @returns {{ success: boolean, imageBase64?: string, source?: string, error?: string }}
 */
export async function generateProductImage(prompt, options = {}) {
  const size = options.size || "1024x1024";

  // ─── Attempt 1: Gemini Image Generation (via REST API) ───
  // Uses the existing GOOGLE_GENERATIVE_AI_API_KEY.
  // Note: Image generation models may not be available in all regions.
  // The SDK uses v1beta which may not list these models, so we call REST directly.
  const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (googleApiKey) {
    for (const modelName of GEMINI_IMAGE_MODELS) {
      try {
        console.log(`[ImageGen] Trying Gemini image generation (${modelName})...`);

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${googleApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `Generate a high-quality product image: ${prompt}`,
                    },
                  ],
                },
              ],
              generationConfig: {
                responseModalities: ["TEXT", "IMAGE"],
              },
            }),
            signal: AbortSignal.timeout(30000),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const parts = data.candidates?.[0]?.content?.parts || [];

          for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
              const imageBase64 = part.inlineData.data;
              const mimeType = part.inlineData.mimeType || "image/png";
              console.log(
                `[ImageGen] ✅ Image generated via Gemini (${modelName}, ${mimeType}, ${(imageBase64.length / 1024).toFixed(0)}KB base64)`
              );
              return { success: true, imageBase64, source: `gemini` };
            }
          }
          // No image in response — model exists but didn't generate image
          console.warn(`[ImageGen] Gemini ${modelName} returned no image data`);
        } else {
          const errorData = await response.json().catch(() => ({}));
          const errMsg = errorData?.error?.message || `HTTP ${response.status}`;
          // Don't retry remaining Gemini models if it's a location/auth error
          if (errMsg.includes("location is not supported")) {
            console.warn(`[ImageGen] Gemini image generation not available in your region`);
            break;
          }
          if (errMsg.includes("not found") || response.status === 404) {
            console.warn(`[ImageGen] Gemini model ${modelName} not found, trying next`);
            continue;
          }
          console.warn(`[ImageGen] Gemini ${modelName} failed: ${errMsg.substring(0, 150)}`);
        }
      } catch (geminiError) {
        console.warn(`[ImageGen] Gemini ${modelName} error: ${geminiError.message?.substring(0, 150)}`);
      }
    }
  }

  // ─── Attempt 2: ZAI SDK (direct API call) ───
  try {
    const zaiConfig = getZAIConfig();
    if (zaiConfig) {
      console.log("[ImageGen] Trying ZAI SDK...");
      const zai = new ZAI(zaiConfig);

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
      console.warn("[ImageGen] ZAI SDK unreachable, trying next method");
    } else {
      console.warn("[ImageGen] ZAI SDK failed:", msg.substring(0, 200));
    }
  }

  // ─── Attempt 3: z-ai-generate CLI tool ───
  try {
    console.log("[ImageGen] Trying z-ai-generate CLI...");
    const tmpFile = join(tmpdir(), `sellora-img-${Date.now()}.png`);

    await execFileAsync("z-ai-generate", ["-p", prompt, "-o", tmpFile, "-s", size], {
      timeout: 60000,
      encoding: "utf-8",
    });

    const imageBuffer = await readFile(tmpFile);
    try { await unlink(tmpFile); } catch {}

    if (imageBuffer && imageBuffer.length > 1000) {
      const imageBase64 = imageBuffer.toString("base64");
      console.log(`[ImageGen] ✅ Image generated via CLI (${(imageBuffer.length / 1024).toFixed(0)}KB)`);
      return { success: true, imageBase64, source: "cli" };
    }
    throw new Error("CLI output file was empty or too small");
  } catch (cliError) {
    const msg = cliError?.message || "";
    if (msg.includes("not found") || msg.includes("ENOENT") || msg.includes("command not found")) {
      console.warn("[ImageGen] z-ai-generate CLI not available, trying next method");
    } else {
      console.warn("[ImageGen] z-ai-generate CLI failed:", msg.substring(0, 200));
    }
  }

  // ─── Attempt 4: Together AI (FLUX.1-schnell-Free — high quality) ───
  // Free to use: https://api.together.xyz — create account → get API key
  const togetherApiKey = process.env.TOGETHER_API_KEY;
  if (togetherApiKey) {
    try {
      console.log("[ImageGen] Trying Together AI FLUX.1-schnell-Free...");
      const [width, height] = size.split("x").map(Number);

      const response = await fetch("https://api.together.xyz/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${togetherApiKey}`,
        },
        body: JSON.stringify({
          model: "black-forest-labs/FLUX.1-schnell-Free",
          prompt,
          width: width || 1024,
          height: height || 1024,
          steps: 4,
          n: 1,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`Together AI returned ${response.status}: ${errorText.substring(0, 200)}`);
      }

      const data = await response.json();
      const imageBase64 = data?.data?.[0]?.b64_json;

      if (!imageBase64) {
        const imageUrl = data?.data?.[0]?.url;
        if (imageUrl) {
          console.log("[ImageGen] Together AI returned URL, downloading...");
          const imgResp = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
          if (imgResp.ok) {
            const imgBuf = Buffer.from(await imgResp.arrayBuffer());
            const base64 = imgBuf.toString("base64");
            console.log(`[ImageGen] ✅ Image generated via Together AI (${(imgBuf.length / 1024).toFixed(0)}KB)`);
            return { success: true, imageBase64: base64, source: "together" };
          }
        }
        throw new Error("No image data in Together AI response");
      }

      console.log(`[ImageGen] ✅ Image generated via Together AI (${(imageBase64.length / 1024).toFixed(0)}KB base64)`);
      return { success: true, imageBase64, source: "together" };
    } catch (togetherError) {
      console.warn("[ImageGen] Together AI failed:", togetherError.message?.substring(0, 200));
    }
  } else {
    console.warn("[ImageGen] No TOGETHER_API_KEY — add a free key from https://api.together.xyz for high-quality FLUX images");
  }

  // ─── Attempt 5: Pollinations.ai (free, no API key) ───
  try {
    console.log("[ImageGen] Trying Pollinations.ai (free fallback)...");
    const [width, height] = size.split("x").map(Number);
    const encodedPrompt = encodeURIComponent(prompt);
    const seed = Math.floor(Math.random() * 1000000);

    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width || 1024}&height=${height || 1024}&seed=${seed}&nologo=true&model=flux-realism`;

    const response = await fetch(imageUrl, {
      signal: AbortSignal.timeout(60000),
      headers: { Accept: "image/png,image/*" },
    });

    if (!response.ok) {
      throw new Error(`Pollinations.ai returned ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const imageBase64 = buffer.toString("base64");

    if (!imageBase64 || imageBase64.length < 100) {
      throw new Error("Pollinations.ai returned empty or invalid image data");
    }

    console.log(`[ImageGen] ⚠️ Image via Pollinations.ai (${(buffer.length / 1024).toFixed(0)}KB). For better quality, add TOGETHER_API_KEY to .env.local`);
    return { success: true, imageBase64, source: "pollinations" };
  } catch (pollinationsError) {
    console.error("[ImageGen] All image generation methods failed");
    return {
      success: false,
      error: `Image generation failed. Tips: (1) Add TOGETHER_API_KEY from https://api.together.xyz (free, FLUX model), or (2) Gemini image gen may not be available in your region. Last error: ${pollinationsError.message}`,
    };
  }
}
