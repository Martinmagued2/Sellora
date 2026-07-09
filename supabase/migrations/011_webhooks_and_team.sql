-- ============================================
-- Migration 011: Webhooks & Team Collaboration
-- ============================================

-- ============================================
-- ACCOUNT WEBHOOKS (for integrations)
-- ============================================
CREATE TABLE IF NOT EXISTS account_webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY['order.created'],
  secret TEXT,              -- Signing secret for HMAC verification
  is_active BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  last_status_code INTEGER,
  failure_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhooks_account ON account_webhooks(account_id);

-- ============================================
-- TEAM MEMBERS (multi-user collaboration)
-- ============================================
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
  invited_email TEXT,
  invite_status TEXT DEFAULT 'pending' CHECK (invite_status IN ('pending', 'accepted', 'revoked')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(account_id, user_id)
);

CREATE INDEX idx_team_account ON team_members(account_id);
CREATE INDEX idx_team_user ON team_members(user_id);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Webhooks: only account owner can manage
ALTER TABLE account_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own webhooks"
  ON account_webhooks FOR ALL
  USING (account_id = auth.uid());

-- Team members: owner can manage, members can read
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage team members"
  ON team_members FOR ALL
  USING (account_id = auth.uid());

CREATE POLICY "Team members can read own membership"
  ON team_members FOR SELECT
  USING (user_id = auth.uid());

-- ============================================
-- UPDATE TRIGGERS
-- ============================================
CREATE TRIGGER update_webhooks_updated_at
  BEFORE UPDATE ON account_webhooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_team_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
