import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ─── Mock @upstash/redis so we can simulate the Redis path ──
// vi.mock factories are hoisted to the top of the file, so any
// variables they reference must also be hoisted via vi.hoisted().
const {
  __mockIncr,
  __mockExpire,
  __mockMultiExec,
  mockPipeline,
  MockRedis,
} = vi.hoisted(() => {
  const __mockIncr = vi.fn();
  const __mockExpire = vi.fn();
  const __mockMultiExec = vi.fn();

  const mockPipeline = {
    incr: vi.fn(() => mockPipeline),
    expire: vi.fn(() => mockPipeline),
    exec: () => __mockMultiExec(),
  };

  const MockRedis = vi.fn().mockImplementation(() => ({
    incr: (...args) => __mockIncr(...args),
    expire: (...args) => __mockExpire(...args),
    multi: () => mockPipeline,
  }));

  return { __mockIncr, __mockExpire, __mockMultiExec, mockPipeline, MockRedis };
});

vi.mock("@upstash/redis", () => ({
  Redis: MockRedis,
}));

// ─── Imports (after mocks) ────────────────────────────────
import {
  RATE_LIMITS,
  checkRateLimit,
  isRateLimited,
  getClientIp,
  createRateLimitKey,
  rateLimitResponse,
  getRedisClient,
  __setRedisClientForTesting,
  __resetRateLimiterForTesting,
} from "@/lib/rate-limit";

// ─── Setup / teardown ─────────────────────────────────────
beforeEach(() => {
  __mockIncr.mockReset();
  __mockExpire.mockReset();
  __mockMultiExec.mockReset();
  __resetRateLimiterForTesting();
});

