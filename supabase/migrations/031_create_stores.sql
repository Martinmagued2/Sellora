-- Migration: 031_create_stores.sql
-- Feature #29: Multi-Store Support

CREATE TABLE IF NOT EXISTS stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  logo_url text,
  industry text,
  currency text DEFAULT 'EGP',
  country text,
  is_active boolean DEFAULT true,
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(account_id, slug)
);
CREATE INDEX idx_stores_account ON stores(account_id);

-- Add store_id to existing tables
ALTER TABLE products ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id) ON DELETE SET NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id) ON DELETE SET NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id) ON DELETE SET NULL;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_conversations_store ON conversations(store_id);
CREATE INDEX IF NOT EXISTS idx_customers_store ON customers(store_id);

-- Plan-based store limits
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS max_stores integer DEFAULT 1;

-- RLS policies for stores
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own stores" ON stores
  FOR SELECT USING (account_id = auth.uid());

CREATE POLICY "Users can create own stores" ON stores
  FOR INSERT WITH CHECK (account_id = auth.uid());

CREATE POLICY "Users can update own stores" ON stores
  FOR UPDATE USING (account_id = auth.uid());

CREATE POLICY "Users can delete own stores" ON stores
  FOR DELETE USING (account_id = auth.uid());
