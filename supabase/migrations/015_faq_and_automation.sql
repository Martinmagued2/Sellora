-- ============================================
-- MIGRATION: FAQ table, automation columns, sentiment, conversation summaries
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

CREATE POLICY "Users can manage own faqs"
  ON faqs FOR ALL
  USING (account_id = auth.uid());

-- Auto-update updated_at trigger for faqs
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
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS tool_calls TEXT;

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

-- 21. Create agent_actions table if not exists
CREATE TABLE IF NOT EXISTS agent_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id),
  agent_type TEXT,
  tool_name TEXT,
  tool_input JSONB,
  success BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_actions_account ON agent_actions(account_id);

-- Enable RLS on agent_actions
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own agent_actions"
  ON agent_actions FOR ALL
  USING (account_id = auth.uid());

-- 22. Create auto_replies table if not exists
CREATE TABLE IF NOT EXISTS auto_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  trigger_keyword TEXT NOT NULL,
  response TEXT NOT NULL,
  match_type TEXT DEFAULT 'contains' CHECK (match_type IN ('exact', 'starts_with', 'contains')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_replies_account ON auto_replies(account_id);

ALTER TABLE auto_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own auto_replies"
  ON auto_replies FOR ALL
  USING (account_id = auth.uid());

-- 23. Create rate_limits table if not exists
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_email_action ON rate_limits(email, action);

-- 24. Create team_members table if not exists
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own team_members"
  ON team_members FOR ALL
  USING (account_id = auth.uid());

-- 25. Create account_webhooks table if not exists
CREATE TABLE IF NOT EXISTS account_webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE account_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own webhooks"
  ON account_webhooks FOR ALL
  USING (account_id = auth.uid());
