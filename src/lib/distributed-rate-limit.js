/**
 * Distributed Rate Limiter using Upstash Redis REST API.
 *
 * PROBLEM
 - The in-memory rate limiter in src/lib/rate-limit.js resets on every
 * serverless cold start (Vercel), so it provides NO real rate limiting
 * in production. An attacker can simply wait for a cold start between
 * bursts.
 *
 * SOLUTION
 * Use Upstash Redis (serverless Redis with REST API) for distributed
 * rate limiting. Upstash is free for the first 10K requests/day — plenty
 * for rate limit checks.
 *
 * SETUP
 * 1. Sign up at https://upstash.com (free)
 * 2. Create a Redis database
 * 3. Get UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 * 4. Add them to Vercel env vars
 *
 * BEHAVIOR
 * - If UPSTASH env vars are set → uses distributed rate limiting (correct
 *   behavior across all serverless instances)
 * - If UPSTASH env vars are NOT set → falls back to in-memory rate limiting
 *   (same as before — at least we don't break existing functionality)
 *
 * USAGE
 *   import { checkDistributedRateLimit } from "@/lib/distributed-rate-limit";
 *   const result = await checkDistributedRateLimit(userId, "auth");
 *   if (result.limited) return Response.json({ error: "Too many requests" }, { status: 429 });
 */

const RATE_LIMITS = {
  auth:        { limit: 5,  windowSec: 15 * 60 },  // 5 / 15 min
  api:         { limit: 30, windowSec: 60 },        // 30 / 1 min
  api_read:    { limit: 60, windowSec: 60 },        // 60 / 1 min
  webhook:     { limit: 60, windowSec: 60 },        // 60 / 1 min
  admin:       { limit: 10, windowSec: 5 * 60 },    // 10 / 5 min
  email:       { limit: 5,  windowSec: 5 * 60 },    // 5 / 5 min
  ai_chat:     { limit: 50, windowSec: 60 },        // 50 / 1 min (per user)
  live_chat:   { limit: 10, windowSec: 5 * 60 },    // 10 / 5 min (per IP)
  file_upload: { limit: 20, windowSec: 60 },        // 20 / 1 min (per user)
};

// In-memory fallback (same as src/lib/rate-limit.js)
const _memMap = new Map();

function checkInMemory(key, limit, windowSec) {
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const record = _memMap.get(key);
  if (!record) {
    _memMap.set(key, { count: 1, startTime: now });
    return { limited: false, remaining: limit - 1, resetAt: now + windowMs };
  }
  if (now - record.startTime > windowMs) {
    _memMap.set(key, { count: 1, startTime: now });
    return { limited: false, remaining: limit - 1, resetAt: now + windowMs };
  }
  record.count += 1;
  const limited = record.count > limit;
  return {
    limited,
    remaining: Math.max(0, limit - record.count),
    resetAt: record.startTime + windowMs,
  };
}

/**
 * Check rate limit using Upstash Redis (with in-memory fallback).
 *
 * @param {string} key - Unique identifier (e.g., `user:${userId}` or `ip:${ip}`)
 * @param {string|number} limitOrPreset - Preset name (e.g., "auth") or numeric limit
 * @param {number} [windowSec] - Window in seconds (required if limitOrPreset is numeric)
 * @returns {Promise<{limited: boolean, remaining: number, resetAt: number, distributed: boolean}>}
 */
export async function checkDistributedRateLimit(key, limitOrPreset = "api", windowSec) {
  let limit, window;
  if (typeof limitOrPreset === "string" && RATE_LIMITS[limitOrPreset]) {
    limit = RATE_LIMITS[limitOrPreset].limit;
    window = RATE_LIMITS[limitOrPreset].windowSec;
  } else {
    limit = Number(limitOrPreset) || 30;
    window = Number(windowSec) || 60;
  }

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Fallback to in-memory if Upstash not configured
  if (!upstashUrl || !upstashToken) {
    const result = checkInMemory(key, limit, window);
    return { ...result, distributed: false };
  }

  // Upstash Redis REST API: use INCR + EXPIRE pipeline
  // Key format: rl:{key}:{windowStart}
  const windowStart = Math.floor(Date.now() / 1000 / window);
  const redisKey = `rl:${key}:${windowStart}`;

  try {
    // Pipeline: INCR + EXPIRE (only set expire on first increment)
    const pipelineUrl = `${upstashUrl}/pipeline`;
    const response = await fetch(pipelineUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${upstashToken}`,
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["EXPIRE", redisKey, window],
      ]),
    });

    if (!response.ok) {
      console.warn("[RATE-LIMIT] Upstash error, falling back to in-memory:", response.status);
      const result = checkInMemory(key, limit, window);
      return { ...result, distributed: false };
    }

    const data = await response.json();
    // data is an array of results: [{result: <count>}, {result: 1|0}]
    const count = data?.[0]?.result || 1;
    const limited = count > limit;
    const remaining = Math.max(0, limit - count);
    const resetAt = (windowStart + 1) * window * 1000;

    return { limited, remaining, resetAt, distributed: true };
  } catch (e) {
    console.warn("[RATE-LIMIT] Upstash fetch failed, falling back to in-memory:", e.message);
    const result = checkInMemory(key, limit, window);
    return { ...result, distributed: false };
  }
}

/**
 * Convenience helper for the auth tier (login, signup, password reset, 2FA verify).
 */
export async function checkAuthRateLimit(identifier) {
  return checkDistributedRateLimit(`auth:${identifier}`, "auth");
}

/**
 * Convenience helper for AI chat rate limiting.
 */
export async function checkAiChatRateLimit(userId) {
  return checkDistributedRateLimit(`ai:${userId}`, "ai_chat");
}
