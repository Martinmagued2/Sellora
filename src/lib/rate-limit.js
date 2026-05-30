/**
 * Simple in-memory rate limiter
 * Protects against burst abuse (e.g. 10 requests / 10 seconds).
 * Note: In a serverless/multi-instance environment, this is local to the instance.
 * For true global rate limiting, a Redis store (e.g., Upstash) should be used.
 */

const rateLimits = new Map();

/**
 * Checks if a key has exceeded the limit within the time window.
 * 
 * @param {string} key - Unique identifier (e.g., user ID or IP address)
 * @param {number} limit - Max requests allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {boolean} - Returns true if limit is exceeded (rate limited), false otherwise
 */
export function isRateLimited(key, limit = 10, windowMs = 10000) {
  const now = Date.now();
  const record = rateLimits.get(key);

  if (!record) {
    // First request
    rateLimits.set(key, {
      count: 1,
      startTime: now
    });
    return false;
  }

  // If window has passed, reset the counter
  if (now - record.startTime > windowMs) {
    rateLimits.set(key, {
      count: 1,
      startTime: now
    });
    return false;
  }

  // Within the window, increment count
  record.count += 1;

  if (record.count > limit) {
    return true; // Rate limit exceeded
  }

  return false;
}

/**
 * Utility to periodically clear expired entries to prevent memory leaks
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimits.entries()) {
    // We assume the maximum window used is 1 minute (60000ms) for cleanup purposes
    if (now - record.startTime > 60000) {
      rateLimits.delete(key);
    }
  }
}, 60000); // Run every minute
