-- Migration 047: Add shopify_id to products table
--
-- PROBLEM: Shopify sync route calls:
--   supabase.from('products').upsert({ ..., shopify_id: '123' }, { onConflict: 'account_id, shopify_id' })
-- but the products table has no shopify_id column and no unique constraint.
-- Every sync silently failed with "Could not find the 'shopify_id' column" —
-- the route reported success because it didn't check the `error` field from upsert.
--
-- This migration:
--   1. Adds shopify_id TEXT column to products
--   2. Adds a UNIQUE constraint on (account_id, shopify_id) so onConflict works
--   3. Adds an index for fast lookups

ALTER TABLE products ADD COLUMN IF NOT EXISTS shopify_id TEXT;

-- Drop existing constraint if any (idempotent)
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_account_id_shopify_id_key;

-- Add unique constraint — allows multiple NULL shopify_id rows (manual products)
CREATE UNIQUE INDEX IF NOT EXISTS products_account_id_shopify_id_key
  ON products(account_id, shopify_id)
  WHERE shopify_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_shopify_id ON products(shopify_id) WHERE shopify_id IS NOT NULL;
