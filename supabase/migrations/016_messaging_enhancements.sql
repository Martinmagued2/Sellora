-- ============================================
-- MIGRATION 016: Messaging Enhancements (Phase 2)
-- - WhatsApp integration columns on accounts
-- - Broadcast logs for campaign tracking
-- - Per-channel auto-greeting support
-- - Quick reply enhancements (short_code, is_default)
-- Safe to run multiple times (uses IF NOT EXISTS and DROP POLICY IF EXISTS)
-- ============================================

-- ============================================
-- 1. WhatsApp Integration columns on accounts
-- ============================================
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS whatsapp_connected BOOLEAN DEFAULT FALSE;

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id TEXT;

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS whatsapp_access_token TEXT;

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS whatsapp_webhook_verify_token TEXT;

-- ============================================
-- 2. Broadcast logs table (per-recipient delivery tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS broadcast_logs (
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
CREATE INDEX IF NOT EXISTS idx_broadcast_logs_customer ON broadcast_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_logs_status ON broadcast_logs(account_id, campaign_id, status);

-- Enable RLS on broadcast_logs
ALTER TABLE broadcast_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own broadcast_logs" ON broadcast_logs;
CREATE POLICY "Users can manage own broadcast_logs"
  ON broadcast_logs FOR ALL
  USING (account_id = auth.uid());

-- ============================================
-- 3. Per-channel auto-greeting columns
-- ============================================
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS auto_greeting_instagram TEXT DEFAULT 'Hi {name}! Welcome to {business_name} 👋 How can we help you today?';

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS auto_greeting_facebook TEXT DEFAULT 'Hi {name}! Welcome to {business_name} 👋 How can we help you today?';

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS auto_greeting_whatsapp TEXT DEFAULT 'Hi {name}! Welcome to {business_name} 👋 How can we help you today?';

-- ============================================
-- 4. Quick reply enhancements
-- ============================================
ALTER TABLE quick_replies
ADD COLUMN IF NOT EXISTS short_code TEXT;

ALTER TABLE quick_replies
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;

ALTER TABLE quick_replies
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create unique index on short_code per account
CREATE UNIQUE INDEX IF NOT EXISTS idx_quick_replies_short_code ON quick_replies(account_id, short_code) WHERE short_code IS NOT NULL;

-- Auto-update trigger for quick_replies
DROP TRIGGER IF EXISTS update_quick_replies_updated_at ON quick_replies;
CREATE TRIGGER update_quick_replies_updated_at BEFORE UPDATE ON quick_replies FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 5. Campaign enhancements - add channel column and template_type
-- ============================================
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'all' CHECK (channel IN ('all', 'instagram', 'facebook', 'whatsapp'));

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS template_type TEXT DEFAULT 'text' CHECK (template_type IN ('text', 'template'));

-- ============================================
-- 6. Messages - add platform delivery status tracking
-- ============================================
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS delivery_status TEXT CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'read', 'failed'));

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- ============================================
-- 7. Add whatsapp_message_id to messages if not exists
-- ============================================
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS whatsapp_message_id TEXT;

-- ============================================
-- 8. Customer last_contacted_at for campaign cooldown
-- ============================================
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;

-- ============================================
-- 9. Add broadcast_type to campaigns for future bulk messaging
-- ============================================
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS broadcast_type TEXT DEFAULT 'promotional' CHECK (broadcast_type IN ('promotional', 'transactional', 'reminder'));
