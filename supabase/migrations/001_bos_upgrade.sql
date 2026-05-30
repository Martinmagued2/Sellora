-- ============================================
-- Sellora BOS Upgrade Migration
-- Run this in Supabase SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS)
-- ============================================

-- ============================================
-- CUSTOMERS — Add platform identity & enrichment
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='platform_id') THEN
    ALTER TABLE customers ADD COLUMN platform_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='platform') THEN
    ALTER TABLE customers ADD COLUMN platform TEXT DEFAULT 'instagram' CHECK (platform IN ('whatsapp', 'instagram', 'facebook'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='first_seen_at') THEN
    ALTER TABLE customers ADD COLUMN first_seen_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='is_returning') THEN
    ALTER TABLE customers ADD COLUMN is_returning BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='address') THEN
    ALTER TABLE customers ADD COLUMN address TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='profile_pic_url') THEN
    ALTER TABLE customers ADD COLUMN profile_pic_url TEXT;
  END IF;
END $$;

-- Unique index on platform_id per account (prevents duplicate customers per platform)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_platform_id 
  ON customers(account_id, platform_id) WHERE platform_id IS NOT NULL;

-- ============================================
-- MESSAGES — Add intent, media, response tracking
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='intent') THEN
    ALTER TABLE messages ADD COLUMN intent TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='media_urls') THEN
    ALTER TABLE messages ADD COLUMN media_urls TEXT[];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='platform_message_id') THEN
    ALTER TABLE messages ADD COLUMN platform_message_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='response_time_seconds') THEN
    ALTER TABLE messages ADD COLUMN response_time_seconds INTEGER;
  END IF;
END $$;

-- Allow 'product_card' as a message type
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_type_check 
  CHECK (type IN ('text', 'image', 'video', 'document', 'audio', 'template', 'interactive', 'product_card'));

-- ============================================
-- CONVERSATIONS — Richer status tracking
-- ============================================

-- First drop the old check constraint, then re-add with new values
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_status_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_status_check 
  CHECK (status IN ('new', 'open', 'in_progress', 'waiting_customer', 'closed', 'archived'));

-- Update existing 'open' rows to 'new' (optional, preserves old data)
-- UPDATE conversations SET status = 'new' WHERE status = 'open';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='tags') THEN
    ALTER TABLE conversations ADD COLUMN tags TEXT[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='first_response_at') THEN
    ALTER TABLE conversations ADD COLUMN first_response_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='resolved_at') THEN
    ALTER TABLE conversations ADD COLUMN resolved_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='converted') THEN
    ALTER TABLE conversations ADD COLUMN converted BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='platform_thread_id') THEN
    ALTER TABLE conversations ADD COLUMN platform_thread_id TEXT;
  END IF;
END $$;

-- Allow 'facebook' as a channel
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_channel_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_channel_check 
  CHECK (channel IN ('whatsapp', 'instagram', 'facebook'));

-- ============================================
-- ORDERS — Link to conversations
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='conversation_id') THEN
    ALTER TABLE orders ADD COLUMN conversation_id UUID REFERENCES conversations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='source') THEN
    ALTER TABLE orders ADD COLUMN source TEXT DEFAULT 'manual' CHECK (source IN ('chat', 'manual', 'api'));
  END IF;
END $$;

-- Allow 'facebook' as an order channel
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_channel_check;
ALTER TABLE orders ADD CONSTRAINT orders_channel_check 
  CHECK (channel IN ('whatsapp', 'instagram', 'facebook', 'manual'));

-- Allow 'facebook' as a customer channel
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_channel_check;
ALTER TABLE customers ADD CONSTRAINT customers_channel_check
  CHECK (channel IN ('whatsapp', 'instagram', 'facebook', 'manual'));

-- ============================================
-- ACCOUNTS — Instagram & Facebook tokens
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='instagram_page_id') THEN
    ALTER TABLE accounts ADD COLUMN instagram_page_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='instagram_access_token') THEN
    ALTER TABLE accounts ADD COLUMN instagram_access_token TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='instagram_connected') THEN
    ALTER TABLE accounts ADD COLUMN instagram_connected BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='facebook_page_id') THEN
    ALTER TABLE accounts ADD COLUMN facebook_page_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='facebook_access_token') THEN
    ALTER TABLE accounts ADD COLUMN facebook_access_token TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='facebook_connected') THEN
    ALTER TABLE accounts ADD COLUMN facebook_connected BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- ============================================
-- AUTO REPLIES table
-- ============================================
CREATE TABLE IF NOT EXISTS auto_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  trigger_keyword TEXT NOT NULL,
  response TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  match_type TEXT DEFAULT 'contains' CHECK (match_type IN ('exact', 'contains', 'starts_with')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE auto_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own auto_replies" ON auto_replies;
CREATE POLICY "Users can manage own auto_replies"
  ON auto_replies FOR ALL
  USING (account_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_auto_replies_account ON auto_replies(account_id);

-- ============================================
-- Update conversation on order creation
-- Mark conversation as converted when order linked
-- ============================================
CREATE OR REPLACE FUNCTION mark_conversation_converted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.conversation_id IS NOT NULL THEN
    UPDATE conversations 
    SET converted = TRUE 
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mark_conv_on_order ON orders;
CREATE TRIGGER mark_conv_on_order 
  AFTER INSERT ON orders 
  FOR EACH ROW 
  EXECUTE FUNCTION mark_conversation_converted();

-- ============================================
-- Auto-detect returning customers
-- ============================================
CREATE OR REPLACE FUNCTION detect_returning_customer()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM conversations WHERE customer_id = NEW.customer_id) > 1 THEN
    UPDATE customers SET is_returning = TRUE WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS detect_returning ON conversations;
CREATE TRIGGER detect_returning
  AFTER INSERT ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION detect_returning_customer();
