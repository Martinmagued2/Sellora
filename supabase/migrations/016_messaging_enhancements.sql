-- ============================================
-- MIGRATION 016: Phase 2 Messaging Enhancements
-- Per-channel greetings, greeting delay, broadcast tracking, WhatsApp templates
-- Safe to run multiple times (uses IF NOT EXISTS and DROP POLICY IF EXISTS)
-- ============================================

-- 1. Add per-channel greeting columns to accounts
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS instagram_greeting TEXT;

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS facebook_greeting TEXT;

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS whatsapp_greeting TEXT;

-- 2. Add greeting delay column (seconds to wait before sending auto-greeting)
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS greeting_delay_seconds INTEGER DEFAULT 0;

-- 3. Add greeting_enabled_per_channel flag (to use per-channel vs global greeting)
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS greeting_per_channel BOOLEAN DEFAULT FALSE;

-- 4. WhatsApp Business API columns (if not already present)
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS whatsapp_connected BOOLEAN DEFAULT FALSE;

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id TEXT;

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS whatsapp_access_token TEXT;

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS whatsapp_business_account_id TEXT;

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS whatsapp_webhook_verify_token TEXT;

-- 5. Add broadcast_logs table for tracking broadcast message delivery
CREATE TABLE IF NOT EXISTS broadcast_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  broadcast_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id),
  channel TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  platform_message_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_logs_account ON broadcast_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_logs_broadcast ON broadcast_logs(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_logs_status ON broadcast_logs(account_id, status);

ALTER TABLE broadcast_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own broadcast_logs" ON broadcast_logs;
CREATE POLICY "Users can manage own broadcast_logs"
  ON broadcast_logs FOR ALL
  USING (account_id = auth.uid());

-- 6. Add quick_reply_shortcut column (keyboard shortcut like /thanks)
ALTER TABLE quick_replies
ADD COLUMN IF NOT EXISTS shortcut TEXT;

-- Create unique index for shortcut per account
CREATE UNIQUE INDEX IF NOT EXISTS idx_quick_replies_shortcut ON quick_replies(account_id, shortcut) WHERE shortcut IS NOT NULL;

-- 7. Add template_name column to campaigns for WhatsApp template messages
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS template_name TEXT;

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS template_language TEXT DEFAULT 'en';

-- 8. Add last_broadcast_at to customers for tracking when they last received a broadcast
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS last_broadcast_at TIMESTAMPTZ;

-- 9. Add is_ai flag to conversations for filtering bot vs human conversations
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS is_ai_handled BOOLEAN DEFAULT FALSE;
