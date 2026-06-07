import { GoogleGenerativeAI } from "@google/generative-ai";
import ZAI from "z-ai-web-dev-sdk";
import { getZAIConfig } from "@/lib/ai/z-ai-config";
import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const execFileAsync = promisify(execFile);

/**
 * Shared image generation utility with automatic fallback chain:
 *
 * 1. Gemini Image Generation (GOOGLE_GENERATIVE_AI_API_KEY — already on Vercel)
 *    - Uses @google/generative-ai SDK for proper API versioning
 *    - Tries: gemini-2.0-flash-preview-image-generation, gemini-2.0-flash-exp
 *    - Also tries Imagen 3 via REST API
 * 2. ZAI SDK (works from dev environments with internal-api access)
 * 3. z-ai-generate CLI tool (works on server environments)
 * 4. Together AI FLUX.1-schnell-Free (TOGETHER_API_KEY)
 * 5. NVIDIA NIM (qwen-image, FLUX.2-klein — same key as text AI)
 * 6. fal.ai FLUX.1 [dev] (best quality, $10 free credits)
 * 7. Pollinations.ai (free, no key — last resort)
 *
 * Returns: { success: boolean, imageBase64?: string, source?: string, error?: string }
 */

const ZAI_TIMEOUT_MS = 45000;

// Gemini models that support native image generation, tried in order
// These models support responseModalities: ["IMAGE", "TEXT"]
const GEMINI_IMAGE_MODELS = [
  "gemini-2.0-flash-preview-image-generation",
  "gemini-2.0-flash-exp",
];

// Imagen 3 model (uses a different API endpoint / predictImages)
const IMAGEN_MODEL = "imagen-3.0-generate-002";

/**
 * Generate a product image using AI with automatic fallback.
 * @param {string} prompt - The image generation prompt
 * @param {object} options - Optional: { size: "1024x1024" }
 * @returns {{ success: boolean, imageBase64?: string, source?: string, error?: string }}
 */
