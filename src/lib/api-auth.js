/**
 * API Key authentication middleware for Sellora's public REST API.
 *
 * Usage in API v1 routes:
 *   import { authenticateApiKey } from "@/lib/api-auth";
 *   const auth = await authenticateApiKey(req);
 *   if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
 *   const { accountId, permissions } = auth;
 */

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

let _admin = null;
function admin() {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _admin;
}

/**
 * Authenticate a request using an API key.
 * Checks the Authorization header for "Bearer sk_live_..." or "Bearer sk_test_...".
 *
 * @param {Request} req
 * @returns {Promise<{accountId?: string, permissions?: string[], error?: string, status?: number}>}
 */
export async function authenticateApiKey(req) {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(sk_\w+_.+)$/i);

  if (!match) {
    return { error: "Missing or invalid API key. Use 'Authorization: Bearer sk_live_...'", status: 401 };
  }

  const apiKey = match[1];
  const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

  const db = admin();
  const { data: keyRecord, error } = await db
    .from("api_keys")
    .select("id, account_id, permissions, expires_at, revoked_at")
    .eq("key_hash", keyHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !keyRecord) {
    return { error: "Invalid or revoked API key", status: 401 };
  }

  // Check expiration
  if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
    return { error: "API key has expired", status: 401 };
  }

  // Update last_used_at (fire-and-forget)
  db.from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRecord.id)
    .then(() => {});

  return {
    accountId: keyRecord.account_id,
    permissions: keyRecord.permissions || ["read"],
  };
}

/**
 * Check if the authenticated API key has the required permission.
 */
export function hasPermission(permissions, required) {
  if (!permissions || !Array.isArray(permissions)) return false;
  if (permissions.includes("admin")) return true;
  return permissions.includes(required);
}

/**
 * Generate a new API key (plaintext + hash).
 * Format: sk_live_<32 random hex chars>
 */
export function generateApiKey() {
  const random = crypto.randomBytes(24).toString("hex");
  const apiKey = `sk_live_${random}`;
  const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
  const keyPrefix = apiKey.substring(0, 12);
  return { apiKey, keyHash, keyPrefix };
}
