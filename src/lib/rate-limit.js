/**
 * Rate Limiter — In-memory with configurable windows
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
 * Note: In a serverless/multi-instance environment, this is local to the instance.
 * For true global rate limiting, use Upstash Redis or similar.
 */

const rateLimits = new Map();

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

/**
 * Checks if a key has exceeded the limit within the time window.
 *
 * @param {string} key - Unique identifier (e.g., IP + route, user ID)
 * @param {number|string} limit - Max requests allowed, or preset name from RATE_LIMITS
 * @param {number} windowMs - Time window in milliseconds (ignored if limit is a preset name)
 * @returns {{ limited: boolean, remaining: number, resetAt: number }}
 */
export function checkRateLimit(key, limit = 10, windowMs = 10000) {
  // If limit is a preset name, use its config
  if (typeof limit === 'string' && RATE_LIMITS[limit]) {
    windowMs = RATE_LIMITS[limit].windowMs;
    limit = RATE_LIMITS[limit].limit;
  }

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
 * Backwards-compatible wrapper — returns boolean (true = rate limited)
 */
export function isRateLimited(key, limit = 10, windowMs = 10000) {
  return checkRateLimit(key, limit, windowMs).limited;
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
//  Periodic cleanup to prevent memory leaks
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
