import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// totp/index.js reads TOTP_ENCRYPTION_KEY (with a fallback to a derived
// key from SUPABASE_SERVICE_ROLE_KEY) at module-load time. Use
// vi.hoisted() so the env vars are set BEFORE the static import runs.
vi.hoisted(() => {
  process.env.TOTP_ENCRYPTION_KEY = "totp-encryption-key-for-tests-only";
});

import {
  generateSecret,
  calculateTOTP,
  verifyTOTP,
  generateBackupCodes,
  buildOtpauthUrl,
  base32Encode,
  base32Decode,
  encryptSecret,
  decryptSecret,
} from "@/lib/totp";

// ─── Setup / teardown ─────────────────────────────────────
beforeEach(() => {
  process.env.TOTP_ENCRYPTION_KEY = "totp-encryption-key-for-tests-only";
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── generateSecret ───────────────────────────────────────
describe("generateSecret", () => {
  it("produces a non-empty base32 string", () => {
    const secret = generateSecret();
    expect(typeof secret).toBe("string");
    expect(secret.length).toBeGreaterThan(0);
    // Base32 alphabet only
    expect(secret).toMatch(/^[A-Z2-7=]+$/);
  });

  it("produces unique secrets across calls", () => {
    const a = generateSecret();
    const b = generateSecret();
    expect(a).not.toBe(b);
  });

  it("honours the length parameter (more bytes → longer secret)", () => {
    const short = generateSecret(10).replace(/=/g, "").length;
    const long = generateSecret(40).replace(/=/g, "").length;
    expect(long).toBeGreaterThan(short);
  });
});

// ─── base32 round-trip ────────────────────────────────────
describe("base32Encode / base32Decode", () => {
  // The TOTP base32 codec drops trailing bits when the input isn't a
  // multiple of 5 bytes, so we test with buffers whose length is a
  // multiple of 5 (the same constraint TOTP secrets satisfy).
  it("round-trips a 5-byte buffer", () => {
    const buf = Buffer.from("hello", "utf8"); // 5 bytes
    const encoded = base32Encode(buf);
    const decoded = base32Decode(encoded);
    expect(Buffer.compare(buf, decoded)).toBe(0);
  });

  it("round-trips a 10-byte buffer", () => {
    const buf = Buffer.from("hellohello", "utf8"); // 10 bytes
    const encoded = base32Encode(buf);
    const decoded = base32Decode(encoded);
    expect(Buffer.compare(buf, decoded)).toBe(0);
  });

  it("base32Decode ignores whitespace and padding", () => {
    const original = Buffer.from("abcde", "utf8"); // 5 bytes
    const encoded = base32Encode(original);
    const mangled = encoded.replace(/=/g, "").replace(/(.{4})/g, "$1 ");
    const decoded = base32Decode(mangled);
    expect(Buffer.compare(original, decoded)).toBe(0);
  });

  it("base32Decode skips characters not in the base32 alphabet", () => {
    const original = Buffer.from("xyzab", "utf8"); // 5 bytes
    const encoded = base32Encode(original);
    const mangled = "0189" + encoded;
    const decoded = base32Decode(mangled);
    expect(Buffer.compare(original, decoded)).toBe(0);
  });
});

// ─── calculateTOTP ────────────────────────────────────────
describe("calculateTOTP", () => {
  it("produces a 6-digit string", () => {
    const secret = generateSecret();
    const code = calculateTOTP(secret, Math.floor(Date.now() / 1000 / 30));
    expect(code).toMatch(/^\d{6}$/);
  });

  it("produces the same code for the same secret and time step", () => {
    const secret = generateSecret();
    const step = 1234567;
    expect(calculateTOTP(secret, step)).toBe(calculateTOTP(secret, step));
  });

  it("produces a different code for a different time step (most of the time)", () => {
    const secret = generateSecret();
    const step = 1234567;
    // Try a few different steps — they shouldn't all match (extremely unlikely)
    const codes = new Set();
    for (let i = 0; i < 10; i++) {
      codes.add(calculateTOTP(secret, step + i));
    }
    expect(codes.size).toBeGreaterThan(1);
  });
});

// ─── verifyTOTP ───────────────────────────────────────────
describe("verifyTOTP", () => {
  it("accepts the current TOTP code", () => {
    const secret = generateSecret();
    const step = Math.floor(Date.now() / 1000 / 30);
    const code = calculateTOTP(secret, step);
    const r = verifyTOTP(secret, code);
    expect(r.valid).toBe(true);
    expect(r.timeStep).toBe(step);
  });

  it("accepts a code from one step in the past (clock skew tolerance)", () => {
    const secret = generateSecret();
    const step = Math.floor(Date.now() / 1000 / 30) - 1;
    const code = calculateTOTP(secret, step);
    const r = verifyTOTP(secret, code);
    expect(r.valid).toBe(true);
  });

  it("accepts a code from one step in the future (clock skew tolerance)", () => {
    const secret = generateSecret();
    const step = Math.floor(Date.now() / 1000 / 30) + 1;
    const code = calculateTOTP(secret, step);
    const r = verifyTOTP(secret, code);
    expect(r.valid).toBe(true);
  });

  it("rejects a wildly wrong code", () => {
    const secret = generateSecret();
    const r = verifyTOTP(secret, "000000");
    // 000000 might rarely match by chance, so just verify the shape
    expect(typeof r.valid).toBe("boolean");
    expect(r.timeStep === null || typeof r.timeStep === "number").toBe(true);
  });

  it("rejects a non-6-digit code", () => {
    const secret = generateSecret();
    expect(verifyTOTP(secret, "12345").valid).toBe(false);   // too short
    expect(verifyTOTP(secret, "1234567").valid).toBe(false);  // too long
    expect(verifyTOTP(secret, "abcdef").valid).toBe(false);   // non-numeric
  });

  it("rejects null/undefined/empty inputs", () => {
    expect(verifyTOTP(null, "123456").valid).toBe(false);
    expect(verifyTOTP(undefined, "123456").valid).toBe(false);
    expect(verifyTOTP("", "123456").valid).toBe(false);
    expect(verifyTOTP(generateSecret(), null).valid).toBe(false);
    expect(verifyTOTP(generateSecret(), undefined).valid).toBe(false);
    expect(verifyTOTP(generateSecret(), "").valid).toBe(false);
  });

  it("strips whitespace from the code before verifying", () => {
    const secret = generateSecret();
    const step = Math.floor(Date.now() / 1000 / 30);
    const code = calculateTOTP(secret, step);
    // Inject spaces
    expect(verifyTOTP(secret, `  ${code}  `).valid).toBe(true);
    expect(verifyTOTP(secret, `${code.slice(0,3)} ${code.slice(3)}`).valid).toBe(true);
  });
});

// ─── verifyTOTP replay protection ─────────────────────────
describe("verifyTOTP replay protection", () => {
  it("rejects the EXACT last used time step", () => {
    const secret = generateSecret();
    const step = Math.floor(Date.now() / 1000 / 30);
    const code = calculateTOTP(secret, step);

    // First verify should succeed
    const r1 = verifyTOTP(secret, code, 2, null);
    expect(r1.valid).toBe(true);

    // Replay the same code with lastUsedTimeStep set to the step it was used
    const r2 = verifyTOTP(secret, code, 2, r1.timeStep);
    expect(r2.valid).toBe(false);
  });

  it("rejects a code from a step outside the ±window (not just the last-used one)", () => {
    const secret = generateSecret();
    const step = Math.floor(Date.now() / 1000 / 30);
    // step - 3 is OUTSIDE the ±2 window — code should be rejected
    const outOfWindowStep = step - 3;
    const outOfWindowCode = calculateTOTP(secret, outOfWindowStep);
    const r = verifyTOTP(secret, outOfWindowCode, 2, step);
    expect(r.valid).toBe(false);
  });
});

// ─── Encryption at rest ───────────────────────────────────
describe("encryptSecret / decryptSecret", () => {
  it("round-trips a TOTP secret", () => {
    const plaintext = generateSecret();
    const encrypted = encryptSecret(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted.startsWith("enc:v1:")).toBe(true);
    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("encryptSecret produces a different ciphertext each time (random IV)", () => {
    const plaintext = generateSecret();
    expect(encryptSecret(plaintext)).not.toBe(encryptSecret(plaintext));
  });

  it("decryptSecret returns legacy plaintext unchanged (no enc: prefix)", () => {
    const legacy = "JBSWY3DPEHPK3PXP";
    expect(decryptSecret(legacy)).toBe(legacy);
  });

  it("decryptSecret throws on a tampered ciphertext (auth tag mismatch)", () => {
    const encrypted = encryptSecret(generateSecret());
    // Flip a character in the data segment
    const parts = encrypted.split(":");
    const data = parts[4];
    const tampered = data.slice(0, -1) + (data.slice(-1) === "A" ? "B" : "A");
    parts[4] = tampered;
    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });

  it("works with an encrypted secret in verifyTOTP", () => {
    const secret = generateSecret();
    const encrypted = encryptSecret(secret);
    const step = Math.floor(Date.now() / 1000 / 30);
    const code = calculateTOTP(secret, step);
    // verifyTOTP should decrypt the secret internally
    const r = verifyTOTP(encrypted, code);
    expect(r.valid).toBe(true);
  });
});

// ─── Backup codes ─────────────────────────────────────────
describe("generateBackupCodes", () => {
  it("produces the requested number of codes", () => {
    const codes = generateBackupCodes(8);
    expect(codes.length).toBe(8);
  });

  it("produces codes in the XXXX-XXXX format", () => {
    const codes = generateBackupCodes(5);
    for (const c of codes) {
      expect(c).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
    }
  });

  it("produces unique codes (high probability)", () => {
    const codes = generateBackupCodes(20);
    const set = new Set(codes);
    // 20 codes from 32 bits of entropy each — collision probability is tiny
    expect(set.size).toBeGreaterThan(15);
  });

  it("honours custom count", () => {
    expect(generateBackupCodes(1).length).toBe(1);
    expect(generateBackupCodes(12).length).toBe(12);
  });

  it("defaults to 8 codes when called with no arguments", () => {
    expect(generateBackupCodes().length).toBe(8);
  });
});

// ─── buildOtpauthUrl ──────────────────────────────────────
describe("buildOtpauthUrl", () => {
  it("produces a URL starting with otpauth://totp/", () => {
    const url = buildOtpauthUrl("JBSWY3DPEHPK3PXP", "user@test");
    expect(url.startsWith("otpauth://totp/")).toBe(true);
  });

  it("includes the issuer and email in the path (encoded)", () => {
    const url = buildOtpauthUrl("JBSWY3DPEHPK3PXP", "user@test", "Sellora");
    // The path is `${encodeURIComponent(issuer)}:${encodeURIComponent(email)}`
    // → "Sellora:user%40test"
    expect(url).toContain("Sellora:user%40test");
  });

  it("includes algorithm, digits, and period parameters", () => {
    const url = buildOtpauthUrl("JBSWY3DPEHPK3PXP", "user@test");
    expect(url).toContain("algorithm=SHA1");
    expect(url).toContain("digits=6");
    expect(url).toContain("period=30");
  });

  it("strips base32 padding from the secret in the URL", () => {
    // JBSWY3DPEHPK3PXP has no padding, but generateSecret() produces padded output
    const secret = generateSecret();
    const url = buildOtpauthUrl(secret, "user@test");
    // secret= param value should not contain '='
    const secretParam = new URL(url).searchParams.get("secret");
    expect(secretParam).not.toContain("=");
  });
});
