/**
 * POST /api/admin/encrypt-tokens
 *
 * One-time admin endpoint that re-encrypts existing plaintext tokens in the
 * accounts table. Idempotent — tokens that are already encrypted are skipped.
 *
 * Auth: requires ADMIN_SECRET_KEY in the x-admin-key header.
 *
 * Tokens encrypted:
 *   - facebook_access_token
 *   - instagram_access_token
 *   - whatsapp_access_token
 *   - telegram_bot_token
 *   - meta_user_access_token
 *
 * (shopify_access_token is already encrypted via encryptShopifyToken — different scheme.)
 *
 * Response:
 *   {
 *     success: true,
 *     scanned: <number>,
 *     encrypted: <number>,
 *     skipped_already_encrypted: <number>,
 *     skipped_null: <number>,
 *     errors: [...]
 *   }
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { encryptToken, isEncrypted } from "@/lib/token-encryption";

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

const TOKEN_COLUMNS = [
  "facebook_access_token",
  "instagram_access_token",
  "whatsapp_access_token",
  "telegram_bot_token",
  "meta_user_access_token",
];

export async function POST(req) {
  try {
    // Auth check
    const adminKey = req.headers.get("x-admin-key");
    const expectedKey = process.env.ADMIN_SECRET_KEY;
    if (!expectedKey || adminKey !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify TOKEN_ENCRYPTION_KEY is set
    if (!process.env.TOKEN_ENCRYPTION_KEY) {
      return NextResponse.json(
        { error: "TOKEN_ENCRYPTION_KEY env var is not set. Set it before running this migration." },
        { status: 500 }
      );
    }

    const db = admin();

    // Fetch all accounts that have at least one non-null token
    const selectColumns = ["id", "email", ...TOKEN_COLUMNS].join(", ");
    const { data: accounts, error: fetchErr } = await db
      .from("accounts")
      .select(selectColumns);

    if (fetchErr) {
      return NextResponse.json({ error: "Failed to fetch accounts: " + fetchErr.message }, { status: 500 });
    }

    const stats = {
      scanned: accounts?.length || 0,
      encrypted: 0,
      skipped_already_encrypted: 0,
      skipped_null: 0,
      errors: [],
    };

    for (const account of accounts || []) {
      const updates = {};
      let hasChanges = false;
      let hasNonNull = false;

      for (const col of TOKEN_COLUMNS) {
        const value = account[col];
        if (!value) continue;  // null/empty — skip
        hasNonNull = true;

        if (isEncrypted(value)) {
          // Already encrypted — skip
          continue;
        }

        // Plaintext — encrypt it
        try {
          updates[col] = encryptToken(value);
          hasChanges = true;
        } catch (e) {
          stats.errors.push({ accountId: account.id, email: account.email, column: col, error: e.message });
        }
      }

      if (!hasNonNull) {
        stats.skipped_null++;
        continue;
      }
      if (!hasChanges) {
        stats.skipped_already_encrypted++;
        continue;
      }

      // Apply the update
      const { error: updateErr } = await db
        .from("accounts")
        .update(updates)
        .eq("id", account.id);

      if (updateErr) {
        stats.errors.push({ accountId: account.id, email: account.email, error: updateErr.message });
      } else {
        stats.encrypted++;
      }
    }

    return NextResponse.json({ success: true, ...stats });
  } catch (e) {
    console.error("[ENCRYPT-TOKENS] error:", e.message);
    return NextResponse.json({ error: "Server error: " + e.message }, { status: 500 });
  }
}
