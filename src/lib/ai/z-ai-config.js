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
 * SECURITY: This module NO LONGER writes secrets to the filesystem.
 * Config files are only READ (never written) as a fallback.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import os from "os";

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

// Read config from file system (READ ONLY — never writes)
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
          // SECURITY FIX: No longer copies config to project dir
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
 *
 * SECURITY: No longer writes API keys to the filesystem.
 */
export function getZAIConfig() {
  // 1. Try environment variables first (works on Vercel/production)
  const envConfig = getConfigFromEnv();
  if (envConfig) {
    console.log("[Z-AI-Config] Using config from environment variables");
    // SECURITY FIX: No longer writes env config to file
    return envConfig;
  }

  // 2. Try config files (works in development) — READ ONLY
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
