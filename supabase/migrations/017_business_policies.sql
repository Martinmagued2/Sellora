-- ============================================
-- MIGRATION 017: Business Policies
-- Store policies (return, shipping, exchange, etc.)
-- that the AI uses to answer customer questions
-- ============================================

-- 1. Create business_policies table
CREATE TABLE IF NOT EXISTS business_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'General' CHECK (category IN (
    'Returns & Refunds',
    'Shipping & Delivery',
    'Exchange',
    'Payment',
    'Privacy',
    'Terms of Service',
    'Warranty',
    'Cancellation',
    'General'
  )),
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_policies_account ON business_policies(account_id);
CREATE INDEX IF NOT EXISTS idx_business_policies_active ON business_policies(account_id, is_active);

-- 2. Enable RLS
ALTER TABLE business_policies ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
DROP POLICY IF EXISTS "Users can manage own business_policies" ON business_policies;
CREATE POLICY "Users can manage own business_policies"
  ON business_policies FOR ALL
  USING (account_id = auth.uid());

-- 4. Auto-update updated_at trigger
DROP TRIGGER IF EXISTS update_business_policies_updated_at ON business_policies;
CREATE TRIGGER update_business_policies_updated_at
  BEFORE UPDATE ON business_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
