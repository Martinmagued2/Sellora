-- Migration 051: Operational + AI extension + drip automations
--
-- Adds tables for 7 more automations:
--
-- Operational:
-- 16. Channel failover (WhatsApp → SMS → email cascade)
-- 19. Inventory auto-reorder
-- 21. Carrier status sync (Aramex, Bosta, Mylerz)
--
-- AI Extension:
-- 8. Churn prediction
-- 9. Smart product recommendations
-- 17. Optimal send-time AI
--
-- Extended:
-- 15. Multi-step drip campaigns (extend abandoned cart to 5-7 steps)

-- ============================================
-- Settings columns on accounts
-- ============================================
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS channel_failover_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS sms_provider text DEFAULT 'none';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS sms_api_key text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS sms_sender_id text;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS inventory_reorder_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS inventory_reorder_threshold integer DEFAULT 5;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS inventory_reorder_qty integer DEFAULT 20;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS inventory_reorder_notify boolean DEFAULT true;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS carrier_sync_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS carrier_arjamex_api_key text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS carrier_bosta_api_key text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS carrier_mylerz_api_key text;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS churn_prediction_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS churn_threshold_days integer DEFAULT 45;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS churn_save_discount integer DEFAULT 15;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS product_recommendations_enabled boolean DEFAULT false;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS send_time_optimization_enabled boolean DEFAULT false;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS extended_drip_enabled boolean DEFAULT false;

-- ============================================
-- 16. Channel failover log
-- ============================================
CREATE TABLE IF NOT EXISTS channel_failovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  message_id uuid,
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  primary_channel text NOT NULL,
  fallback_channel text,
  final_channel text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent_primary', 'failed_over', 'all_failed')),
  attempts jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_failover_account ON channel_failovers(account_id, status);

-- ============================================
-- 19. Inventory reorder alerts
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_reorder_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  current_stock integer NOT NULL,
  threshold integer NOT NULL,
  suggested_qty integer,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'ordered', 'dismissed', 'restocked')),
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE(account_id, product_id, status)
);
CREATE INDEX IF NOT EXISTS idx_reorder_alerts ON inventory_reorder_alerts(account_id, status);

-- ============================================
-- 21. Carrier shipment sync
-- ============================================
CREATE TABLE IF NOT EXISTS carrier_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  carrier text NOT NULL CHECK (carrier IN ('aramex', 'bosta', 'mylerz', 'dhl', 'fedex', 'other')),
  tracking_number text NOT NULL,
  last_status text,
  last_status_at timestamptz,
  last_synced_at timestamptz,
  customer_notified boolean DEFAULT false,
  history jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  UNIQUE(account_id, order_id, tracking_number)
);
CREATE INDEX IF NOT EXISTS idx_carrier_sync ON carrier_shipments(account_id, last_synced_at);

-- ============================================
-- 8. Churn risk scores
-- ============================================
CREATE TABLE IF NOT EXISTS churn_risk_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  risk_score numeric DEFAULT 0,
  risk_level text CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  factors jsonb DEFAULT '{}',
  save_campaign_sent boolean DEFAULT false,
  save_campaign_sent_at timestamptz,
  saved boolean DEFAULT false,
  calculated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(account_id, customer_id)
);
CREATE INDEX IF NOT EXISTS idx_churn_risk ON churn_risk_scores(account_id, risk_level);

-- ============================================
-- 9. Product recommendation pairs (bought-together)
-- ============================================
CREATE TABLE IF NOT EXISTS product_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  recommended_product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  co_purchase_count integer DEFAULT 1,
  last_co_purchase_at timestamptz,
  recommendation_type text DEFAULT 'bought_together' CHECK (recommendation_type IN ('bought_together', 'similar_category', 'popular', 'trending')),
  score numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(account_id, product_id, recommended_product_id, recommendation_type)
);
CREATE INDEX IF NOT EXISTS idx_recs_product ON product_recommendations(account_id, product_id, score DESC);

-- ============================================
-- 17. Customer send-time preferences (learned by AI)
-- ============================================
CREATE TABLE IF NOT EXISTS customer_send_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  best_hour integer CHECK (best_hour BETWEEN 0 AND 23),
  best_day text,
  confidence numeric DEFAULT 0,
  response_samples integer DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(account_id, customer_id)
);
CREATE INDEX IF NOT EXISTS idx_sendtime ON customer_send_times(account_id, customer_id);

-- ============================================
-- 15. Extended drip campaign steps (extends abandoned_carts)
-- ============================================
-- Already have abandoned_carts table with first/second reminder.
-- Add a new table for the full multi-step sequence.
CREATE TABLE IF NOT EXISTS drip_campaign_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  campaign_type text NOT NULL CHECK (campaign_type IN ('abandoned_browse', 'abandoned_cart', 'abandoned_checkout', 'post_purchase_upsell', 'review_request', 'referral_ask')),
  step_number integer NOT NULL,
  step_name text,
  message_sent text,
  discount_code text,
  sent_at timestamptz DEFAULT now(),
  converted boolean DEFAULT false,
  converted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(account_id, customer_id, campaign_type, step_number)
);
CREATE INDEX IF NOT EXISTS idx_drip_account ON drip_campaign_steps(account_id, campaign_type);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE channel_failovers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own channel_failovers" ON channel_failovers
  FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

ALTER TABLE inventory_reorder_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own inventory_reorder_alerts" ON inventory_reorder_alerts
  FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

ALTER TABLE carrier_shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own carrier_shipments" ON carrier_shipments
  FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

ALTER TABLE churn_risk_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own churn_risk_scores" ON churn_risk_scores
  FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

ALTER TABLE product_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own product_recommendations" ON product_recommendations
  FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

ALTER TABLE customer_send_times ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own customer_send_times" ON customer_send_times
  FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

ALTER TABLE drip_campaign_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own drip_campaign_steps" ON drip_campaign_steps
  FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());
