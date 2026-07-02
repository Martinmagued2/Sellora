-- 059_email_system.sql
-- Email system overhaul: centralized email log + unsubscribe management
-- Part of the email rebuild — fixes 19 known bugs and adds production-grade
-- email infrastructure (logging, bounce tracking, opt-out, audit).

-- ─────────────────────────────────────────────────────────────────────
-- 1. email_log — every outbound email gets a row
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  from_email TEXT,
  subject TEXT NOT NULL,
  template_name TEXT,            -- welcome, password_reset, team_invite, weekly_summary, drip, order_confirmation, plan_upgrade, escalation, custom, notification, abandoned_cart, lifecycle, winback, ...
  resend_id TEXT,                -- id returned by Resend
  status TEXT NOT NULL DEFAULT 'sent',  -- sent | bounced | delivered | complained | failed | unsubscribed
  error TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,  -- arbitrary context (customer_id, order_id, etc.)
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  complained_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_log_account ON email_log(account_id);
CREATE INDEX IF NOT EXISTS idx_email_log_to ON email_log(to_email);
CREATE INDEX IF NOT EXISTS idx_email_log_template ON email_log(template_name);
CREATE INDEX IF NOT EXISTS idx_email_log_sent_at ON email_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_resend_id ON email_log(resend_id);

-- ─────────────────────────────────────────────────────────────────────
-- 2. email_unsubscribes — opt-out registry (CAN-SPAM + GDPR compliance)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_unsubscribes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  template_type TEXT NOT NULL DEFAULT 'all',  -- all | marketing | drip | weekly_summary | notifications | ...
  token TEXT UNIQUE NOT NULL,                  -- for /api/email/unsubscribe?token=...
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email, account_id, template_type)
);

CREATE INDEX IF NOT EXISTS idx_email_unsubscribes_email ON email_unsubscribes(email);
CREATE INDEX IF NOT EXISTS idx_email_unsubscribes_token ON email_unsubscribes(token);

-- ─────────────────────────────────────────────────────────────────────
-- 3. email_channel_address column — fix the missing column referenced
--    by /api/email-channel/route.js (now consolidated into email_inbound_address)
-- ─────────────────────────────────────────────────────────────────────
-- We add it as an alias for backward compat, pointing to the same value.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email_channel_address TEXT;

-- ─────────────────────────────────────────────────────────────────────
-- 4. weekly_summary_opt_out column — fix the comment lie in weekly-summary-cron
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS weekly_summary_opt_out BOOLEAN DEFAULT FALSE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email_drip_opt_out BOOLEAN DEFAULT FALSE;

-- ─────────────────────────────────────────────────────────────────────
-- 5. Backfill email_channel_address from email_inbound_address for existing rows
-- ─────────────────────────────────────────────────────────────────────
UPDATE accounts
SET email_channel_address = email_inbound_address
WHERE email_channel_address IS NULL AND email_inbound_address IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 6. RLS for email_log and email_unsubscribes
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_unsubscribes ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, which is what all our routes use.
-- Add explicit policies for safety:
CREATE POLICY email_log_select_own ON email_log
  FOR SELECT USING (auth.uid() = account_id);
CREATE POLICY email_log_insert_own ON email_log
  FOR INSERT WITH CHECK (auth.uid() = account_id);

CREATE POLICY email_unsubscribes_select_own ON email_unsubscribes
  FOR SELECT USING (auth.uid() = account_id OR token IS NOT NULL);
CREATE POLICY email_unsubscribes_insert_any ON email_unsubscribes
  FOR INSERT WITH CHECK (true);  -- anyone can unsubscribe themselves

-- ─────────────────────────────────────────────────────────────────────
-- 7. Grants
-- ─────────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON email_log TO authenticated, anon;
GRANT SELECT, INSERT, DELETE ON email_unsubscribes TO authenticated, anon;

-- Done.
