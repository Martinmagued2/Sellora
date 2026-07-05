-- ============================================================
-- Migration 042: Loyalty, Affiliates, Read Receipts, Pending Actions UI
-- Adds tables/columns needed for features that previously had
-- backends but no UI, plus new feature tables.
-- ============================================================

-- ═══ 1. Loyalty Program ═══
-- Points-per-purchase with store-credit wallet redemption
CREATE TABLE IF NOT EXISTS loyalty_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  points INTEGER DEFAULT 0,
  lifetime_points INTEGER DEFAULT 0,
  tier TEXT DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_account_customer ON loyalty_accounts(account_id, customer_id);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  points INTEGER NOT NULL, -- positive = earned, negative = redeemed
  reason TEXT NOT NULL, -- 'purchase', 'redemption', 'bonus', 'expiry'
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_customer ON loyalty_transactions(account_id, customer_id, created_at DESC);

-- Loyalty config on accounts
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS loyalty_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS loyalty_points_per_egl INTEGER DEFAULT 1, -- 1 point per 1 EGP spent
  ADD COLUMN IF NOT EXISTS loyalty_points_value DECIMAL(10,2) DEFAULT 0.05, -- 1 point = 0.05 EGP credit
  ADD COLUMN IF NOT EXISTS loyalty_tier_thresholds JSONB DEFAULT '{"bronze": 0, "silver": 1000, "gold": 5000, "platinum": 15000}'::jsonb;

ALTER TABLE loyalty_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own loyalty_accounts" ON loyalty_accounts;
CREATE POLICY "Users can manage own loyalty_accounts"
  ON loyalty_accounts FOR ALL USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own loyalty_transactions" ON loyalty_transactions;
CREATE POLICY "Users can read own loyalty_transactions"
  ON loyalty_transactions FOR SELECT USING (account_id = auth.uid());

-- ═══ 2. Affiliate Program ═══
-- Trackable links for influencers with commission
CREATE TABLE IF NOT EXISTS affiliates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  code TEXT NOT NULL, -- short unique code like "SALE10"
  commission_percent DECIMAL(5,2) DEFAULT 5.00,
  cookie_days INTEGER DEFAULT 30,
  total_clicks INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_revenue DECIMAL(10,2) DEFAULT 0,
  total_commission_earned DECIMAL(10,2) DEFAULT 0,
  total_commission_paid DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'terminated')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, code)
);

CREATE INDEX IF NOT EXISTS idx_affiliates_code ON affiliates(code);
CREATE INDEX IF NOT EXISTS idx_affiliates_account ON affiliates(account_id);

CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS affiliate_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  order_total DECIMAL(10,2) NOT NULL,
  commission_percent DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'refunded')),
  attributed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id)
);

ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own affiliates" ON affiliates;
CREATE POLICY "Users can manage own affiliates"
  ON affiliates FOR ALL USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

-- Public can read affiliate code (for tracking)
DROP POLICY IF EXISTS "Public can read active affiliates by code" ON affiliates;
CREATE POLICY "Public can read active affiliates by code"
  ON affiliates FOR SELECT USING (status = 'active');

-- ═══ 3. Read receipts (WhatsApp-style double-tick) ═══
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- ═══ 4. Shipping automation ═══
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS carrier TEXT,
  ADD COLUMN IF NOT EXISTS label_url TEXT,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bulk_ship_batch_id TEXT;

-- ═══ 5. Cohort retention tracking ═══
-- Materialized view would be cleaner, but a regular view works for small datasets
CREATE OR REPLACE VIEW v_cohort_retention AS
WITH first_orders AS (
  SELECT
    customer_id,
    account_id,
    DATE_TRUNC('month', MIN(created_at)) AS cohort_month,
    MIN(created_at) AS first_order_at
  FROM orders
  WHERE status != 'cancelled'
  GROUP BY customer_id, account_id
),
cohort_sizes AS (
  SELECT account_id, cohort_month, COUNT(*) AS cohort_size
  FROM first_orders
  GROUP BY account_id, cohort_month
),
repeat_orders AS (
  SELECT
    fo.account_id,
    fo.cohort_month,
    DATE_TRUNC('month', o.created_at) AS order_month,
    EXTRACT(YEAR FROM age(DATE_TRUNC('month', o.created_at), fo.cohort_month))::INT * 12 +
    EXTRACT(MONTH FROM age(DATE_TRUNC('month', o.created_at), fo.cohort_month))::INT AS months_after,
    COUNT(DISTINCT fo.customer_id) AS repeat_customers
  FROM first_orders fo
  JOIN orders o ON o.customer_id = fo.customer_id AND o.account_id = fo.account_id
  WHERE o.status != 'cancelled' AND o.created_at > fo.first_order_at
  GROUP BY fo.account_id, fo.cohort_month, order_month, months_after
)
SELECT
  cs.account_id,
  cs.cohort_month,
  cs.cohort_size,
  COALESCE(ro.months_after, 0) AS months_after,
  CASE WHEN ro.months_after IS NULL THEN cs.cohort_size
       ELSE ro.repeat_customers END AS active_customers,
  ROUND(
    (CASE WHEN ro.months_after IS NULL THEN cs.cohort_size
          ELSE ro.repeat_customers END)::NUMERIC / NULLIF(cs.cohort_size, 0) * 100,
    2
  ) AS retention_rate
FROM cohort_sizes cs
LEFT JOIN repeat_orders ro ON ro.account_id = cs.account_id AND ro.cohort_month = cs.cohort_month
ORDER BY cs.account_id, cs.cohort_month, months_after;

-- ═══ 6. First-sale tracking ═══
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS first_sale_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_sale_celebrated BOOLEAN DEFAULT FALSE;

-- ═══ 7. Slash command quick replies (already in DB but no inline trigger) ═══
-- Quick replies table already exists from migration 015 — just adding a category column
ALTER TABLE quick_replies
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- ═══ 8. Affiliate cookie storage on customer ═══
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS referred_by_affiliate_id UUID REFERENCES affiliates(id),
  ADD COLUMN IF NOT EXISTS affiliate_attribution_at TIMESTAMPTZ;
