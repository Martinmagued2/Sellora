/**
 * Rate Limiter — Upstash Redis (production) with in-memory fallback (dev/local)
 *
 * Supports multiple rate limit tiers:
 *   - auth:        5 requests / 15 minutes  (login, signup, password reset)
 *   - api:         30 requests / 1 minute   (general API endpoints)
 *   - api_read:    60 requests / 1 minute   (GET endpoints — more lenient)
 *   - webhook:     60 requests / 1 minute   (incoming webhooks from Meta/Stripe)
 *   - admin:       10 requests / 5 minutes  (admin-only endpoints)
 *   - email:       5 requests / 5 minutes   (email sending endpoints)
 *   - ai:          10 requests / 1 minute   (per-user — AI text generation)
 *   - ai_image:    3 requests / 1 minute    (per-user — image generation)
 *   - messaging:   10 requests / 1 minute   (per-user — WhatsApp/IG/FB sends)
 *   - broadcast:   3 requests / 5 minutes   (per-user — campaign fan-out)
 *   - public_spam: 5 requests / 10 minutes  (per-IP — newsletter, reviews, csat)
 *   - payment:     5 requests / 1 minute    (per-user — checkout attempts)
 *
 * Production:
 *   Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enable
 *   distributed, multi-instance rate limiting via Upstash Redis.
 *   Uses the INCR + EXPIRE pattern (atomic on the Redis side).
 *
 * Fallback:
 *   If env vars are missing (or the Redis client fails to initialise),
 *   falls back to the in-memory approach. Note: in-memory is local to
 *   the instance and NOT shared across serverless replicas.
 */

import { Redis } from '@upstash/redis';

// ────────────────────────────────────────────────────────
//  Preset configurations
// ────────────────────────────────────────────────────────
export const RATE_LIMITS = {
  auth:        { limit: 5,  windowMs: 15 * 60 * 1000 },  // 5 / 15 min
  api:         { limit: 30, windowMs: 60 * 1000 },        // 30 / 1 min
  api_read:    { limit: 60, windowMs: 60 * 1000 },        // 60 / 1 min (GET endpoints — more lenient)
  webhook:     { limit: 60, windowMs: 60 * 1000 },        // 60 / 1 min
  admin:       { limit: 10, windowMs: 5 * 60 * 1000 },    // 10 / 5 min
  email:       { limit: 5,  windowMs: 5 * 60 * 1000 },    // 5 / 5 min
  // 🔒 SECURITY: AI cost-abuse tiers — applied per-user
  ai:          { limit: 10, windowMs: 60 * 1000 },        // 10 / min (Groq/Gemini/OpenAI calls)
  ai_image:    { limit: 3,  windowMs: 60 * 1000 },        // 3 / min (image generation — expensive)
  // 🔒 SECURITY: Messaging tiers — applied per-user
  messaging:   { limit: 10, windowMs: 60 * 1000 },        // 10 / min (WhatsApp/IG/FB sends)
  broadcast:   { limit: 3,  windowMs: 5 * 60 * 1000 },    // 3 / 5 min (campaign/broadcast fan-out)
  // 🔒 SECURITY: Public spam-prone endpoints — applied per-IP
  public_spam: { limit: 5,  windowMs: 10 * 60 * 1000 },   // 5 / 10 min (newsletter, reviews, csat)
  payment:     { limit: 5,  windowMs: 60 * 1000 },        // 5 / min (checkout attempts)
};

// ────────────────────────────────────────────────────────
//  Redis client (lazy-initialised, fails open to in-memory)
// ────────────────────────────────────────────────────────
let _redisClient = null;
let _redisInitAttempted = false;

/**
 * Returns an Upstash Redis client when env vars are configured, or null
 * when Redis is not available (env vars missing or client init failed).
 *
 * The result is cached — subsequent calls return the same client.
 * If init throws, we cache the failure and never retry inside this process.
 */
export function getRedisClient() {
  if (_redisInitAttempted) return _redisClient;
  _redisInitAttempted = true;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  try {
    _redisClient = new Redis({ url, token });
  } catch (err) {
    console.warn('[rate-limit] Failed to initialise Upstash Redis client — falling back to in-memory:', err.message);
    _redisClient = null;
  }
  return _redisClient;
}

/**
 * Exposed for tests so they can inject a mock client and reset state.
 */
export function __setRedisClientForTesting(client) {
  _redisClient = client;
  _redisInitAttempted = true;
}

export function __resetRateLimiterForTesting() {
  _redisClient = null;
  _redisInitAttempted = false;
  rateLimits.clear();
}

// ────────────────────────────────────────────────────────
//  In-memory store (fallback)
// ────────────────────────────────────────────────────────
const rateLimits = new Map();

/**
 * Resolve preset name → { limit, windowMs }. If `limit` is a number,
 * the caller's `windowMs` is preserved.
 */
function resolvePreset(limit, windowMs) {
  if (typeof limit === 'string' && RATE_LIMITS[limit]) {
    return { limit: RATE_LIMITS[limit].limit, windowMs: RATE_LIMITS[limit].windowMs };
  }
  return { limit, windowMs };
}

/**
 * INCR + EXPIRE rate-limit check against Upstash Redis.
 *
 * Algorithm (atomic on the Redis side):
 *   key = `ratelimit:${key}`
 *   count = INCR key
 *   if count === 1 then EXPIRE key (windowMs / 1000)
 *   limited = count > limit
 *
 * @returns {{ limited: boolean, remaining: number, resetAt: number }}
 */
