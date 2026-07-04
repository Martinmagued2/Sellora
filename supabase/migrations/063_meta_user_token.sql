-- 063_meta_user_token.sql
-- Add meta_user_access_token column to accounts table
-- This stores the long-lived User Access Token from Meta OAuth,
-- which is needed for Instagram Business Account lookup.
-- (Page tokens can't see the instagram_business_account field)

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accounts') THEN
    EXECUTE 'ALTER TABLE accounts ADD COLUMN IF NOT EXISTS meta_user_access_token TEXT';
  END IF;
END $$;

-- Done.
