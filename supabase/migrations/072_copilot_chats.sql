-- 072_copilot_chats.sql
-- Persistent chat history for the Sellora Copilot.
-- Previously chats were in-memory only (lost on page refresh).
-- This migration adds tables for saving + retrieving past conversations.

CREATE TABLE IF NOT EXISTS copilot_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,  -- auth.uid() — the user who created the chat
  title TEXT DEFAULT 'New Chat',
  pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS copilot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES copilot_chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,  -- the message text (plain text, not JSONB — simpler)
  tool_data JSONB,        -- optional: tool invocations + results (JSON)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_copilot_chats_account
  ON copilot_chats (account_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_copilot_chats_pinned
  ON copilot_chats (account_id, pinned, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_copilot_messages_chat
  ON copilot_messages (chat_id, created_at ASC);

-- RLS
ALTER TABLE copilot_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE copilot_messages ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see/manage their own account's chats
DROP POLICY IF EXISTS "Users can manage own copilot_chats" ON copilot_chats;
CREATE POLICY "Users can manage own copilot_chats"
  ON copilot_chats FOR ALL
  TO authenticated
  USING (
    account_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.account_id = copilot_chats.account_id
        AND team_members.user_id = auth.uid()
        AND team_members.invite_status = 'accepted'
    )
  )
  WITH CHECK (
    account_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.account_id = copilot_chats.account_id
        AND team_members.user_id = auth.uid()
        AND team_members.invite_status = 'accepted'
    )
  );

DROP POLICY IF EXISTS "Users can manage own copilot_messages" ON copilot_messages;
CREATE POLICY "Users can manage own copilot_messages"
  ON copilot_messages FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM copilot_chats
      WHERE copilot_chats.id = copilot_messages.chat_id
        AND (
          copilot_chats.account_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.account_id = copilot_chats.account_id
              AND team_members.user_id = auth.uid()
              AND team_members.invite_status = 'accepted'
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM copilot_chats
      WHERE copilot_chats.id = copilot_messages.chat_id
        AND (
          copilot_chats.account_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.account_id = copilot_chats.account_id
              AND team_members.user_id = auth.uid()
              AND team_members.invite_status = 'accepted'
          )
        )
    )
  );
