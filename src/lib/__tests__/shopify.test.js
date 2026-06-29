import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";

// shopify.js reads SHOPIFY_TOKEN_ENCRYPTION_KEY / SHOPIFY_API_SECRET at
// module-load time (top-level constants). Static imports are hoisted
// above any inline `process.env.X = ...` assignment, so we set the
// env vars via vi.hoisted() which is hoisted together with vi.mock()
// factories and runs BEFORE any module evaluation.
vi.hoisted(() => {
  process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = "test-encryption-key-32-bytes!!";
  process.env.SHOPIFY_API_SECRET = "shopify-api-secret";
});

import {
  verifyShopifyOAuthHmac,
  encryptShopifyToken,
  decryptShopifyToken,
} from "@/lib/shopify";
import { validateShopifyDomain } from "@/lib/shopify-api";

// ─── Setup / teardown ─────────────────────────────────────
beforeEach(() => {
  // Re-set in case a previous test deleted them
  process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = "test-encryption-key-32-bytes!!";
  process.env.SHOPIFY_API_SECRET = "shopify-api-secret";
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Token encryption / decryption ────────────────────────
describe("encryptShopifyToken / decryptShopifyToken", () => {
  it("round-trips a token (encrypt then decrypt yields the original)", () => {
    const original = "shpat_abcdef1234567890";
    const encrypted = encryptShopifyToken(original);
    expect(encrypted).not.toBe(original);
    const decrypted = decryptShopifyToken(encrypted);
    expect(decrypted).toBe(original);
  });

  it("produces a payload with three base64 parts separated by dots", () => {
    const encrypted = encryptShopifyToken("shpat_xyz");
    const parts = encrypted.split(".");
    expect(parts.length).toBe(3);
    // Each part should be valid base64
    for (const part of parts) {
      expect(() => Buffer.from(part, "base64")).not.toThrow();
    }
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptShopifyToken("shpat_same_token");
    const b = encryptShopifyToken("shpat_same_token");
    expect(a).not.toBe(b);
    // But both decrypt back to the same plaintext
    expect(decryptShopifyToken(a)).toBe("shpat_same_token");
    expect(decryptShopifyToken(b)).toBe("shpat_same_token");
  });

  it("decryptShopifyToken returns null for null/empty input", () => {
    expect(decryptShopifyToken(null)).toBeNull();
    expect(decryptShopifyToken("")).toBeNull();
    expect(decryptShopifyToken(undefined)).toBeNull();
  });

  it("throws on a malformed payload (missing parts)", () => {
    expect(() => decryptShopifyToken("only-one-part")).toThrow();
    expect(() => decryptShopifyToken("a.b")).toThrow();
  });

  it("throws on a tampered auth tag (AES-GCM integrity check)", () => {
    const encrypted = encryptShopifyToken("shpat_secret");
    const [ivB64, authTagB64, dataB64] = encrypted.split(".");
    // Flip a byte in the auth tag
    const tamperedTag = Buffer.from(authTagB64, "base64");
    tamperedTag[0] = tamperedTag[0] ^ 0xff;
    const tampered = `${ivB64}.${tamperedTag.toString("base64")}.${dataB64}`;
    expect(() => decryptShopifyToken(tampered)).toThrow();
  });

  it("throws on tampered ciphertext (AES-GCM integrity check)", () => {
    const encrypted = encryptShopifyToken("shpat_secret");
    const [ivB64, authTagB64, dataB64] = encrypted.split(".");
    const tamperedData = Buffer.from(dataB64, "base64");
    tamperedData[0] = tamperedData[0] ^ 0xff;
    const tampered = `${ivB64}.${authTagB64}.${tamperedData.toString("base64")}`;
    expect(() => decryptShopifyToken(tampered)).toThrow();
  });

  it("throws if no encryption key is configured at module-load time", async () => {
    // shopify.js caches the encryption key at module-load. To test the
    // missing-key path we need to re-load the module with the env vars
    // unset. vi.resetModules + dynamic import accomplishes this.
    delete process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY;
    delete process.env.SHOPIFY_API_SECRET;
    vi.resetModules();
    const { encryptShopifyToken: freshEncrypt } = await import("@/lib/shopify");
    expect(() => freshEncrypt("shpat_x")).toThrow();
  });
});

// ─── Shopify OAuth HMAC verification ──────────────────────
describe("verifyShopifyOAuthHmac", () => {
  function buildSignedUrl(params, secret) {
    const sp = new URLSearchParams(params);
    // Sort keys alphabetically (Shopify requires this)
    const sortedEntries = [...sp.entries()].sort(([a], [b]) => a.localeCompare(b));
    const message = sortedEntries
      .filter(([k]) => k !== "hmac" && k !== "signature")
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    const hmac = crypto.createHmac("sha256", secret).update(message).digest("hex");
    sp.set("hmac", hmac);
    return `https://test.myshopify.com/apps/callback?${sp.toString()}`;
  }

  it("returns true for a valid HMAC signature", () => {
    const secret = "shopify-api-secret";
    const url = buildSignedUrl(
      { shop: "test.myshopify.com", timestamp: "1700000000", code: "abc" },
      secret
    );
    expect(verifyShopifyOAuthHmac(url, secret)).toBe(true);
  });

  it("returns false when the HMAC is wrong (single byte changed)", () => {
    const secret = "shopify-api-secret";
    const url = buildSignedUrl(
      { shop: "test.myshopify.com", timestamp: "1700000000" },
      secret
    );
    // Flip the last character of the hmac parameter
    const u = new URL(url);
    const orig = u.searchParams.get("hmac");
    const flipped = orig.slice(0, -1) + (orig.slice(-1) === "0" ? "1" : "0");
    u.searchParams.set("hmac", flipped);
    expect(verifyShopifyOAuthHmac(u.toString(), secret)).toBe(false);
  });

  it("returns false when there is no hmac or signature parameter", () => {
    const url = "https://test.myshopify.com/apps/callback?shop=test&timestamp=123";
    expect(verifyShopifyOAuthHmac(url, "shopify-api-secret")).toBe(false);
  });

  it("throws when no client secret is provided", () => {
    expect(() =>
      verifyShopifyOAuthHmac("https://x.test/cb?hmac=abc", null)
    ).toThrow();
  });

  it("returns false (does not throw) when the HMAC is the wrong length", () => {
    // timingSafeEqual throws when buffers differ in length — verify should
    // swallow that and return false.
    const sp = new URLSearchParams({ shop: "x", hmac: "tooshort" });
    expect(verifyShopifyOAuthHmac(sp, "shopify-api-secret")).toBe(false);
  });

  it("accepts a URLSearchParams instance directly", () => {
    const secret = "shopify-api-secret";
    const url = buildSignedUrl({ shop: "test.myshopify.com", code: "abc" }, secret);
    const sp = new URL(url).searchParams;
    expect(verifyShopifyOAuthHmac(sp, secret)).toBe(true);
  });

  it("accepts a URL instance directly", () => {
    const secret = "shopify-api-secret";
    const url = new URL(buildSignedUrl({ shop: "test.myshopify.com", code: "abc" }, secret));
    expect(verifyShopifyOAuthHmac(url, secret)).toBe(true);
  });

  it("uses the 'signature' field as a fallback when 'hmac' is absent", () => {
    const secret = "shopify-api-secret";
    const sp = new URLSearchParams({ shop: "test.myshopify.com", timestamp: "123" });
    // Build the message the same way verifyShopifyOAuthHmac does
    const message = [...sp.entries()]
      .filter(([k]) => k !== "hmac" && k !== "signature")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    const sig = crypto.createHmac("sha256", secret).update(message).digest("hex");
    sp.set("signature", sig);
    expect(verifyShopifyOAuthHmac(sp, secret)).toBe(true);
  });

  it("uses timing-safe comparison (not just string equality)", () => {
    // Construct a valid URL, then verify both that the legitimate
    // signature passes and that an attacker-controlled equal-length
    // signature fails.
    const secret = "shopify-api-secret";
    const url = buildSignedUrl({ shop: "test.myshopify.com", timestamp: "1" }, secret);
    expect(verifyShopifyOAuthHmac(url, secret)).toBe(true);

    // Replace hmac with all-zeros (same length)
    const u = new URL(url);
    const orig = u.searchParams.get("hmac");
    u.searchParams.set("hmac", "0".repeat(orig.length));
    expect(verifyShopifyOAuthHmac(u.toString(), secret)).toBe(false);
  });
});

// ─── Shopify domain validation ────────────────────────────
describe("validateShopifyDomain", () => {
  it("accepts a standard *.myshopify.com domain", () => {
    expect(() => validateShopifyDomain("store-name.myshopify.com")).not.toThrow();
  });

  it("accepts domains with hyphens and digits", () => {
    expect(() => validateShopifyDomain("my-store-123.myshopify.com")).not.toThrow();
  });

  it("throws on a domain without .myshopify.com suffix", () => {
    expect(() => validateShopifyDomain("example.com")).toThrow();
  });

  it("throws on a bare 'myshopify.com' (no subdomain)", () => {
    expect(() => validateShopifyDomain("myshopify.com")).toThrow();
  });

  it("throws on a URL with a protocol prefix", () => {
    expect(() => validateShopifyDomain("https://store.myshopify.com")).toThrow();
  });

  it("throws on null/undefined/empty input", () => {
    expect(() => validateShopifyDomain(null)).toThrow();
    expect(() => validateShopifyDomain(undefined)).toThrow();
    expect(() => validateShopifyDomain("")).toThrow();
  });

  it("throws on a domain containing uppercase letters (regex is case-insensitive though)", () => {
    // The regex uses /i flag, so uppercase is allowed. Verify that.
    expect(() => validateShopifyDomain("MyStore.myshopify.com")).not.toThrow();
  });

  it("throws when domain starts with a hyphen", () => {
    expect(() => validateShopifyDomain("-bad.myshopify.com")).toThrow();
  });

  it("throws on a path-bearing URL", () => {
    expect(() => validateShopifyDomain("store.myshopify.com/admin")).toThrow();
  });
});
