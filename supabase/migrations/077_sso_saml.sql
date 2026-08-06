-- 077_sso_saml.sql
-- SSO/SAML configuration for enterprise authentication.
-- Stores SAML metadata + configuration per account.

CREATE TABLE IF NOT EXISTS sso_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL DEFAULT 'Default SSO',
  entity_id TEXT,
  sso_url TEXT,
  slo_url TEXT,
  x509_cert TEXT,
  name_id_format TEXT DEFAULT 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
  attribute_mapping JSONB DEFAULT '{"email": "email", "name": "name"}'::jsonb,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sso_configs_account ON sso_configs(account_id) WHERE is_active = true;

ALTER TABLE sso_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own sso_configs" ON sso_configs
  FOR ALL TO authenticated
  USING (account_id = auth.uid())
  WITH CHECK (account_id = auth.uid());
