import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateSecret, buildOtpauthUrl, encryptSecret } from "@/lib/totp";

// Lazy Supabase admin client (server-side only)
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabase;
}

/**
 * Ensure the accounts table has the required 2FA columns.
 * Uses the Supabase Management API to run ALTER TABLE if needed.
 */
let _columnsEnsured = false;
async function ensure2FAColumns(supabase) {
  if (_columnsEnsured) return;
  
  // Check if totp_enabled column exists by trying to select it
  const { error: checkError } = await supabase
    .from("accounts")
    .select("totp_enabled")
    .limit(1);
  
  if (!checkError) {
    _columnsEnsured = true;
    return; // Columns exist, we're good
  }
  
  if (!checkError.message.includes("column") && !checkError.message.includes("does not exist")) {
    _columnsEnsured = true;
    return; // Different error, not about missing columns
  }
  
  console.log("[2FA Setup] TOTP columns missing, attempting auto-migration...");
  
  // Try to add columns using RPC exec_sql
  const sql = `
    ALTER TABLE accounts ADD COLUMN IF NOT EXISTS totp_secret text;
    ALTER TABLE accounts ADD COLUMN IF NOT EXISTS totp_enabled boolean DEFAULT false;
    ALTER TABLE accounts ADD COLUMN IF NOT EXISTS totp_backup_codes jsonb DEFAULT '[]';
    ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_totp_time_step bigint;
    ALTER TABLE accounts ADD COLUMN IF NOT EXISTS two_factor_verified_at timestamptz;
  `;
  
  // Approach 1: Try rpc exec_sql
  try {
    await supabase.rpc("exec_sql", { sql });
    console.log("[2FA Setup] Migration via RPC succeeded");
    _columnsEnsured = true;
    return;
  } catch (e) {
    console.warn("[2FA Setup] RPC exec_sql not available:", e.message);
  }
  
  // Approach 2: Try rpc with query parameter (some Supabase versions)
  try {
    await supabase.rpc("exec_sql", { query: sql });
    console.log("[2FA Setup] Migration via RPC (query param) succeeded");
    _columnsEnsured = true;
    return;
  } catch (e) {
    console.warn("[2FA Setup] RPC exec_sql (query) not available:", e.message);
  }
  
  // Approach 3: Use Supabase Management API to run SQL
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const projectId = supabaseUrl?.replace("https://", "").replace(".supabase.co", "");
    const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
    const dbUrl = process.env.DATABASE_URL;
    
    if (projectId && accessToken) {
      const mgmtResponse = await fetch(
        `https://api.supabase.com/v1/projects/${projectId}/database/query`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: sql }),
        }
      );
      if (mgmtResponse.ok) {
        console.log("[2FA Setup] Migration via Management API succeeded");
        _columnsEnsured = true;
        return;
      }
    }
  } catch (e) {
    console.warn("[2FA Setup] Management API migration failed:", e.message);
  }
  
  console.error("[2FA Setup] Could not auto-migrate. TOTP columns need to be added manually.");
}

/**
 * POST /api/auth/2fa/setup
 *
 * Generates a TOTP secret and returns otpauth URL for QR code generation.
 * The secret is stored encrypted — it won't be activated until verified.
 * SECURITY: The secret is NOT sent to any external API (no Google Charts).
 *           The client uses qrcode.react to render the QR code locally.
 */
export async function POST(request) {
  try {
    // Get the user from the Authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Not authenticated — please log in again" }, { status: 401 });
    }

    // Verify the user token with Supabase
    const supabase = getSupabase();
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Invalid authentication — please log in again" }, { status: 401 });
    }

    // Ensure the accounts table has the required 2FA columns
    await ensure2FAColumns(supabase);

    // Check if 2FA is already enabled
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("totp_enabled, email, totp_secret")
      .eq("id", user.id)
      .single();

    if (accountError) {
      console.error("[2FA Setup] Failed to fetch account:", accountError.message);
      // If the column still doesn't exist after auto-migration, try to proceed anyway
      // by resetting the 2FA state using only known-good columns
      if (accountError.message.includes("column") || accountError.message.includes("does not exist")) {
        return NextResponse.json({
          error: "2FA requires a database update. Please run the migration: supabase/migrations/025_add_totp.sql",
          details: accountError.message,
        }, { status: 400 });
      }
      return NextResponse.json({ error: "Failed to fetch account settings. Please try again." }, { status: 500 });
    }

    if (account?.totp_enabled) {
      return NextResponse.json({ error: "2FA is already enabled on your account" }, { status: 400 });
    }

    // Generate TOTP secret
    const secret = generateSecret();
    const email = account?.email || user.email || "user";
    const otpauthUrl = buildOtpauthUrl(secret, email);

    // Store the secret ENCRYPTED (not yet enabled)
    // It will be enabled only after successful verification
    let encryptedSecret;
    try {
      encryptedSecret = encryptSecret(secret);
    } catch (encErr) {
      console.error("[2FA Setup] Encryption failed:", encErr.message);
      return NextResponse.json({
        error: "2FA setup failed — encryption key not configured. Please contact support or set TOTP_ENCRYPTION_KEY.",
      }, { status: 500 });
    }

    const { error: updateError } = await supabase
      .from("accounts")
      .update({ totp_secret: encryptedSecret, totp_enabled: false })
      .eq("id", user.id);

    if (updateError) {
      console.error("[2FA Setup] Failed to store secret:", updateError.message);
      // If the column doesn't exist, give a helpful error
      if (updateError.message.includes("column") || updateError.message.includes("does not exist")) {
        return NextResponse.json({
          error: "2FA requires a database update. Please run the migration: supabase/migrations/025_add_totp.sql",
          details: updateError.message,
        }, { status: 400 });
      }
      return NextResponse.json({ error: "Failed to save 2FA secret: " + updateError.message }, { status: 500 });
    }

    // Return the secret and otpauth URL for client-side QR rendering.
    return NextResponse.json({
      secret,
      otpauthUrl,
    });
  } catch (err) {
    console.error("[2FA Setup] Error:", err);
    return NextResponse.json({ error: "Failed to setup 2FA: " + (err.message || "Unknown error") }, { status: 500 });
  }
}
