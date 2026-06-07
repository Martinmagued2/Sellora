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
 * 1. ZAI SDK (works on the deployed platform, fastest)
 * 2. z-ai-generate CLI tool (works on server environments)
 * 3. NVIDIA NIM (qwen-image, FLUX.2-klein — same key as text AI)
 * 4. fal.ai FLUX.1 [dev] (best quality, $10 free credits)
 * 5. Gemini 2.5 Flash Image Generation
 * 6. Together AI FLUX.1-schnell-Free
 * 7. Pollinations.ai (free, no key needed — may require payment now)
 *
 * Returns: { success: boolean, imageBase64?: string, source?: string, error?: string }
 */

const ZAI_TIMEOUT_MS = 30000;

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

  // ─── Attempt 1: ZAI SDK (direct API call) — MOVED TO TOP ───
  // Works reliably on the deployed platform, no extra keys needed
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

  // ─── Attempt 2: z-ai-generate CLI tool ───
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
    if (msg.includes("not found") || msg.includes("ENOENT") || msg.includes("command not found")) {
      console.warn("[ImageGen] z-ai-generate CLI not available, trying next method");
    } else {
      console.warn("[ImageGen] z-ai-generate CLI failed:", msg.substring(0, 200));
    }
  }

  // ─── Attempt 3: NVIDIA NIM Image Generation ───
  // Uses the SAME NVIDIA_API_KEY as the text AI — no extra key needed!
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
            console.log(`[ImageGen] ✅ Image generated via NVIDIA NIM ${modelId} (${(imageBase64.length / 1024).toFixed(0)}KB base64)`);
            return { success: true, imageBase64, source: `nvidia-${modelId}` };
          }
          const imageUrl = data?.data?.[0]?.url;
          if (imageUrl) {
            console.log(`[ImageGen] NVIDIA NIM ${modelId} returned URL, downloading...`);
            const imgResp = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
            if (imgResp.ok) {
              const imgBuf = Buffer.from(await imgResp.arrayBuffer());
              const base64 = imgBuf.toString("base64");
              console.log(`[ImageGen] ✅ Image generated via NVIDIA NIM ${modelId} (${(imgBuf.length / 1024).toFixed(0)}KB)`);
              return { success: true, imageBase64: base64, source: `nvidia-${modelId}` };
            }
          }
          console.warn(`[ImageGen] NVIDIA NIM ${modelId} returned no image data`);
        } else {
          const errorText = await response.text().catch(() => "Unknown error");
          console.warn(`[ImageGen] NVIDIA NIM ${modelId} returned ${response.status}: ${errorText.substring(0, 200)}`);
        }
      } catch (nvidiaError) {
        console.warn(`[ImageGen] NVIDIA NIM ${modelId} failed:`, nvidiaError.message?.substring(0, 200));
      }
    }
  }

  // ─── Attempt 4: fal.ai FLUX.1 [dev] (Best Quality) ───
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
            console.log(`[ImageGen] ✅ Image generated via fal.ai FLUX.1 [dev] (${(imgBuf.length / 1024).toFixed(0)}KB)`);
            return { success: true, imageBase64, source: "fal-flux-dev" };
          }
        }
        console.warn("[ImageGen] fal.ai returned no image URL in response");
      } else {
        const errorText = await response.text().catch(() => "Unknown error");
        console.warn(`[ImageGen] fal.ai returned ${response.status}: ${errorText.substring(0, 200)}`);
      }
    } catch (falError) {
      console.warn("[ImageGen] fal.ai failed:", falError.message?.substring(0, 200));
    }
  }

  // ─── Attempt 5: Gemini Image Generation (via REST API) ───
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
          console.warn(`[ImageGen] Gemini ${modelName} returned no image data`);
        } else {
          const errorData = await response.json().catch(() => ({}));
          const errMsg = errorData?.error?.message || `HTTP ${response.status}`;
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

  // ─── Attempt 6: Together AI (FLUX.1-schnell-Free) ───
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
  }

  // ─── Attempt 7: Pollinations.ai (last resort, may return 402) ───
  try {
    console.log("[ImageGen] Trying Pollinations.ai (last resort fallback)...");
    const [width, height] = size.split("x").map(Number);
    const encodedPrompt = encodeURIComponent(prompt);
    const seed = Math.floor(Math.random() * 1000000);

    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width || 1024}&height=${height || 1024}&seed=${seed}&nologo=true&model=flux`;

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

    console.log(`[ImageGen] ✅ Image via Pollinations.ai (${(buffer.length / 1024).toFixed(0)}KB)`);
    return { success: true, imageBase64, source: "pollinations" };
  } catch (pollinationsError) {
    console.error("[ImageGen] All image generation methods failed");
    return {
      success: false,
      error: `Image generation failed. All providers exhausted. Last error: ${pollinationsError.message}. Tips: (1) Add TOGETHER_API_KEY from https://api.together.xyz (free), or (2) Add FAL_API_KEY from https://fal.ai ($10 free credits), or (3) Gemini image gen may not be available in all regions.`,
    };
  }
}
