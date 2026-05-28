-- Add Shopify integration fields to accounts
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS shopify_shop_domain TEXT,
  ADD COLUMN IF NOT EXISTS shopify_access_token TEXT,
  ADD COLUMN IF NOT EXISTS shopify_installed BOOLEAN DEFAULT FALSE;

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_accounts_shopify ON accounts(shopify_shop_domain);
