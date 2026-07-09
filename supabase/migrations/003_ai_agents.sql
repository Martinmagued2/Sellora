-- Add agent-related columns to messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS agent_type TEXT 
  CHECK (agent_type IN ('sales', 'support', 'order_tracking', 'copilot', 'general'));
ALTER TABLE messages ADD COLUMN IF NOT EXISTS tool_calls JSONB DEFAULT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS tool_results JSONB DEFAULT NULL;

-- Add routing metadata to conversations  
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS current_agent TEXT
  CHECK (current_agent IN ('sales', 'support', 'order_tracking', NULL));
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS agent_handoff_count INTEGER DEFAULT 0;

-- Agent action log for audit trail
CREATE TABLE IF NOT EXISTS agent_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id),
  agent_type TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  tool_input JSONB,
  tool_output JSONB,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_actions_account ON agent_actions(account_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_conv ON agent_actions(conversation_id);

-- RLS for agent_actions
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own agent actions"
  ON agent_actions FOR SELECT
  USING (account_id = auth.uid());
