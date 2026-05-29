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
 * Helper: Try to execute SQL via RPC, or mark as needing manual run
 */
async function tryExecSql(admin, sql, successMsg, manualMsg) {
  try {
    await admin.rpc("exec_sql", { query: sql });
    return successMsg;
  } catch (rpcErr) {
    return `NEEDS MANUAL: ${manualMsg}`;
  }
}

/**
 * POST /api/db/migrate
 *
 * Runs necessary schema migrations to add missing columns/tables.
 * Called automatically by the app when needed.
 * Uses Supabase's rpc or direct SQL via the management API.
 */
export async function POST() {
  try {
    const admin = getSupabaseAdmin();
    const results = [];

    // ═══ Migration 014: Missing columns ═══
    // Check if account_id exists on messages table
    const { error: testMsgErr } = await admin
      .from("messages")
      .select("account_id")
      .limit(1);

    if (testMsgErr && testMsgErr.message?.includes("column") && testMsgErr.message?.includes("account_id")) {
      results.push(await tryExecSql(
        admin,
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id);",
        "Added account_id to messages",
        "Add account_id column to messages table (see migration 014)"
      ));
    } else {
      results.push("messages.account_id: OK");
    }

    // Check accounts table for missing columns
    const { error: testAcctErr } = await admin
      .from("accounts")
      .select("notification_prefs, instagram_url, facebook_url, website_url, billing_address, subscription_ends_at, trial_ends_at")
      .limit(1);

    if (testAcctErr && testAcctErr.message?.includes("column")) {
      results.push(await tryExecSql(
        admin,
        `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{"new_message": true, "new_order": true, "order_status": true, "daily_summary": false}';
         ALTER TABLE accounts ADD COLUMN IF NOT EXISTS instagram_url TEXT;
         ALTER TABLE accounts ADD COLUMN IF NOT EXISTS facebook_url TEXT;
         ALTER TABLE accounts ADD COLUMN IF NOT EXISTS website_url TEXT;
         ALTER TABLE accounts ADD COLUMN IF NOT EXISTS billing_address JSONB;
         ALTER TABLE accounts ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;
         ALTER TABLE accounts ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;`,
        "Added missing columns to accounts",
        "Add missing columns to accounts table (see migration 014)"
      ));
    } else {
      results.push("accounts columns (014): OK");
    }

    // Backfill account_id for existing messages
    try {
      await admin.rpc("exec_sql", {
        query: "UPDATE messages m SET account_id = c.account_id FROM conversations c WHERE m.conversation_id = c.id AND m.account_id IS NULL;"
      });
      results.push("Backfilled messages.account_id");
    } catch (e) {
      results.push("NEEDS MANUAL: Backfill messages.account_id from conversations");
    }

    // ═══ Migration 016: Messaging Enhancements (Phase 2) ═══
    // Check WhatsApp columns on accounts
    const { error: testWaErr } = await admin
      .from("accounts")
      .select("whatsapp_connected, whatsapp_phone_number_id, whatsapp_access_token")
      .limit(1);

    if (testWaErr && testWaErr.message?.includes("column")) {
      results.push(await tryExecSql(
        admin,
        `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS whatsapp_connected BOOLEAN DEFAULT FALSE;
         ALTER TABLE accounts ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id TEXT;
         ALTER TABLE accounts ADD COLUMN IF NOT EXISTS whatsapp_access_token TEXT;
         ALTER TABLE accounts ADD COLUMN IF NOT EXISTS whatsapp_webhook_verify_token TEXT;`,
        "Added WhatsApp columns to accounts",
        "Add WhatsApp columns to accounts (see migration 016)"
      ));
    } else {
      results.push("accounts.whatsapp columns: OK");
    }

    // Check per-channel greeting columns
    const { error: testGreetErr } = await admin
      .from("accounts")
      .select("auto_greeting_instagram, auto_greeting_facebook, auto_greeting_whatsapp")
      .limit(1);

    if (testGreetErr && testGreetErr.message?.includes("column")) {
      results.push(await tryExecSql(
        admin,
        `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS auto_greeting_instagram TEXT DEFAULT 'Hi {name}! Welcome to {business_name} 👋 How can we help you today?';
         ALTER TABLE accounts ADD COLUMN IF NOT EXISTS auto_greeting_facebook TEXT DEFAULT 'Hi {name}! Welcome to {business_name} 👋 How can we help you today?';
         ALTER TABLE accounts ADD COLUMN IF NOT EXISTS auto_greeting_whatsapp TEXT DEFAULT 'Hi {name}! Welcome to {business_name} 👋 How can we help you today?';`,
        "Added per-channel greeting columns to accounts",
        "Add per-channel greeting columns to accounts (see migration 016)"
      ));
    } else {
      results.push("accounts.greeting columns: OK");
    }

    // Check broadcast_logs table
    const { error: testBlErr } = await admin
      .from("broadcast_logs")
      .select("id")
      .limit(1);

    if (testBlErr && (testBlErr.message?.includes("relation") || testBlErr.code === "42P01")) {
      results.push(await tryExecSql(
        admin,
        `CREATE TABLE IF NOT EXISTS broadcast_logs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
          campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
          customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
          channel TEXT NOT NULL DEFAULT 'instagram' CHECK (channel IN ('instagram', 'facebook', 'whatsapp')),
          error_message TEXT,
          platform_message_id TEXT,
          sent_at TIMESTAMPTZ,
          delivered_at TIMESTAMPTZ,
          read_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_broadcast_logs_account ON broadcast_logs(account_id);
        CREATE INDEX IF NOT EXISTS idx_broadcast_logs_campaign ON broadcast_logs(campaign_id);
        ALTER TABLE broadcast_logs ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Users can manage own broadcast_logs" ON broadcast_logs;
        CREATE POLICY "Users can manage own broadcast_logs" ON broadcast_logs FOR ALL USING (account_id = auth.uid());`,
        "Created broadcast_logs table",
        "Create broadcast_logs table (see migration 016)"
      ));
    } else {
      results.push("broadcast_logs table: OK");
    }

    // Check quick_replies enhancements
    const { error: testQrErr } = await admin
      .from("quick_replies")
      .select("short_code, is_default")
      .limit(1);

    if (testQrErr && testQrErr.message?.includes("column")) {
      results.push(await tryExecSql(
        admin,
        `ALTER TABLE quick_replies ADD COLUMN IF NOT EXISTS short_code TEXT;
         ALTER TABLE quick_replies ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;
         ALTER TABLE quick_replies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
         CREATE UNIQUE INDEX IF NOT EXISTS idx_quick_replies_short_code ON quick_replies(account_id, short_code) WHERE short_code IS NOT NULL;`,
        "Added short_code/is_default to quick_replies",
        "Add short_code/is_default to quick_replies (see migration 016)"
      ));
    } else {
      results.push("quick_replies columns: OK");
    }

    // Check campaign enhancements
    const { error: testCampErr } = await admin
      .from("campaigns")
      .select("channel, broadcast_type")
      .limit(1);

    if (testCampErr && testCampErr.message?.includes("column")) {
      results.push(await tryExecSql(
        admin,
        `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'all' CHECK (channel IN ('all', 'instagram', 'facebook', 'whatsapp'));
         ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS template_type TEXT DEFAULT 'text' CHECK (template_type IN ('text', 'template'));
         ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS broadcast_type TEXT DEFAULT 'promotional' CHECK (broadcast_type IN ('promotional', 'transactional', 'reminder'));`,
        "Added channel/broadcast_type to campaigns",
        "Add channel/broadcast_type to campaigns (see migration 016)"
      ));
    } else {
      results.push("campaigns columns: OK");
    }

    // Check message delivery tracking columns
    const { error: testMsgDelErr } = await admin
      .from("messages")
      .select("delivery_status, delivered_at")
      .limit(1);

    if (testMsgDelErr && testMsgDelErr.message?.includes("column")) {
      results.push(await tryExecSql(
        admin,
        `ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivery_status TEXT CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'read', 'failed'));
         ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
         ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
         ALTER TABLE messages ADD COLUMN IF NOT EXISTS whatsapp_message_id TEXT;`,
        "Added delivery tracking columns to messages",
        "Add delivery tracking columns to messages (see migration 016)"
      ));
    } else {
      results.push("messages.delivery columns: OK");
    }

    // Check customer last_contacted_at
    const { error: testCustErr } = await admin
      .from("customers")
      .select("last_contacted_at")
      .limit(1);

    if (testCustErr && testCustErr.message?.includes("column")) {
      results.push(await tryExecSql(
        admin,
        "ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;",
        "Added last_contacted_at to customers",
        "Add last_contacted_at to customers (see migration 016)"
      ));
    } else {
      results.push("customers.last_contacted_at: OK");
    }

    return Response.json({ success: true, results });
  } catch (error) {
    console.error("[DB-Migrate] Error:", error.message);
    return Response.json(
      { error: error.message, hint: "You may need to run the migration SQL manually in the Supabase Dashboard. See supabase/migrations/016_messaging_enhancements.sql" },
      { status: 500 }
    );
  }
}
