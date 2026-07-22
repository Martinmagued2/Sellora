/**
 * Generic AES-256-GCM token encryption for at-rest storage of sensitive tokens.
 *
 * Used to encrypt:
 *   - facebook_access_token
 *   - instagram_access_token
 *   - whatsapp_access_token
 *   - telegram_bot_token
 *   - meta_user_access_token
 *
 * (Shopify tokens use their own encryptShopifyToken/decryptShopifyToken in
 * src/lib/shopify.js — same pattern, different env var. We could consolidate
 * in the future.)
 *
 * Env var:
 *   TOKEN_ENCRYPTION_KEY — any string; SHA-256'd to a 32-byte AES key.
 *   If unset, encryptToken() throws (fail closed). decryptToken() throws
 *   on malformed input but returns null for null input (so existing code
 *   that does decryptToken(account.token) || null still works).
 *
 * Encrypted format: "enc:v1:<ivBase64>.<authTagBase64>.<encryptedBase64>"
 * The "enc:v1:" prefix lets us detect already-encrypted vs plaintext tokens
 * (for backward compatibility during migration).
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const PREFIX = "enc:v1:";

let _key = null;
function getKey() {
  if (_key) return _key;
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is not set. Token encryption is required — refusing to proceed (fail closed)."
    );
  }
  _key = crypto.createHash("sha256").update(secret).digest();
  return _key;
}

/**
 * Encrypt a plaintext token string.
 * @param {string|null|undefined} token
 * @returns {string|null} Encrypted token with "enc:v1:" prefix, or null if input was null/empty.
 */
export function encryptToken(token) {
  if (!token || typeof token !== "string") return null;
  // Don't double-encrypt
  if (token.startsWith(PREFIX)) return token;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("base64")}.${authTag.toString("base64")}.${encrypted.toString("base64")}`;
}

/**
 * Decrypt a token. Returns null for null/undefined input.
 * Throws on malformed input or wrong key.
 *
 * Backward compatibility: if the input doesn't have the "enc:v1:" prefix,
 * it's treated as plaintext (returned as-is). This lets us migrate
 * incrementally — old plaintext tokens keep working until re-saved.
 *
 * @param {string|null|undefined} payload
 * @returns {string|null}
 */
export function decryptToken(payload) {
  if (!payload || typeof payload !== "string") return null;
  if (!payload.startsWith(PREFIX)) {
    // Plaintext (not yet migrated) — return as-is
    return payload;
  }

  const body = payload.slice(PREFIX.length);
  const [ivBase64, authTagBase64, encryptedBase64] = body.split(".");
  if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error("Invalid encrypted token format");
  }

  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  const encrypted = Buffer.from(encryptedBase64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

/**
 * Check whether a stored token value is encrypted (has the enc:v1: prefix).
 * Useful for migration scripts.
 */
export function isEncrypted(payload) {
  return typeof payload === "string" && payload.startsWith(PREFIX);
}
