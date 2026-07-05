-- Migration 021: Coupons table
-- Discount/Coupon system for Sellora e-commerce dashboard

CREATE TABLE IF NOT EXISTS coupons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed', 'free_shipping')),
  value DECIMAL(10,2) NOT NULL,
  min_order_value DECIMAL(10,2) DEFAULT 0,
  max_uses INTEGER DEFAULT NULL,
  used_count INTEGER DEFAULT 0,
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  applies_to TEXT DEFAULT 'all' CHECK (applies_to IN ('all', 'specific_products', 'specific_categories')),
  product_ids UUID[] DEFAULT '{}',
  categories TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, code)
);

CREATE INDEX IF NOT EXISTS idx_coupons_account ON coupons(account_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(account_id, is_active);

-- RLS policies
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own coupons" ON coupons;
CREATE POLICY "Users can manage own coupons" ON coupons FOR ALL USING (account_id = auth.uid());

DROP POLICY IF EXISTS "Users can read own coupons" ON coupons;
CREATE POLICY "Users can read own coupons" ON coupons FOR SELECT USING (account_id = auth.uid());
