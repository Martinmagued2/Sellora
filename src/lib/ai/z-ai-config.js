import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import os from "os";

/**
 * Ensure .z-ai-config exists in the project directory for z-ai-web-dev-sdk.
 * The SDK searches: process.cwd()/.z-ai-config → ~/.z-ai-config → /etc/.z-ai-config
 * If the project dir doesn't have it, we copy from /etc/ or ~/ (whichever has a valid config).
 */
export function ensureZAIConfig() {
  const cwd = process.cwd();
  const projectConfigPath = join(cwd, ".z-ai-config");
  const homeDir = os.homedir();
  const fallbackPaths = [
    join(homeDir, ".z-ai-config"),
    "/etc/.z-ai-config",
  ];

  // Check if project config exists and is valid
  if (existsSync(projectConfigPath)) {
    try {
      const config = JSON.parse(readFileSync(projectConfigPath, "utf-8"));
      if (config.baseUrl && config.apiKey) return true;
    } catch {}
  }

  // Try to copy from fallback locations
  for (const fallbackPath of fallbackPaths) {
    try {
      if (existsSync(fallbackPath)) {
        const config = JSON.parse(readFileSync(fallbackPath, "utf-8"));
        if (config.baseUrl && config.apiKey) {
          writeFileSync(projectConfigPath, JSON.stringify(config, null, 2));
          console.log("[Z-AI-Config] Copied from", fallbackPath, "to", projectConfigPath);
          return true;
        }
      }
    } catch {}
  }

  console.warn("[Z-AI-Config] Could not find valid config in any location. Image generation may fail.");
  return false;
}
