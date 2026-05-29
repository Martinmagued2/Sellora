-- ============================================
-- MIGRATION 015: FAQ table, automation columns, sentiment, conversation summaries, quick replies, auto-greeting
-- Safe to run multiple times (uses IF NOT EXISTS and DROP POLICY IF EXISTS)
-- ============================================

-- 1. Create FAQs table
CREATE TABLE IF NOT EXISTS faqs (
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
CREATE INDEX IF NOT EXISTS idx_faqs_active ON faqs(account_id, is_active);

-- Enable RLS on faqs
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own faqs" ON faqs;
CREATE POLICY "Users can manage own faqs"
  ON faqs FOR ALL
  USING (account_id = auth.uid());

-- Auto-update updated_at trigger for faqs
DROP TRIGGER IF EXISTS update_faqs_updated_at ON faqs;
CREATE TRIGGER update_faqs_updated_at BEFORE UPDATE ON faqs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. Add sentiment column to messages table
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'urgent'));

-- 3. Add summary column to conversations table
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS summary TEXT;

-- 4. Add auto_follow_up_enabled column to accounts table
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS auto_follow_up_enabled BOOLEAN DEFAULT FALSE;

-- 5. Add platform_id to customers if not exists (for webhook dedup)
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS platform_id TEXT;

-- Create unique index for platform_id per account if not exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_account_platform_id ON customers(account_id, platform_id);

-- 6. Add first_response_at to conversations if not exists
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ;

-- 7. Add resolved_at to conversations if not exists
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- 8. Add tags column to conversations if not exists
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- 9. Add source column to orders if not exists
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS source TEXT;

-- 10. Add conversation_id to orders if not exists
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id);

-- 11. Add profile_pic_url to customers if not exists
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS profile_pic_url TEXT;

-- 12. Add is_returning to customers if not exists
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS is_returning BOOLEAN DEFAULT FALSE;

-- 13. Add first_seen_at to customers if not exists
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT NOW();

-- 14. Add address to customers if not exists
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS address TEXT;

-- 15. Add response_time_seconds to messages if not exists
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS response_time_seconds INTEGER;

-- 16. Add agent_type to messages if not exists
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS agent_type TEXT;

-- 17. Add tool_calls to messages if not exists
DO $$ BEGIN
  -- Check if tool_calls column exists and is TEXT type; the original migration 003 made it JSONB
  -- We want JSONB, so only add if column doesn't exist at all
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='tool_calls') THEN
    ALTER TABLE messages ADD COLUMN tool_calls JSONB DEFAULT NULL;
  END IF;
END $$;

-- 18. Add media_urls to messages if not exists (as array)
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS media_urls TEXT[];

-- 19. Add instagram_connected, facebook_connected columns to accounts if not exists
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS instagram_connected BOOLEAN DEFAULT FALSE;

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS instagram_page_id TEXT;

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS instagram_access_token TEXT;

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS facebook_connected BOOLEAN DEFAULT FALSE;

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS facebook_page_id TEXT;

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS facebook_access_token TEXT;

-- 20. Add platform_thread_id to conversations if not exists
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS platform_thread_id TEXT;

-- 21. agent_actions table already created in migration 003 — skip
-- Just ensure RLS policy exists (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agent_actions' AND policyname = 'Users can view own agent actions'
  ) THEN
    CREATE POLICY "Users can view own agent actions"
      ON agent_actions FOR SELECT
      USING (account_id = auth.uid());
  END IF;
END $$;

-- 22. auto_replies table already created in migration 001 — skip
-- Policy already exists from migration 001 with DROP POLICY IF EXISTS pattern

-- 23. rate_limits table already created in migration 005 — skip

-- 24. team_members table already created in migration 011 — skip
-- Policies already exist from migration 011

-- 25. account_webhooks table already created in migration 011 — skip
-- Policy already exists from migration 011

-- ============================================
-- NEW TABLES: Quick replies
-- ============================================

-- 26. Create quick_replies table
CREATE TABLE IF NOT EXISTS quick_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quick_replies_account ON quick_replies(account_id);

ALTER TABLE quick_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own quick_replies" ON quick_replies;
CREATE POLICY "Users can manage own quick_replies"
  ON quick_replies FOR ALL
  USING (account_id = auth.uid());

-- 27. Add auto_greeting and auto_greeting_message columns to accounts table
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS auto_greeting BOOLEAN DEFAULT FALSE;

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS auto_greeting_message TEXT DEFAULT 'Hi! Welcome to {business_name} 👋 How can I help you today?';

-- 28. Add tags column to customers if not exists (for VIP, new, returning tags)
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- 29. Add total_spent to customers if not exists
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS total_spent NUMERIC DEFAULT 0;

-- 30. Add total_orders to customers if not exists
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0;
