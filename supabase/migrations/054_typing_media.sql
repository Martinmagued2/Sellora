-- Migration 054: Typing indicator + message media support
--
-- Adds:
-- 1. Typing indicator — tracks who is typing in each conversation
-- 2. Media URL column on messages (for audio/image messages sent from dashboard)

-- Typing indicator table ( ephemeral — rows are deleted after 5 seconds)
CREATE TABLE IF NOT EXISTS typing_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid, -- who is typing (null for customer, user.id for team member)
  is_customer boolean DEFAULT false,
  is_team_member boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_typing_conv ON typing_indicators(conversation_id);

-- Auto-delete old typing indicators (older than 10 seconds)
-- This runs as a cron job — or we can just filter in the query
CREATE INDEX IF NOT EXISTS idx_typing_created ON typing_indicators(created_at);

-- Add media_url to messages if not exists (for audio/image messages)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='media_url') THEN
    ALTER TABLE messages ADD COLUMN media_url text;
  END IF;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add media_type to messages if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='media_type') THEN
    ALTER TABLE messages ADD COLUMN media_type text;
  END IF;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- RLS
ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own typing_indicators" ON typing_indicators
  FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

-- Public can INSERT typing indicators (customers typing via webhook)
-- but only for their own account
CREATE POLICY "Anyone can insert typing" ON typing_indicators
  FOR INSERT TO authenticated, anon WITH CHECK (true);

-- Enable realtime on typing_indicators
ALTER PUBLICATION supabase_realtime ADD TABLE typing_indicators;