export async function generateProductImage(prompt, options = {}) {
  const size = options.size || "1024x1024";
  const errors = []; // Track all errors for debugging

  // ─── Attempt 1: Gemini Image Generation (via @google/generative-ai SDK) ───
  // GOOGLE_GENERATIVE_AI_API_KEY is already configured on Vercel!
  // The SDK handles API versioning correctly (v1beta for preview models)
  const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (googleApiKey) {
    // 1a: Try Gemini models with generateContent (image output via responseModalities)
    for (const modelName of GEMINI_IMAGE_MODELS) {
      try {
        console.log(`[ImageGen] Trying Gemini ${modelName} via SDK...`);
        const genAI = new GoogleGenerativeAI(googleApiKey);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        });

        const result = await Promise.race([
          model.generateContent(`Generate a high-quality product image: ${prompt}`),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Gemini timeout")), 45000)
          ),
        ]);

        const response = result.response;
        const parts = response.candidates?.[0]?.content?.parts || [];

        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            const imageBase64 = part.inlineData.data;
            const mimeType = part.inlineData.mimeType || "image/png";
            console.log(
              `[ImageGen] ✅ Image generated via Gemini ${modelName} (${mimeType}, ${(imageBase64.length / 1024).toFixed(0)}KB base64)`
            );
            return { success: true, imageBase64, source: "gemini" };
          }
        }
        console.warn(`[ImageGen] Gemini ${modelName} returned no image data (only text)`);
      } catch (geminiError) {
        const msg = geminiError?.message || String(geminiError);
        errors.push(`Gemini-${modelName}: ${msg.substring(0, 80)}`);
        if (msg.includes("location is not supported") || msg.includes("not available in your country")) {
          console.warn(`[ImageGen] Gemini image generation not available in your region`);
          break; // No point trying other Gemini models if region-blocked
        }
        if (msg.includes("not found") || msg.includes("does not exist")) {
          console.warn(`[ImageGen] Gemini model ${modelName} not found, trying next`);
          continue;
        }
        console.warn(`[ImageGen] Gemini ${modelName} failed: ${msg.substring(0, 150)}`);
      }
    }

    // 1b: Try Imagen 3 via REST API (different endpoint than generateContent)
    try {
      console.log(`[ImageGen] Trying Imagen 3 (${IMAGEN_MODEL}) via REST API...`);
      const [width, height] = size.split("x").map(Number);

      const imagenResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:predict?key=${googleApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: {
              sampleCount: 1,
              aspectRatio: width && height ? (width > height ? "16:9" : width < height ? "9:16" : "1:1") : "1:1",
            },
          }),
          signal: AbortSignal.timeout(45000),
        }
      );

      if (imagenResponse.ok) {
        const data = await imagenResponse.json();
        const predictions = data.predictions || [];
        for (const pred of predictions) {
          // Imagen 3 returns base64 in bytesBase64Encoded field
          const imageBase64 = pred.bytesBase64Encoded;
          if (imageBase64) {
            console.log(`[ImageGen] ✅ Image generated via Imagen 3 (${(imageBase64.length / 1024).toFixed(0)}KB base64)`);
            return { success: true, imageBase64, source: "imagen3" };
          }
        }
        console.warn(`[ImageGen] Imagen 3 returned no image data`);
      } else {
        const errorData = await imagenResponse.json().catch(() => ({}));
        const errMsg = errorData?.error?.message || `HTTP ${imagenResponse.status}`;
        errors.push(`Imagen3: ${errMsg.substring(0, 80)}`);
        console.warn(`[ImageGen] Imagen 3 failed: ${errMsg.substring(0, 150)}`);
      }
    } catch (imagenError) {
      errors.push(`Imagen3: ${imagenError.message?.substring(0, 80)}`);
      console.warn(`[ImageGen] Imagen 3 error: ${imagenError.message?.substring(0, 150)}`);
    }
  }

  // ─── Attempt 2: ZAI SDK (works from dev/internal environments) ───
  // Only works when internal-api.z.ai is reachable (dev/local environments)
  try {
    const zaiConfig = getZAIConfig() || null;
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
    errors.push(`ZAI: ${msg.substring(0, 100)}`);
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
  // Works on server environments where the CLI is installed
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
    errors.push(`CLI: ${msg.substring(0, 80)}`);
    if (msg.includes("not found") || msg.includes("ENOENT") || msg.includes("command not found")) {
      console.warn("[ImageGen] z-ai-generate CLI not available, trying next method");
    } else {
      console.warn("[ImageGen] z-ai-generate CLI failed:", msg.substring(0, 200));
    }
  }

  // ─── Attempt 4: Together AI (FLUX.1-schnell-Free) ───
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
        signal: AbortSignal.timeout(45000),
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
          const imgResp = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
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
      errors.push(`Together: ${togetherError.message?.substring(0, 80)}`);
      console.warn("[ImageGen] Together AI failed:", togetherError.message?.substring(0, 200));
    }
  }

  // ─── Attempt 5: NVIDIA NIM Image Generation ───
  const nvidiaApiKey = process.env.NVIDIA_API_KEY;
  if (nvidiaApiKey) {
    const nvidiaBaseURL = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";
    const nvidiaImageModels = ["qwen-image", "flux.2-klein-4b"];

    for (const modelId of nvidiaImageModels) {
      try {
        console.log(`[ImageGen] Trying NVIDIA NIM ${modelId}...`);
        const [width, height] = size.split("x").map(Number);

        const response = await fetch(`${nvidiaBaseURL}/images/generations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${nvidiaApiKey}`,
          },
          body: JSON.stringify({
            model: modelId,
            prompt,
            size: `${width || 1024}x${height || 1024}`,
            n: 1,
            response_format: "b64_json",
          }),
          signal: AbortSignal.timeout(60000),
        });

        if (response.ok) {
          const data = await response.json();
          const imageBase64 = data?.data?.[0]?.b64_json;
          if (imageBase64) {
            console.log(`[ImageGen] ✅ Image generated via NVIDIA NIM ${modelId}`);
            return { success: true, imageBase64, source: `nvidia-${modelId}` };
          }
          const imageUrl = data?.data?.[0]?.url;
          if (imageUrl) {
            console.log(`[ImageGen] NVIDIA NIM ${modelId} returned URL, downloading...`);
            const imgResp = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
            if (imgResp.ok) {
              const imgBuf = Buffer.from(await imgResp.arrayBuffer());
              const base64 = imgBuf.toString("base64");
              console.log(`[ImageGen] ✅ Image generated via NVIDIA NIM ${modelId}`);
              return { success: true, imageBase64: base64, source: `nvidia-${modelId}` };
            }
          }
          console.warn(`[ImageGen] NVIDIA NIM ${modelId} returned no image data`);
        } else {
          const errorText = await response.text().catch(() => "Unknown error");
          errors.push(`NVIDIA-${modelId}: ${response.status}`);
          console.warn(`[ImageGen] NVIDIA NIM ${modelId} returned ${response.status}: ${errorText.substring(0, 200)}`);
        }
      } catch (nvidiaError) {
        errors.push(`NVIDIA-${modelId}: ${nvidiaError.message?.substring(0, 80)}`);
        console.warn(`[ImageGen] NVIDIA NIM ${modelId} failed:`, nvidiaError.message?.substring(0, 200));
      }
    }
  }

  // ─── Attempt 6: fal.ai FLUX.1 [dev] ───
  const falApiKey = process.env.FAL_API_KEY;
  if (falApiKey) {
    try {
      console.log("[ImageGen] Trying fal.ai FLUX.1 [dev]...");
      const [width, height] = size.split("x").map(Number);

      const response = await fetch("https://queue.fal.run/fal-ai/flux/dev", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Key ${falApiKey}`,
        },
        body: JSON.stringify({
          prompt,
          image_size: `${width || 1024}x${height || 1024}`,
          num_inference_steps: 28,
          guidance_scale: 3.5,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (response.ok) {
        const data = await response.json();
        const imageUrl = data?.images?.[0]?.url;
        if (imageUrl) {
          const imgResp = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
          if (imgResp.ok) {
            const imgBuf = Buffer.from(await imgResp.arrayBuffer());
            const imageBase64 = imgBuf.toString("base64");
            console.log(`[ImageGen] ✅ Image generated via fal.ai FLUX.1 [dev]`);
            return { success: true, imageBase64, source: "fal-flux-dev" };
          }
        }
        console.warn("[ImageGen] fal.ai returned no image URL");
      } else {
        const errorText = await response.text().catch(() => "Unknown error");
        errors.push(`fal.ai: ${response.status}`);
        console.warn(`[ImageGen] fal.ai returned ${response.status}: ${errorText.substring(0, 200)}`);
      }
    } catch (falError) {
      errors.push(`fal.ai: ${falError.message?.substring(0, 80)}`);
      console.warn("[ImageGen] fal.ai failed:", falError.message?.substring(0, 200));
    }
  }

  // ─── Attempt 7: Pollinations.ai (last resort, free) ───
  try {
    console.log("[ImageGen] Trying Pollinations.ai (last resort fallback)...");
    const [width, height] = size.split("x").map(Number);
    const encodedPrompt = encodeURIComponent(prompt);
    const seed = Math.floor(Math.random() * 1000000);

    // Try multiple Pollinations endpoints and models
    const pollinationsUrls = [
      // Primary: default model (auto)
      `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width || 1024}&height=${height || 1024}&seed=${seed}&nologo=true`,
      // Try with explicit model=flux
      `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width || 1024}&height=${height || 1024}&seed=${seed}&nologo=true&model=flux`,
      // Try the API endpoint instead of the image endpoint
      `https://api.pollinations.ai/v1/images?prompt=${encodedPrompt}&width=${width || 1024}&height=${height || 1024}&seed=${seed}&nologo=true`,
    ];

    for (const imageUrl of pollinationsUrls) {
      try {
        const response = await fetch(imageUrl, {
          signal: AbortSignal.timeout(30000),
          headers: { Accept: "image/png,image/*,*/*" },
        });

        if (!response.ok) {
          console.warn(`[ImageGen] Pollinations.ai URL returned ${response.status}`);
          continue;
        }

        const contentType = response.headers.get("content-type") || "";

        // If it's JSON (from API endpoint), parse it differently
        if (contentType.includes("application/json")) {
          try {
            const jsonData = await response.json();
            const imgBase64 = jsonData?.data?.[0]?.base64 || jsonData?.image;
            if (imgBase64) {
              console.log(`[ImageGen] ✅ Image via Pollinations.ai API`);
              return { success: true, imageBase64: imgBase64, source: "pollinations" };
            }
          } catch {}
          continue;
        }

        if (!contentType.includes("image") && !contentType.includes("octet-stream")) {
          console.warn(`[ImageGen] Pollinations.ai returned non-image: ${contentType}`);
          continue;
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (buffer.length < 500) {
          console.warn(`[ImageGen] Pollinations.ai returned too small image (${buffer.length} bytes)`);
          continue;
        }

        const imageBase64 = buffer.toString("base64");
        console.log(`[ImageGen] ✅ Image via Pollinations.ai (${(buffer.length / 1024).toFixed(0)}KB)`);
        return { success: true, imageBase64, source: "pollinations" };
      } catch (pollErr) {
        console.warn(`[ImageGen] Pollinations.ai endpoint failed: ${pollErr.message?.substring(0, 100)}`);
      }
    }
    throw new Error("All Pollinations.ai endpoints failed (402 or unavailable)");
  } catch (pollinationsError) {
    errors.push(`Pollinations: ${pollinationsError.message?.substring(0, 80)}`);
  }

  // ─── All methods failed ───
  console.error("[ImageGen] All image generation methods failed");
  console.error("[ImageGen] Errors:", errors.join(" | "));
  return {
    success: false,
    error: `Image generation failed. Providers tried: ${errors.join("; ")}`,
  };
}
