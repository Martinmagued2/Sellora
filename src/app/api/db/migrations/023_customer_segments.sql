CREATE TABLE IF NOT EXISTS customer_segments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#5865F2',
  icon TEXT DEFAULT 'Users',
  rules JSONB NOT NULL DEFAULT '{}',
  is_dynamic BOOLEAN DEFAULT true,
  customer_count INTEGER DEFAULT 0,
  last_computed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS segment_customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  segment_id UUID NOT NULL REFERENCES customer_segments(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(segment_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_segments_account ON customer_segments(account_id);
CREATE INDEX IF NOT EXISTS idx_segment_customers_segment ON segment_customers(segment_id);
CREATE INDEX IF NOT EXISTS idx_segment_customers_customer ON segment_customers(customer_id);

ALTER TABLE customer_segments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own segments" ON customer_segments;
CREATE POLICY "Users can manage own segments" ON customer_segments FOR ALL USING (account_id = auth.uid());

ALTER TABLE segment_customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own segment_customers" ON segment_customers;
CREATE POLICY "Users can manage own segment_customers" ON segment_customers FOR ALL USING (
  segment_id IN (SELECT id FROM customer_segments WHERE account_id = auth.uid())
);
