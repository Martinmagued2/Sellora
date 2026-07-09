-- ============================================
-- MIGRATION: Add missing columns used by the app
-- ============================================

-- 1. Add account_id to messages table for direct querying
-- (Currently, messages belong to conversations which belong to accounts.
--  Adding account_id directly makes queries much simpler and faster.)
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id);

-- Backfill account_id from conversations
UPDATE messages m
SET account_id = c.account_id
FROM conversations c
WHERE m.conversation_id = c.id AND m.account_id IS NULL;

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_messages_account_id ON messages(account_id);

-- 2. Add missing columns to accounts table
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{"new_message": true, "new_order": true, "order_status": true, "daily_summary": false}';

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS instagram_url TEXT;

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS facebook_url TEXT;

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS website_url TEXT;

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS billing_address JSONB;

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- 3. Add trigger to auto-set account_id on new messages
CREATE OR REPLACE FUNCTION set_message_account_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.account_id IS NULL AND NEW.conversation_id IS NOT NULL THEN
    SELECT account_id INTO NEW.account_id
    FROM conversations
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_message_account_id ON messages;
CREATE TRIGGER trg_set_message_account_id
  BEFORE INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION set_message_account_id();
