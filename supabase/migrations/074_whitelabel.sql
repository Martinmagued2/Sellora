-- 074_whitelabel.sql
-- White-label / custom branding fields for accounts.
-- Enables resellers to rebrand Sellora as their own.

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_whitelabel BOOLEAN DEFAULT FALSE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS custom_domain TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS branding_primary_color TEXT DEFAULT '#6c5ce7';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS branding_logo_url TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS from_email TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS hide_sellora_branding BOOLEAN DEFAULT FALSE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS reseller_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_custom_domain ON accounts(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounts_reseller ON accounts(reseller_id) WHERE reseller_id IS NOT NULL;
