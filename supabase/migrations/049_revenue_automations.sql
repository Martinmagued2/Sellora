-- Migration 049: Revenue automation suite — win-back, back-in-stock, upsell, payment recovery, VIP
--
-- Adds tables and settings columns for 5 high-ROI automations:
-- 1. Win-back campaigns (dormant customers)
-- 2. Back-in-stock notifications
-- 3. Post-purchase upsell flow
-- 4. Failed payment recovery
-- 5. VIP customer automation

-- ============================================
-- Settings columns on accounts table
-- ============================================
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS winback_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS winback_days_threshold integer DEFAULT 60;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS winback_discount_percent integer DEFAULT 10;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS winback_message_template text DEFAULT 'Hi {name}! We miss you at {store}. Here''s a special {discount}% off code: {code}. Come back and see what''s new!';

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS back_in_stock_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS back_in_stock_message_template text DEFAULT 'Good news {name}! {product} is back in stock 🔥 Get yours now: {store_url}';

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS upsell_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS upsell_delay_days integer DEFAULT 3;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS upsell_discount_percent integer DEFAULT 15;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS upsell_message_template text DEFAULT 'Hi {name}! How''s your {item}? Pair it with {accessory} for {discount}% off — only for the next 48 hours!';

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS payment_recovery_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS payment_recovery_discount_percent integer DEFAULT 5;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS payment_recovery_message_template text DEFAULT 'Hi {name}! We noticed you didn''t complete your order. Here''s {discount}% off to help you finish: {code}. Your cart is waiting!';

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS vip_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS vip_threshold numeric DEFAULT 5000;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS vip_welcome_message text DEFAULT 'Welcome to our VIP club {name}! 🌟 You''ve unlocked exclusive perks: early access to new products, priority support, and special discounts. Thank you for being a valued customer!';

-- ============================================
-- 1. Win-back campaigns
-- ============================================
CREATE TABLE IF NOT EXISTS win_back_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  days_dormant integer NOT NULL,
  discount_code text,
  discount_percent integer,
  message_sent text,
  status text DEFAULT 'sent' CHECK (status IN ('sent', 'recovered', 'expired')),
  sent_at timestamptz DEFAULT now(),
  recovered_at timestamptz,
  recovered_order_id uuid REFERENCES orders(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(account_id, customer_id)
);
CREATE INDEX IF NOT EXISTS idx_winback_account ON win_back_campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_winback_status ON win_back_campaigns(account_id, status);

-- ============================================
-- 2. Back-in-stock requests
-- ============================================
CREATE TABLE IF NOT EXISTS back_in_stock_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  notified boolean DEFAULT false,
  notified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(account_id, customer_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_backinstock_product ON back_in_stock_requests(product_id, notified);
CREATE INDEX IF NOT EXISTS idx_backinstock_account ON back_in_stock_requests(account_id);

-- ============================================
-- 3. Post-purchase upsell flow
-- ============================================
CREATE TABLE IF NOT EXISTS upsell_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  suggested_products jsonb DEFAULT '[]',
  discount_code text,
  discount_percent integer,
  message_sent text,
  status text DEFAULT 'sent' CHECK (status IN ('sent', 'converted', 'expired')),
  sent_at timestamptz DEFAULT now(),
  converted_at timestamptz,
  converted_order_id uuid REFERENCES orders(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(account_id, order_id)
);
CREATE INDEX IF NOT EXISTS idx_upsell_account ON upsell_flows(account_id);
CREATE INDEX IF NOT EXISTS idx_upsell_status ON upsell_flows(account_id, status);

-- ============================================
-- 4. Failed payment recovery
-- ============================================
CREATE TABLE IF NOT EXISTS payment_recoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  discount_code text,
  discount_percent integer,
  message_sent text,
  attempts integer DEFAULT 1,
  status text DEFAULT 'sent' CHECK (status IN ('sent', 'recovered', 'expired')),
  sent_at timestamptz DEFAULT now(),
  recovered_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(account_id, order_id)
);
CREATE INDEX IF NOT EXISTS idx_payrec_account ON payment_recoveries(account_id);
CREATE INDEX IF NOT EXISTS idx_payrec_status ON payment_recoveries(account_id, status);

-- ============================================
-- 5. VIP customers
-- ============================================
CREATE TABLE IF NOT EXISTS vip_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  total_spent numeric NOT NULL,
  tagged_at timestamptz DEFAULT now(),
  welcome_sent_at timestamptz,
  UNIQUE(account_id, customer_id)
);
CREATE INDEX IF NOT EXISTS idx_vip_account ON vip_customers(account_id);

-- ============================================
-- RLS for all new tables
-- ============================================
ALTER TABLE win_back_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own win_back_campaigns" ON win_back_campaigns
  FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

ALTER TABLE back_in_stock_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own back_in_stock_requests" ON back_in_stock_requests
  FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

ALTER TABLE upsell_flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own upsell_flows" ON upsell_flows
  FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

ALTER TABLE payment_recoveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own payment_recoveries" ON payment_recoveries
  FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

ALTER TABLE vip_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own vip_customers" ON vip_customers
  FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());
