-- 073_api_keys.sql
-- API keys for Sellora's public REST API.
-- Allows external developers to access Sellora data programmatically.

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default Key',
  key_hash TEXT NOT NULL UNIQUE,  -- SHA-256 hash of the API key (never store plaintext)
  key_prefix TEXT NOT NULL,       -- First 8 chars for identification (e.g., "sk_live_...")
  permissions JSONB DEFAULT '["read"]'::jsonb,  -- ["read", "write", "admin"]
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_account ON api_keys(account_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash) WHERE revoked_at IS NULL;

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own api_keys" ON api_keys
  FOR ALL TO authenticated
  USING (account_id = auth.uid())
  WITH CHECK (account_id = auth.uid());
