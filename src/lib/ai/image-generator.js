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
 * 1. ZAI SDK (works on the deployed platform via internal network)
 * 2. z-ai-generate CLI tool (uses same SDK via CLI, works on localhost)
 * 3. Pollinations.ai (free external fallback, lower quality)
 *
 * Returns: { success: true, imageBase64, source: "zai" | "cli" | "pollinations" }
 */

const ZAI_TIMEOUT_MS = 8000; // 8s timeout for ZAI SDK before falling back

/**
 * Generate a product image using AI with automatic fallback.
 * @param {string} prompt - The image generation prompt
 * @param {object} options - Optional: { size: "1024x1024" }
 * @returns {{ success: boolean, imageBase64?: string, source?: string, error?: string }}
 */
export async function generateProductImage(prompt, options = {}) {
  const size = options.size || "1024x1024";

  // ─── Attempt 1: ZAI SDK (direct API call) ───
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
      console.warn("[ImageGen] ZAI SDK unreachable (likely localhost/internal network), trying CLI fallback");
    } else {
      console.warn("[ImageGen] ZAI SDK failed:", msg.substring(0, 200));
    }
  }

  // ─── Attempt 2: z-ai-generate CLI tool ───
  // The CLI tool uses the same ZAI SDK but may route through a different
  // network path that works on localhost / development environments.
  try {
    console.log("[ImageGen] Trying z-ai-generate CLI...");
    const tmpFile = join(tmpdir(), `sellora-img-${Date.now()}.png`);

    const { stdout, stderr } = await execFileAsync(
      "z-ai-generate",
      ["-p", prompt, "-o", tmpFile, "-s", size],
      { timeout: 60000, encoding: "utf-8" }
    );

    // Read the generated image file
    const imageBuffer = await readFile(tmpFile);

    // Clean up temp file
    try { await unlink(tmpFile); } catch {}

    if (imageBuffer && imageBuffer.length > 1000) {
      const imageBase64 = imageBuffer.toString("base64");
      console.log(`[ImageGen] ✅ Image generated via z-ai-generate CLI (${(imageBuffer.length / 1024).toFixed(0)}KB)`);
      return { success: true, imageBase64, source: "cli" };
    }

    throw new Error("CLI output file was empty or too small");
  } catch (cliError) {
    const msg = cliError?.message || "";
    if (msg.includes("not found") || msg.includes("ENOENT") || msg.includes("command not found")) {
      console.warn("[ImageGen] z-ai-generate CLI not available, trying Pollinations.ai fallback");
    } else {
      console.warn("[ImageGen] z-ai-generate CLI failed:", msg.substring(0, 200));
    }
  }

  // ─── Attempt 3: Pollinations.ai (free, no API key, works everywhere) ───
  try {
    console.log("[ImageGen] Trying Pollinations.ai (fallback)...");
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

    console.log(`[ImageGen] ⚠️ Image generated via Pollinations.ai fallback (${(buffer.length / 1024).toFixed(0)}KB) — quality may be lower`);
    return { success: true, imageBase64, source: "pollinations" };
  } catch (pollinationsError) {
    console.error("[ImageGen] All image generation methods failed");
    return {
      success: false,
      error: `Image generation failed. All methods unavailable: ZAI SDK unreachable, z-ai-generate CLI not found, and Pollinations.ai fallback failed (${pollinationsError.message})`,
    };
  }
}
