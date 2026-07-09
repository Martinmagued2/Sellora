-- Migration 050: Lifecycle + AI automation suite
--
-- Adds tables and settings for 8 more automations:
--
-- Lifecycle:
-- 11. Birthday rewards
-- 12. First-order welcome series
-- 13. Reorder reminders
-- 14. Review timing optimization
-- 15. Smart segmentation auto-update
--
-- AI-Driven:
-- 6. Smart conversation routing
-- 7. Auto-generate FAQs from conversations
-- 8. Negative review auto-response

-- ============================================
-- Settings columns on accounts table
-- ============================================
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS birthday_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS birthday_discount_percent integer DEFAULT 20;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS birthday_message_template text DEFAULT 'Happy Birthday {name}! 🎂 From all of us at {store}, here''s a special {discount}% off code: {code}. Treat yourself today!';

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS welcome_series_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS welcome_discount_percent integer DEFAULT 10;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS reorder_reminders_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS reorder_reminder_days integer DEFAULT 25;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS reorder_message_template text DEFAULT 'Hi {name}! Running low on {product}? Reorder now and get free shipping: {store_url}';

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS review_optimization_enabled boolean DEFAULT false;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS segment_auto_update_enabled boolean DEFAULT false;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS smart_routing_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS routing_rules jsonb DEFAULT '[]';

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS faq_auto_generate_enabled boolean DEFAULT false;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS negative_review_response_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS negative_review_message_template text DEFAULT 'Hi {name}, we''re so sorry about your experience. This isn''t the standard we hold ourselves to. Please reply and we''ll make it right.';

-- ============================================
-- Add birthday column to customers (if not exists)
-- ============================================
ALTER TABLE customers ADD COLUMN IF NOT EXISTS birthday date;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS first_order_at timestamptz;

-- ============================================
-- 11. Birthday rewards log
-- ============================================
CREATE TABLE IF NOT EXISTS birthday_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  discount_code text,
  discount_percent integer,
  message_sent text,
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(account_id, customer_id, sent_at)
);
CREATE INDEX IF NOT EXISTS idx_birthday_account ON birthday_rewards(account_id);
CREATE INDEX IF NOT EXISTS idx_birthday_sent ON birthday_rewards(account_id, sent_at);

-- ============================================
-- 12. First-order welcome series
-- ============================================
CREATE TABLE IF NOT EXISTS welcome_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  step integer NOT NULL, -- 1, 2, or 3
  message_sent text,
  discount_code text,
  sent_at timestamptz DEFAULT now(),
  converted boolean DEFAULT false,
  converted_order_id uuid REFERENCES orders(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(account_id, customer_id, step)
);
CREATE INDEX IF NOT EXISTS idx_welcome_account ON welcome_series(account_id);
CREATE INDEX IF NOT EXISTS idx_welcome_step ON welcome_series(account_id, step);

-- ============================================
-- 13. Reorder reminders
-- ============================================
CREATE TABLE IF NOT EXISTS reorder_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  product_name text,
  message_sent text,
  sent_at timestamptz DEFAULT now(),
  converted boolean DEFAULT false,
  converted_order_id uuid REFERENCES orders(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(account_id, order_id)
);
CREATE INDEX IF NOT EXISTS idx_reorder_account ON reorder_reminders(account_id);

-- ============================================
-- 14. Review timing optimization
-- ============================================
CREATE TABLE IF NOT EXISTS review_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  scheduled_for timestamptz,
  sent_at timestamptz,
  responded_at timestamptz,
  rating integer,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'responded', 'expired')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(account_id, order_id)
);
CREATE INDEX IF NOT EXISTS idx_review_account ON review_requests(account_id);
CREATE INDEX IF NOT EXISTS idx_review_scheduled ON review_requests(scheduled_for) WHERE status = 'scheduled';

-- ============================================
-- 6. Smart routing assignments
-- ============================================
CREATE TABLE IF NOT EXISTS routing_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  assigned_to uuid, -- user.id of team member
  assigned_by text, -- 'auto' or user.id
  rule_matched text, -- which rule triggered the assignment
  assigned_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_routing_account ON routing_assignments(account_id);

-- ============================================
-- 7. Auto-generated FAQ drafts
-- ============================================
CREATE TABLE IF NOT EXISTS faq_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  source_conversation_ids uuid[] DEFAULT '{}',
  frequency integer DEFAULT 1, -- how many times this question was asked
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected', 'published')),
  generated_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_faq_drafts_account ON faq_drafts(account_id, status);

-- ============================================
-- 8. Negative review responses
-- ============================================
-- 🔧 FIX: references 'product_reviews' table (not 'reviews') — the actual
-- table name created in migration 040.
CREATE TABLE IF NOT EXISTS negative_review_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  review_id uuid REFERENCES product_reviews(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  draft_response text,
  sent_at timestamptz,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'skipped')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(account_id, review_id)
);
CREATE INDEX IF NOT EXISTS idx_negreview_account ON negative_review_responses(account_id, status);

-- ============================================
-- RLS for all new tables
-- ============================================
ALTER TABLE birthday_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own birthday_rewards" ON birthday_rewards
  FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

ALTER TABLE welcome_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own welcome_series" ON welcome_series
  FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

ALTER TABLE reorder_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own reorder_reminders" ON reorder_reminders
  FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own review_requests" ON review_requests
  FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

ALTER TABLE routing_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own routing_assignments" ON routing_assignments
  FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

ALTER TABLE faq_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own faq_drafts" ON faq_drafts
  FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

ALTER TABLE negative_review_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own negative_review_responses" ON negative_review_responses
  FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());
