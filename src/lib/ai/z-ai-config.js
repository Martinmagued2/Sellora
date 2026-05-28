import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import os from "os";

/**
 * Get the ZAI SDK config, preferring environment variables over config files.
 *
 * Environment variables (recommended for production/Vercel):
 *   ZAI_BASE_URL  - API base URL (e.g. https://internal-api.z.ai/v1)
 *   ZAI_API_KEY   - API key
 *   ZAI_CHAT_ID   - Optional chat ID
 *   ZAI_USER_ID   - Optional user ID
 *   ZAI_TOKEN     - Optional auth token
 *
 * Config file fallback (.z-ai-config):
 *   Searches: process.cwd() → ~/.z-ai-config → /etc/.z-ai-config
 */

// Read config from environment variables
function getConfigFromEnv() {
  const baseUrl = process.env.ZAI_BASE_URL;
  const apiKey = process.env.ZAI_API_KEY;
  if (baseUrl && apiKey) {
    return {
      baseUrl,
      apiKey,
      chatId: process.env.ZAI_CHAT_ID || undefined,
      userId: process.env.ZAI_USER_ID || undefined,
      token: process.env.ZAI_TOKEN || undefined,
    };
  }
  return null;
}

// Read config from file system
function getConfigFromFile() {
  const cwd = process.cwd();
  const homeDir = os.homedir();
  const configPaths = [
    join(cwd, ".z-ai-config"),
    join(homeDir, ".z-ai-config"),
    "/etc/.z-ai-config",
  ];

  for (const configPath of configPaths) {
    try {
      if (existsSync(configPath)) {
        const config = JSON.parse(readFileSync(configPath, "utf-8"));
        if (config.baseUrl && config.apiKey) {
          // Also write to project dir so the SDK can find it there too
          if (configPath !== join(cwd, ".z-ai-config")) {
            try {
              writeFileSync(join(cwd, ".z-ai-config"), JSON.stringify(config, null, 2));
              console.log("[Z-AI-Config] Copied config from", configPath, "to project dir");
            } catch {}
          }
          return config;
        }
      }
    } catch {}
  }
  return null;
}

/**
 * Get ZAI SDK config object. Returns null if no config found.
 * Use this to construct `new ZAI(config)` directly, bypassing ZAI.create().
 * Also writes the config to .z-ai-config file as a safety net.
 */
export function getZAIConfig() {
  // 1. Try environment variables first (works on Vercel/production)
  const envConfig = getConfigFromEnv();
  if (envConfig) {
    // Safety net: write env config to file so ZAI.create() would also work
    try {
      const cwd = process.cwd();
      const configPath = join(cwd, ".z-ai-config");
      writeFileSync(configPath, JSON.stringify(envConfig, null, 2));
    } catch {}
    console.log("[Z-AI-Config] Using config from environment variables");
    return envConfig;
  }

  // 2. Try config files (works in development)
  const fileConfig = getConfigFromFile();
  if (fileConfig) {
    console.log("[Z-AI-Config] Using config from file");
    return fileConfig;
  }

  console.error("[Z-AI-Config] No config found!");
  console.error("[Z-AI-Config] Env vars: ZAI_BASE_URL=%s, ZAI_API_KEY=%s", process.env.ZAI_BASE_URL || "(not set)", process.env.ZAI_API_KEY ? "(set)" : "(not set)");
  console.error("[Z-AI-Config] Set ZAI_BASE_URL + ZAI_API_KEY in .env.local, or create .z-ai-config file");
  return null;
}