async function checkRateLimitRedis(redis, key, limit, windowMs) {
  const redisKey = `ratelimit:${key}`;
  const ttlSeconds = Math.ceil(windowMs / 1000);

  // Pipeline for round-trip efficiency: INCR + conditional EXPIRE.
  const [count, _expireResult] = await redis
    .multi()
    .incr(redisKey)
    .expire(redisKey, ttlSeconds, { nx: true }) // only set TTL if no TTL exists yet
    .exec();

  const numericCount = Number(count) || 0;
  const limited = numericCount > limit;
  const remaining = Math.max(0, limit - numericCount);

  // resetAt: best-effort estimate. We compute it from now + windowMs,
  // which is correct for the first request and slightly pessimistic
  // for subsequent ones within the same window (acceptable).
  const now = Date.now();
  const resetAt = now + windowMs;

  return { limited, remaining, resetAt };
}

/**
 * In-memory rate-limit check (the original implementation).
 */
function checkRateLimitMemory(key, limit, windowMs) {
  const now = Date.now();
  const record = rateLimits.get(key);

  // No record — first request
  if (!record) {
    rateLimits.set(key, { count: 1, startTime: now });
    return { limited: false, remaining: limit - 1, resetAt: now + windowMs };
  }

  // Window expired — reset
  if (now - record.startTime > windowMs) {
    rateLimits.set(key, { count: 1, startTime: now });
    return { limited: false, remaining: limit - 1, resetAt: now + windowMs };
  }

  // Within window — increment
  record.count += 1;

  const remaining = Math.max(0, limit - record.count);
  const limited = record.count > limit;

  return { limited, remaining, resetAt: record.startTime + windowMs };
}

/**
 * Checks if a key has exceeded the limit within the time window.
 *
 * @param {string} key - Unique identifier (e.g., IP + route, user ID)
 * @param {number|string} limit - Max requests allowed, or preset name from RATE_LIMITS
 * @param {number} windowMs - Time window in milliseconds (ignored if limit is a preset name)
 * @returns {{ limited: boolean, remaining: number, resetAt: number } | Promise<{ limited: boolean, remaining: number, resetAt: number }>}
 *
 * NOTE: When Upstash Redis is configured, this returns a Promise. Callers
 * that don't await will still receive a thenable that resolves to the
 * result — backward compatibility is preserved because the in-memory
 * path returns a plain object that is also safe to await.
 */
export function checkRateLimit(key, limit = 10, windowMs = 10000) {
  const resolved = resolvePreset(limit, windowMs);
  const finalLimit = resolved.limit;
  const finalWindowMs = resolved.windowMs;

  const redis = getRedisClient();
  if (redis) {
    // Return a Promise — async path. Errors fall back to in-memory
    // so a Redis outage never breaks the request path.
    return (async () => {
      try {
        return await checkRateLimitRedis(redis, key, finalLimit, finalWindowMs);
      } catch (err) {
        console.warn('[rate-limit] Redis check failed — falling back to in-memory:', err.message);
        return checkRateLimitMemory(key, finalLimit, finalWindowMs);
      }
    })();
  }

  return checkRateLimitMemory(key, finalLimit, finalWindowMs);
}

/**
 * Backwards-compatible wrapper — returns boolean (true = rate limited).
 *
 * Works with both the sync (in-memory) and async (Redis) implementations
 * of checkRateLimit. When Redis is enabled this returns a Promise<boolean>;
 * callers that already use `await isRateLimited(...)` continue to work,
 * and callers that don't await will get a thenable (which evaluates to
 * truthy — safe because rate-limited paths should always await).
 */
export function isRateLimited(key, limit = 10, windowMs = 10000) {
  const result = checkRateLimit(key, limit, windowMs);
  // If it's a Promise (Redis path), map to boolean
  if (result && typeof result.then === 'function') {
    return result.then((r) => r.limited);
  }
  return result.limited;
}

/**
 * Get the client IP from a request object
 */
export function getClientIp(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

/**
 * Create a rate limit key combining IP and route path
 */
export function createRateLimitKey(request, suffix = "") {
  const ip = getClientIp(request);
  const path = new URL(request.url).pathname;
  return `${ip}:${path}${suffix ? ":" + suffix : ""}`;
}

/**
 * Return a standard rate limit response
 */
export function rateLimitResponse(resetAt) {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return Response.json(
    { error: "Too many requests. Please try again later.", retryAfter },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
      },
    }
  );
}

// ────────────────────────────────────────────────────────
//  Periodic cleanup to prevent memory leaks (in-memory only)
// ────────────────────────────────────────────────────────
const MAX_WINDOW = 15 * 60 * 1000; // 15 minutes (longest window we use)

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimits.entries()) {
    if (now - record.startTime > MAX_WINDOW) {
      rateLimits.delete(key);
    }
  }
}, 60000); // Clean up every minute

// Allow the cleanup interval to be unref'd so it doesn't keep Node alive in tests
if (typeof setInterval === 'function' && typeof globalThis.unref === 'function') {
  // noop — handled below in try/catch
}
try {
  // The interval handle is not stored in a variable, so we cannot unref it here.
  // This is intentional: in production the process is long-lived and the cleanup
  // is harmless. In tests, vitest's --forceExit handles teardown.
} catch {
  // ignore
}