afterEach(() => {
  __resetRateLimiterForTesting();
  // Clean up env vars so we don't leak state between tests
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

// ─── RATE_LIMITS preset table ─────────────────────────────
describe("RATE_LIMITS preset table", () => {
  it("exposes all 12 expected tiers", () => {
    const expected = [
      "auth", "api", "api_read", "webhook", "admin", "email",
      "ai", "ai_image", "messaging", "broadcast", "public_spam", "payment",
    ];
    expect(Object.keys(RATE_LIMITS).sort()).toEqual(expected.sort());
  });

  it.each([
    ["auth",        5,  15 * 60 * 1000],
    ["api",         30, 60 * 1000],
    ["api_read",    60, 60 * 1000],
    ["webhook",     60, 60 * 1000],
    ["admin",       10, 5 * 60 * 1000],
    ["email",       5,  5 * 60 * 1000],
    ["ai",          10, 60 * 1000],
    ["ai_image",    3,  60 * 1000],
    ["messaging",   10, 60 * 1000],
    ["broadcast",   3,  5 * 60 * 1000],
    ["public_spam", 5,  10 * 60 * 1000],
    ["payment",     5,  60 * 1000],
  ])("tier '%s' has limit=%i and windowMs=%i", (tier, limit, windowMs) => {
    expect(RATE_LIMITS[tier].limit).toBe(limit);
    expect(RATE_LIMITS[tier].windowMs).toBe(windowMs);
  });
});

// ─── In-memory fallback (no Redis env vars) ───────────────
describe("checkRateLimit (in-memory fallback)", () => {
  beforeEach(() => {
    // Ensure env vars are NOT set
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    __resetRateLimiterForTesting();
  });

  it("returns limited:false on first request and decrements remaining", () => {
    const r = checkRateLimit("ip1", 5, 10000);
    expect(r.limited).toBe(false);
    expect(r.remaining).toBe(4);
    expect(typeof r.resetAt).toBe("number");
  });

  it("increments count on subsequent requests within the window", () => {
    checkRateLimit("ip2", 3, 10000);
    checkRateLimit("ip2", 3, 10000);
    const r = checkRateLimit("ip2", 3, 10000);
    expect(r.limited).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("returns limited:true once count exceeds limit", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("ip3", 3, 10000);
    const r = checkRateLimit("ip3", 3, 10000);
    expect(r.limited).toBe(true);
    expect(r.remaining).toBe(0);
  });

  it("resets the window after windowMs has elapsed (uses real timers)", async () => {
    // Use a 30ms window so the test is fast on real timers.
    checkRateLimit("ip4", 2, 30);
    checkRateLimit("ip4", 2, 30);
    expect(checkRateLimit("ip4", 2, 30).limited).toBe(true);

    // Wait for the window to elapse.
    await new Promise((resolve) => setTimeout(resolve, 50));

    const r = checkRateLimit("ip4", 2, 30);
    expect(r.limited).toBe(false);
    expect(r.remaining).toBe(1);
  });

  it("never returns negative remaining", () => {
    for (let i = 0; i < 10; i++) checkRateLimit("ip5", 2, 10000);
    const r = checkRateLimit("ip5", 2, 10000);
    expect(r.remaining).toBe(0);
  });

  it("tracks different keys independently", () => {
    checkRateLimit("ipA", 1, 10000);
    const a = checkRateLimit("ipA", 1, 10000);
    const b = checkRateLimit("ipB", 1, 10000);
    expect(a.limited).toBe(true);
    expect(b.limited).toBe(false);
  });

  it("resolves preset name to {limit, windowMs}", () => {
    const r = checkRateLimit("ip6", "ai");
    // ai = 10 / 1 min → first request leaves 9 remaining
    expect(r.limited).toBe(false);
    expect(r.remaining).toBe(9);
  });

  it("uses default limit/windowMs when none provided", () => {
    const r = checkRateLimit("ip7");
    // default limit=10, windowMs=10000 → first request → remaining 9
    expect(r.limited).toBe(false);
    expect(r.remaining).toBe(9);
  });
});

// ─── isRateLimited boolean wrapper ────────────────────────
describe("isRateLimited", () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    __resetRateLimiterForTesting();
  });

  it("returns false when under the limit", () => {
    expect(isRateLimited("ip8", 5, 10000)).toBe(false);
  });

  it("returns true once the limit is exceeded", () => {
    for (let i = 0; i < 5; i++) isRateLimited("ip9", 5, 10000);
    expect(isRateLimited("ip9", 5, 10000)).toBe(true);
  });

  it("returns a Promise<boolean> when Redis is enabled", async () => {
    // Use the shared mockPipeline so .exec() returns a controlled value.
    __mockMultiExec.mockResolvedValue([1, 1]);
    const fakeRedis = { multi: () => mockPipeline };
    __setRedisClientForTesting(fakeRedis);

    const result = isRateLimited("ip10", 5, 10000);
    expect(result).toBeInstanceOf(Promise);
    const limited = await result;
    expect(limited).toBe(false);
  });
});

