import { createClient } from "@supabase/supabase-js";

// Lazy-init admin client
let _supabaseAdmin = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabaseAdmin;
}

/**
 * POST /api/db/migrate
 *
 * Runs necessary schema migrations to add missing columns.
 * Called automatically by the app when needed.
 * Uses Supabase's rpc or direct SQL via the management API.
 */
export async function POST() {
  try {
    const admin = getSupabaseAdmin();
    const results = [];

    // Check if account_id exists on messages table
    // We do this by trying a query that uses it
    const { error: testMsgErr } = await admin
      .from("messages")
      .select("account_id")
      .limit(1);

    if (testMsgErr && testMsgErr.message.includes("column") && testMsgErr.message.includes("account_id")) {
      // Column doesn't exist — need to add it
      // Since we can't run ALTER TABLE via the JS client, we'll try using rpc
      // If that fails, we document that the user needs to run the SQL manually
      try {
        await admin.rpc("exec_sql", {
          query: "ALTER TABLE messages ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id);"
        });
        results.push("Added account_id to messages");
      } catch (rpcErr) {
        // RPC not available — we'll note this but continue
        results.push("NEEDS MANUAL: Add account_id column to messages table (see migration 014)");
      }
    } else {
      results.push("messages.account_id: OK");
    }

    // Check accounts table for missing columns
    const { data: testAccount, error: testAcctErr } = await admin
      .from("accounts")
      .select("notification_prefs, instagram_url, facebook_url, website_url, billing_address, subscription_ends_at, trial_ends_at")
      .limit(1);

    if (testAcctErr && testAcctErr.message.includes("column")) {
      try {
        await admin.rpc("exec_sql", {
          query: `
            ALTER TABLE accounts ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{"new_message": true, "new_order": true, "order_status": true, "daily_summary": false}';
            ALTER TABLE accounts ADD COLUMN IF NOT EXISTS instagram_url TEXT;
            ALTER TABLE accounts ADD COLUMN IF NOT EXISTS facebook_url TEXT;
            ALTER TABLE accounts ADD COLUMN IF NOT EXISTS website_url TEXT;
            ALTER TABLE accounts ADD COLUMN IF NOT EXISTS billing_address JSONB;
            ALTER TABLE accounts ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;
            ALTER TABLE accounts ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
          `
        });
        results.push("Added missing columns to accounts");
      } catch (rpcErr) {
        results.push("NEEDS MANUAL: Add missing columns to accounts table (see migration 014)");
      }
    } else {
      results.push("accounts columns: OK");
    }

    // Backfill account_id for existing messages
    try {
      await admin.rpc("exec_sql", {
        query: `
          UPDATE messages m
          SET account_id = c.account_id
          FROM conversations c
          WHERE m.conversation_id = c.id AND m.account_id IS NULL;
        `
      });
      results.push("Backfilled messages.account_id");
    } catch (e) {
      results.push("NEEDS MANUAL: Backfill messages.account_id from conversations");
    }

    return Response.json({ success: true, results });
  } catch (error) {
    console.error("[DB-Migrate] Error:", error.message);
    return Response.json(
      { error: error.message, hint: "You may need to run the migration SQL manually in the Supabase Dashboard. See supabase/migrations/014_missing_columns.sql" },
      { status: 500 }
    );
  }
}
