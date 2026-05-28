-- ============================================
-- Add Shopify integration columns to accounts table
-- ============================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='shopify_shop_domain') THEN
    ALTER TABLE accounts ADD COLUMN shopify_shop_domain TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='shopify_access_token') THEN
    ALTER TABLE accounts ADD COLUMN shopify_access_token TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='shopify_installed') THEN
    ALTER TABLE accounts ADD COLUMN shopify_installed BOOLEAN DEFAULT FALSE;
  END IF;
END $$;