// ─── Upstash Redis path ───────────────────────────────────
describe("checkRateLimit (Upstash Redis path)", () => {
  beforeEach(() => {
    // Inject a mock Redis client.
    __setRedisClientForTesting({
      multi: () => mockPipeline,
    });
  });

  it("uses INCR + EXPIRE pattern with key 'ratelimit:<key>'", async () => {
    __mockMultiExec.mockResolvedValue([1, 1]);

    const r = await checkRateLimit("user-1", 5, 60000);

    // Pipeline should have been called with .incr("ratelimit:user-1")
    expect(mockPipeline.incr).toHaveBeenCalledWith("ratelimit:user-1");
    // .expire should be called with the key, ttl in seconds, and { nx: true }
    expect(mockPipeline.expire).toHaveBeenCalledWith(
      "ratelimit:user-1",
      60, // 60000ms / 1000 = 60s
      { nx: true }
    );
    expect(r.limited).toBe(false);
    expect(r.remaining).toBe(4);
  });

  it("returns limited:true when count > limit", async () => {
    __mockMultiExec.mockResolvedValue([6, 1]); // count=6, limit=5

    const r = await checkRateLimit("user-2", 5, 60000);
    expect(r.limited).toBe(true);
    expect(r.remaining).toBe(0);
  });

  it("returns limited:false when count === limit (boundary)", async () => {
    __mockMultiExec.mockResolvedValue([5, 1]); // count=5, limit=5

    const r = await checkRateLimit("user-3", 5, 60000);
    expect(r.limited).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("falls back to in-memory when Redis throws", async () => {
    __mockMultiExec.mockRejectedValue(new Error("redis down"));

    // First call should fail-over to in-memory and succeed.
    const r = await checkRateLimit("user-4", 5, 10000);
    expect(r.limited).toBe(false);
    expect(r.remaining).toBe(4);
  });

  it("resolves preset name on the Redis path too", async () => {
    __mockMultiExec.mockResolvedValue([1, 1]);

    const r = await checkRateLimit("user-5", "ai");
    expect(r.limited).toBe(false);
    // ai limit = 10 → remaining 9
    expect(r.remaining).toBe(9);
    // EXPIRE should use 60s (1 minute window)
    expect(mockPipeline.expire).toHaveBeenCalledWith(
      "ratelimit:user-5",
      60,
      { nx: true }
    );
  });
});

// ─── getRedisClient ───────────────────────────────────────
describe("getRedisClient", () => {
  it("returns null when env vars are missing", () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    __resetRateLimiterForTesting();
    expect(getRedisClient()).toBeNull();
  });

  it("returns a client when env vars are set", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.test";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    __resetRateLimiterForTesting();
    const client = getRedisClient();
    expect(client).toBeDefined();
    expect(typeof client.incr).toBe("function");
  });

  it("caches the client across calls", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.test";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    __resetRateLimiterForTesting();
    const a = getRedisClient();
    const b = getRedisClient();
    expect(a).toBe(b);
  });
});

// ─── getClientIp / createRateLimitKey ─────────────────────
describe("getClientIp", () => {
  function makeReq(headers = {}) {
    return {
      headers: {
        get: (name) => headers[name.toLowerCase()] || null,
      },
    };
  }

  it("prefers x-forwarded-for and strips the first IP only", () => {
    const req = makeReq({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is missing", () => {
    const req = makeReq({ "x-real-ip": "9.9.9.9" });
    expect(getClientIp(req)).toBe("9.9.9.9");
  });

  it("falls back to cf-connecting-ip", () => {
    const req = makeReq({ "cf-connecting-ip": "8.8.8.8" });
    expect(getClientIp(req)).toBe("8.8.8.8");
  });

  it("returns 'unknown' when no IP header is present", () => {
    const req = makeReq({});
    expect(getClientIp(req)).toBe("unknown");
  });
});

describe("createRateLimitKey", () => {
  it("combines IP, path, and optional suffix", () => {
    const req = {
      url: "https://test.test/api/foo?bar=baz",
      headers: new Map(),
      method: "GET",
    };
    // Mock headers.get to return a controlled IP
    req.headers.get = (name) =>
      name === "x-forwarded-for" ? "1.2.3.4" : null;
    expect(createRateLimitKey(req)).toBe("1.2.3.4:/api/foo");
    expect(createRateLimitKey(req, "login")).toBe("1.2.3.4:/api/foo:login");
  });

  it("works without a suffix", () => {
    const req = {
      url: "https://test.test/health",
      headers: new Map(),
    };
    req.headers.get = () => "1.1.1.1";
    expect(createRateLimitKey(req)).toBe("1.1.1.1:/health");
  });
});

// ─── rateLimitResponse ────────────────────────────────────
describe("rateLimitResponse", () => {
  it("returns a 429 response with Retry-After header", async () => {
    const resetAt = Date.now() + 5000; // 5s in the future
    const res = rateLimitResponse(resetAt);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(res.headers.get("X-RateLimit-Reset")).toBeTruthy();
    const json = await res.json();
    expect(json.error).toBeDefined();
    expect(typeof json.retryAfter).toBe("number");
  });

  it("still returns 429 even when resetAt is already in the past", async () => {
    const resetAt = Date.now() - 1000; // already elapsed
    const res = rateLimitResponse(resetAt);
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(typeof json.retryAfter).toBe("number");
  });
});
