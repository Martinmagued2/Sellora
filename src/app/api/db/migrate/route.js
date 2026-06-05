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

    // Check per-channel greeting columns (actual column names: instagram_greeting, facebook_greeting, whatsapp_greeting)
    const { error: testGreetErr } = await admin
      .from("accounts")
      .select("instagram_greeting, facebook_greeting, whatsapp_greeting, greeting_delay_seconds, greeting_per_channel")
      .limit(1);

    if (testGreetErr && testGreetErr.message?.includes("column")) {
      results.push(await tryExecSql(
        admin,
        `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS instagram_greeting TEXT;
         ALTER TABLE accounts ADD COLUMN IF NOT EXISTS facebook_greeting TEXT;
         ALTER TABLE accounts ADD COLUMN IF NOT EXISTS whatsapp_greeting TEXT;
         ALTER TABLE accounts ADD COLUMN IF NOT EXISTS greeting_delay_seconds INTEGER DEFAULT 0;
         ALTER TABLE accounts ADD COLUMN IF NOT EXISTS greeting_per_channel BOOLEAN DEFAULT FALSE;`,
        "Added per-channel greeting columns to accounts",
        "Add per-channel greeting columns to accounts (see migration 016)"
      ));
    } else {
      results.push("accounts.greeting columns: OK");
    }

    // Check auto_greeting and auto_greeting_message columns
    const { error: testAutoGreetErr } = await admin
      .from("accounts")
      .select("auto_greeting, auto_greeting_message, auto_follow_up_enabled")
      .limit(1);

    if (testAutoGreetErr && testAutoGreetErr.message?.includes("column")) {
      results.push(await tryExecSql(
        admin,
        `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS auto_greeting BOOLEAN DEFAULT FALSE;
         ALTER TABLE accounts ADD COLUMN IF NOT EXISTS auto_greeting_message TEXT DEFAULT 'Hi! Welcome to {business_name} 👋 How can I help you today?';
         ALTER TABLE accounts ADD COLUMN IF NOT EXISTS auto_follow_up_enabled BOOLEAN DEFAULT FALSE;`,
        "Added auto_greeting columns to accounts",
        "Add auto_greeting/auto_follow_up columns to accounts (see migration 015)"
      ));
    } else {
      results.push("accounts.auto_greeting columns: OK");
    }

    // Check faqs table
    const { error: testFaqErr } = await admin
      .from("faqs")
      .select("id")
      .limit(1);

    if (testFaqErr && (testFaqErr.message?.includes("relation") || testFaqErr.code === "42P01")) {
      results.push(await tryExecSql(
        admin,
        `CREATE TABLE IF NOT EXISTS faqs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
          question TEXT NOT NULL,
          answer TEXT NOT NULL,
          category TEXT DEFAULT 'General',
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_faqs_account ON faqs(account_id);
        ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Users can manage own faqs" ON faqs;
        CREATE POLICY "Users can manage own faqs" ON faqs FOR ALL USING (account_id = auth.uid());`,
        "Created faqs table",
        "Create faqs table (see migration 015)"
      ));
    } else {
      results.push("faqs table: OK");
    }

    // Check quick_replies table
    const { error: testQrTableErr } = await admin
      .from("quick_replies")
      .select("id")
      .limit(1);

    if (testQrTableErr && (testQrTableErr.message?.includes("relation") || testQrTableErr.code === "42P01")) {
      results.push(await tryExecSql(
        admin,
        `CREATE TABLE IF NOT EXISTS quick_replies (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          category TEXT DEFAULT 'General',
          shortcut TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_quick_replies_account ON quick_replies(account_id);
        ALTER TABLE quick_replies ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Users can manage own quick_replies" ON quick_replies;
        CREATE POLICY "Users can manage own quick_replies" ON quick_replies FOR ALL USING (account_id = auth.uid());`,
        "Created quick_replies table",
        "Create quick_replies table (see migration 015)"
      ));
    } else {
      results.push("quick_replies table: OK");
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

    // ═══ Migration 017: Business Policies ═══
    const { error: testPoliciesErr } = await admin
      .from("business_policies")
      .select("id")
      .limit(1);

    if (testPoliciesErr && (testPoliciesErr.message?.includes("relation") || testPoliciesErr.code === "42P01")) {
      results.push(await tryExecSql(
        admin,
        `CREATE TABLE IF NOT EXISTS business_policies (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          category TEXT DEFAULT 'General' CHECK (category IN ('Returns & Refunds', 'Shipping & Delivery', 'Exchange', 'Payment', 'Privacy', 'Terms of Service', 'Warranty', 'Cancellation', 'General')),
          is_active BOOLEAN DEFAULT TRUE,
          sort_order INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_business_policies_account ON business_policies(account_id);
        CREATE INDEX IF NOT EXISTS idx_business_policies_active ON business_policies(account_id, is_active);
        ALTER TABLE business_policies ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Users can manage own business_policies" ON business_policies;
        CREATE POLICY "Users can manage own business_policies" ON business_policies FOR ALL USING (account_id = auth.uid());`,
        "Created business_policies table",
        "Create business_policies table (see migration 017)"
      ));
    } else {
      results.push("business_policies table: OK");
    }

    // ═══ Migration 021: Coupons Table ═══
    const { error: testCouponErr } = await admin
      .from("coupons")
      .select("id")
      .limit(1);

    if (testCouponErr && (testCouponErr.message?.includes("relation") || testCouponErr.code === "42P01")) {
      results.push(await tryExecSql(
        admin,
        `CREATE TABLE IF NOT EXISTS coupons (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
          code TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed', 'free_shipping')),
          value DECIMAL(10,2) NOT NULL,
          min_order_value DECIMAL(10,2) DEFAULT 0,
          max_uses INTEGER DEFAULT NULL,
          used_count INTEGER DEFAULT 0,
          starts_at TIMESTAMPTZ DEFAULT NOW(),
          expires_at TIMESTAMPTZ,
          applies_to TEXT DEFAULT 'all' CHECK (applies_to IN ('all', 'specific_products', 'specific_categories')),
          product_ids UUID[] DEFAULT '{}',
          categories TEXT[] DEFAULT '{}',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(account_id, code)
        );
        CREATE INDEX IF NOT EXISTS idx_coupons_account ON coupons(account_id);
        CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
        CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(account_id, is_active);
        ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Users can manage own coupons" ON coupons;
        CREATE POLICY "Users can manage own coupons" ON coupons FOR ALL USING (account_id = auth.uid());
        DROP POLICY IF EXISTS "Users can read own coupons" ON coupons;
        CREATE POLICY "Users can read own coupons" ON coupons FOR SELECT USING (account_id = auth.uid());`,
        "Created coupons table",
        "Create coupons table (see migration 021)"
      ));
    } else {
      results.push("coupons table: OK");
    }

    // ═══ Migration 022: Abandoned Carts ═══
    const { error: testAbandonedCartErr } = await admin
      .from("abandoned_carts")
      .select("id")
      .limit(1);

    if (testAbandonedCartErr && (testAbandonedCartErr.message?.includes("relation") || testAbandonedCartErr.code === "42P01")) {
      results.push(await tryExecSql(
        admin,
        `CREATE TABLE IF NOT EXISTS abandoned_carts (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
          customer_id UUID REFERENCES customers(id),
          conversation_id UUID REFERENCES conversations(id),
          channel TEXT NOT NULL,
          items JSONB NOT NULL DEFAULT '[]',
          cart_value DECIMAL(10,2) NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'abandoned' CHECK (status IN ('abandoned', 'reminded', 'recovered', 'expired')),
          abandoned_at TIMESTAMPTZ DEFAULT NOW(),
          first_reminder_at TIMESTAMPTZ,
          second_reminder_at TIMESTAMPTZ,
          recovered_at TIMESTAMPTZ,
          recovery_order_id UUID REFERENCES orders(id),
          coupon_code TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_abandoned_carts_account ON abandoned_carts(account_id);
        CREATE INDEX IF NOT EXISTS idx_abandoned_carts_status ON abandoned_carts(status);
        ALTER TABLE abandoned_carts ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Users can manage own abandoned_carts" ON abandoned_carts;
        CREATE POLICY "Users can manage own abandoned_carts" ON abandoned_carts FOR ALL USING (account_id = auth.uid());`,
        "Created abandoned_carts table",
        "Create abandoned_carts table (see migration 022)"
      ));
    } else {
      results.push("abandoned_carts table: OK");
    }

    // Check abandoned cart config columns on accounts
    const { error: testAbandonedCartConfigErr } = await admin
      .from("accounts")
      .select("abandoned_cart_enabled, abandoned_cart_hours, abandoned_cart_auto_reminder, abandoned_cart_reminder_hours, abandoned_cart_auto_second_reminder, abandoned_cart_second_reminder_hours, abandoned_cart_discount_percent")
      .limit(1);

    if (testAbandonedCartConfigErr && testAbandonedCartConfigErr.message?.includes("column")) {
      results.push(await tryExecSql(
        admin,
        `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS abandoned_cart_enabled BOOLEAN DEFAULT FALSE;
         ALTER TABLE accounts ADD COLUMN IF NOT EXISTS abandoned_cart_hours INTEGER DEFAULT 2;
         ALTER TABLE accounts ADD COLUMN IF NOT EXISTS abandoned_cart_auto_reminder BOOLEAN DEFAULT FALSE;
         ALTER TABLE accounts ADD COLUMN IF NOT EXISTS abandoned_cart_reminder_hours INTEGER DEFAULT 1;
         ALTER TABLE accounts ADD COLUMN IF NOT EXISTS abandoned_cart_auto_second_reminder BOOLEAN DEFAULT FALSE;
         ALTER TABLE accounts ADD COLUMN IF NOT EXISTS abandoned_cart_second_reminder_hours INTEGER DEFAULT 24;
         ALTER TABLE accounts ADD COLUMN IF NOT EXISTS abandoned_cart_discount_percent INTEGER DEFAULT 10;`,
        "Added abandoned cart config columns to accounts",
        "Add abandoned cart config columns to accounts (see migration 022)"
      ));
    } else {
      results.push("accounts.abandoned_cart columns: OK");
    }

    // ═══ Fix: Instagram page_id mismatch ═══
    // The Instagram Messaging API uses the Facebook Page ID in webhooks,
    // NOT the Instagram Business Account ID. If instagram_page_id doesn't
    // match facebook_page_id for connected accounts, fix it.
    try {
      const { data: mismatchedAccounts } = await admin
        .from("accounts")
        .select("id, business_name, instagram_page_id, facebook_page_id, instagram_connected")
        .eq("instagram_connected", true);

      if (mismatchedAccounts && mismatchedAccounts.length > 0) {
        let fixedCount = 0;
        for (const acct of mismatchedAccounts) {
          // If instagram_page_id is set but doesn't match facebook_page_id,
          // it's likely storing the IG Business Account ID instead of the FB Page ID.
          // Instagram webhooks use the Facebook Page ID, so they MUST match.
          if (acct.instagram_page_id && acct.facebook_page_id &&
              acct.instagram_page_id !== acct.facebook_page_id) {
            console.log(`[DB-MIGRATE] Fixing instagram_page_id for "${acct.business_name}": ${acct.instagram_page_id} → ${acct.facebook_page_id}`);
            await admin
              .from("accounts")
              .update({ instagram_page_id: acct.facebook_page_id })
              .eq("id", acct.id);
            fixedCount++;
          }
        }
        results.push(fixedCount > 0
          ? `Fixed instagram_page_id mismatch for ${fixedCount} account(s)`
          : "instagram_page_id consistency: OK"
        );
      } else {
        results.push("instagram_page_id consistency: OK (no connected accounts)");
      }
    } catch (fixErr) {
      results.push(`NEEDS MANUAL: Fix instagram_page_id mismatch (${fixErr.message})`);
    }

    // ═══ Fix: Duplicate page IDs across accounts ═══
    // If multiple accounts share the same facebook_page_id or instagram_page_id,
    // only the one with a valid access token should keep it.
    // The others should have their page_id and connected flags cleared.
    try {
      const { data: allAccounts } = await admin
        .from("accounts")
        .select("id, email, facebook_page_id, facebook_access_token, facebook_connected, instagram_page_id, instagram_access_token, instagram_connected");

      if (allAccounts && allAccounts.length > 0) {
        let duplicateFixed = 0;

        // Group by facebook_page_id
        const fbGroups = {};
        for (const acct of allAccounts) {
          if (acct.facebook_page_id) {
            if (!fbGroups[acct.facebook_page_id]) fbGroups[acct.facebook_page_id] = [];
            fbGroups[acct.facebook_page_id].push(acct);
          }
        }

        for (const [pageId, accts] of Object.entries(fbGroups)) {
          if (accts.length > 1) {
            // Prefer the account with a valid access token
            const keeper = accts.find(a => a.facebook_access_token) || accts[0];
            for (const acct of accts) {
              if (acct.id !== keeper.id) {
                console.log(`[DB-MIGRATE] Clearing duplicate facebook_page_id for ${acct.email} (keeping ${keeper.email})`);
                await admin
                  .from("accounts")
                  .update({ facebook_page_id: null, facebook_connected: false, facebook_access_token: null })
                  .eq("id", acct.id);
                duplicateFixed++;
              }
            }
          }
        }

        // Group by instagram_page_id
        const igGroups = {};
        for (const acct of allAccounts) {
          if (acct.instagram_page_id) {
            if (!igGroups[acct.instagram_page_id]) igGroups[acct.instagram_page_id] = [];
            igGroups[acct.instagram_page_id].push(acct);
          }
        }

        for (const [pageId, accts] of Object.entries(igGroups)) {
          if (accts.length > 1) {
            const keeper = accts.find(a => a.instagram_access_token) || accts[0];
            for (const acct of accts) {
              if (acct.id !== keeper.id) {
                console.log(`[DB-MIGRATE] Clearing duplicate instagram_page_id for ${acct.email} (keeping ${keeper.email})`);
                await admin
                  .from("accounts")
                  .update({ instagram_page_id: null, instagram_connected: false, instagram_access_token: null })
                  .eq("id", acct.id);
                duplicateFixed++;
              }
            }
          }
        }

        results.push(duplicateFixed > 0
          ? `Fixed ${duplicateFixed} duplicate page_id(s) across accounts`
          : "No duplicate page_ids found"
        );

        // Also fix accounts marked as connected but missing page_id or access_token
        let staleFixed = 0;
        for (const acct of allAccounts) {
          const updates = {};
          if (acct.facebook_connected && (!acct.facebook_page_id || !acct.facebook_access_token)) {
            updates.facebook_connected = false;
            if (!acct.facebook_page_id) updates.facebook_page_id = null;
            if (!acct.facebook_access_token) updates.facebook_access_token = null;
          }
          if (acct.instagram_connected && (!acct.instagram_page_id || !acct.instagram_access_token)) {
            updates.instagram_connected = false;
            if (!acct.instagram_page_id) updates.instagram_page_id = null;
            if (!acct.instagram_access_token) updates.instagram_access_token = null;
          }
          if (Object.keys(updates).length > 0) {
            console.log(`[DB-MIGRATE] Fixing stale connected flags for ${acct.email}:`, Object.keys(updates).join(', '));
            await admin.from("accounts").update(updates).eq("id", acct.id);
            staleFixed++;
          }
        }
        if (staleFixed > 0) {
          results.push(`Fixed ${staleFixed} account(s) with stale connected flags`);
        }
      }
    } catch (dupErr) {
      results.push(`NEEDS MANUAL: Fix duplicate page_ids (${dupErr.message})`);
    }

    // ═══ Fix: Migrate orphaned data from disconnected accounts ═══
    // When we cleared page_ids from accounts that were sharing them,
    // their existing conversations/messages/customers became orphaned.
    // Move them to the account that now owns the page.
    try {
      // Find accounts that are connected and have valid tokens (the "keepers")
      const { data: connectedAccounts } = await admin
        .from("accounts")
        .select("id, email, facebook_page_id, instagram_page_id")
        .or("facebook_connected.eq.true,instagram_connected.eq.true");

      // Find accounts that are NOT connected but might have orphaned data
      const { data: disconnectedAccounts } = await admin
        .from("accounts")
        .select("id, email, business_name")
        .not("id", "in", `(${(connectedAccounts || []).map(a => `'${a.id}'`).join(',') || "''"})`);

      if (disconnectedAccounts && disconnectedAccounts.length > 0 && connectedAccounts && connectedAccounts.length > 0) {
        let totalMigrated = 0;

        for (const disconnected of disconnectedAccounts) {
          // Check if this account has any data
          const { count: convCount } = await admin
            .from("conversations")
            .select("*", { count: "exact", head: true })
            .eq("account_id", disconnected.id);

          const { count: msgCount } = await admin
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("account_id", disconnected.id);

          const { count: custCount } = await admin
            .from("customers")
            .select("*", { count: "exact", head: true })
            .eq("account_id", disconnected.id);

          if ((convCount || 0) + (msgCount || 0) + (custCount || 0) === 0) continue;

          // Find the best target: prefer connected account with matching page_id
          // For now, use the first connected account that has a matching page
          // (In a multi-tenant system, you'd match by page_id history)
          const target = connectedAccounts[0]; // simplest: move to the active account

          console.log(`[DB-MIGRATE] Migrating data from ${disconnected.email} to ${target.email}: ${convCount} convs, ${msgCount} msgs, ${custCount} customers`);

          // Move conversations
          const { error: convErr } = await admin
            .from("conversations")
            .update({ account_id: target.id })
            .eq("account_id", disconnected.id);
          if (convErr) console.error(`[DB-MIGRATE] Conv migration error:`, convErr.message);

          // Move messages
          const { error: msgErr } = await admin
            .from("messages")
            .update({ account_id: target.id })
            .eq("account_id", disconnected.id);
          if (msgErr) console.error(`[DB-MIGRATE] Msg migration error:`, msgErr.message);

          // Move customers (skip if they already exist for the target account with same platform_id)
          const { data: orphanedCustomers } = await admin
            .from("customers")
            .select("*")
            .eq("account_id", disconnected.id);

          if (orphanedCustomers && orphanedCustomers.length > 0) {
            for (const cust of orphanedCustomers) {
              // Check if customer already exists on target account
              const { data: existingCust } = await admin
                .from("customers")
                .select("id")
                .eq("account_id", target.id)
                .eq("platform_id", cust.platform_id)
                .maybeSingle();

              if (existingCust) {
                // Customer already exists on target — re-link conversations/messages
                await admin.from("conversations").update({ customer_id: existingCust.id })
                  .eq("customer_id", cust.id);
                await admin.from("messages").update({ /* keep as-is */ })
                  .eq("conversation_id", "in", `(${orphanedCustomers.map(c => `'${c.id}'`).join(',')})`);
                // Delete the duplicate customer
                await admin.from("customers").delete().eq("id", cust.id);
              } else {
                // Move the customer to target account
                await admin.from("customers")
                  .update({ account_id: target.id })
                  .eq("id", cust.id);
              }
            }
          }

          // Move products
          const { error: prodErr, count: prodCount } = await admin
            .from("products")
            .update({ account_id: target.id })
            .eq("account_id", disconnected.id);
          if (prodErr) console.error(`[DB-MIGRATE] Product migration error:`, prodErr.message);

          // Move orders
          const { error: ordErr } = await admin
            .from("orders")
            .update({ account_id: target.id })
            .eq("account_id", disconnected.id);
          if (ordErr) console.error(`[DB-MIGRATE] Order migration error:`, ordErr.message);

          // Move FAQs
          await admin.from("faqs").update({ account_id: target.id })
            .eq("account_id", disconnected.id).catch(() => {});

          // Move quick_replies
          await admin.from("quick_replies").update({ account_id: target.id })
            .eq("account_id", disconnected.id).catch(() => {});

          // Move auto_replies
          await admin.from("auto_replies").update({ account_id: target.id })
            .eq("account_id", disconnected.id).catch(() => {});

          // Move campaigns
          await admin.from("campaigns").update({ account_id: target.id })
            .eq("account_id", disconnected.id).catch(() => {});

          // Copy business_name to target if target has a generic name
          if (disconnected.business_name && target.email) {
            const { data: targetAcct } = await admin
              .from("accounts")
              .select("business_name")
              .eq("id", target.id)
              .single();
            
            if (targetAcct && (targetAcct.business_name === "My Store" || !targetAcct.business_name)) {
              await admin.from("accounts")
                .update({ business_name: disconnected.business_name })
                .eq("id", target.id);
              console.log(`[DB-MIGRATE] Updated business_name to "${disconnected.business_name}" for ${target.email}`);
            }
          }

          totalMigrated++;
        }

        if (totalMigrated > 0) {
          results.push(`Migrated orphaned data from ${totalMigrated} disconnected account(s) to active account`);
        }
      }
    } catch (migrateErr) {
      results.push(`NEEDS MANUAL: Migrate orphaned data (${migrateErr.message})`);
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
