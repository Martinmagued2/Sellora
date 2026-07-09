-- ============================================================
-- Migration 044: Template library, CSAT, Flow builder, Live chat
-- ============================================================

-- ═══ 1. WhatsApp Template Library ═══
CREATE TABLE IF NOT EXISTS wa_template_library (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('marketing', 'utility', 'authentication')),
  language TEXT DEFAULT 'en',
  body TEXT NOT NULL,
  header TEXT,
  footer TEXT,
  buttons JSONB DEFAULT '[]'::jsonb,
  variables JSONB DEFAULT '[]'::jsonb,
  meta_status TEXT DEFAULT 'not_submitted' CHECK (meta_status IN ('not_submitted', 'pending', 'approved', 'rejected')),
  meta_template_id TEXT,
  meta_rejection_reason TEXT,
  is_global BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ 2. CSAT Surveys ═══
CREATE TABLE IF NOT EXISTS csat_surveys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  feedback TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_csat_account ON csat_surveys(account_id, created_at DESC);
ALTER TABLE csat_surveys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own csat_surveys" ON csat_surveys;
CREATE POLICY "Users can manage own csat_surveys"
  ON csat_surveys FOR ALL USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

-- ═══ 3. Live Chat Widget ═══
CREATE TABLE IF NOT EXISTS live_chat_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_email TEXT,
  visitor_id TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'converted')),
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_live_chat_account ON live_chat_sessions(account_id, status, last_message_at DESC);
ALTER TABLE live_chat_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own live_chat_sessions" ON live_chat_sessions;
CREATE POLICY "Users can manage own live_chat_sessions"
  ON live_chat_sessions FOR ALL USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

-- ═══ 4. Flow Builder ═══
CREATE TABLE IF NOT EXISTS automation_flows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('keyword', 'intent', 'channel', 'schedule', 'manual')),
  trigger_config JSONB DEFAULT '{}'::jsonb,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused')),
  total_runs INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flows_account ON automation_flows(account_id, status);
ALTER TABLE automation_flows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own automation_flows" ON automation_flows;
CREATE POLICY "Users can manage own automation_flows"
  ON automation_flows FOR ALL USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

-- ═══ 5. Email channel ═══
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS email_subject TEXT,
  ADD COLUMN IF NOT EXISTS email_message_id TEXT;

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS email_channel_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_channel_address TEXT;

-- ═══ 6. Seed template library with common templates ═══
INSERT INTO wa_template_library (name, category, language, body, variables, buttons) VALUES
('order_confirmation', 'utility', 'en', 'Hi {{1}}! Your order {{2}} has been confirmed. Total: {{3}}. We''ll notify you when it ships.', '[{"1":"Customer name"},{"2":"Order number"},{"3":"Total amount"}]', '[]'),
('order_shipped', 'utility', 'en', 'Your order {{1}} has been shipped! Carrier: {{2}}. Tracking: {{3}}. Expected delivery: {{4}}.', '[{"1":"Order number"},{"2":"Carrier"},{"3":"Tracking number"},{"4":"Delivery date"}]', '[]'),
('order_delivered', 'utility', 'en', 'Your order {{1}} has been delivered! How was your experience? Rate us: {{2}}', '[{"1":"Order number"},{"2":"Review link"}]', '[]'),
('payment_reminder', 'utility', 'en', 'Hi {{1}}! Your order {{2}} for {{3}} is still pending payment. Pay here: {{4}}', '[{"1":"Customer name"},{"2":"Order number"},{"3":"Amount"},{"4":"Payment link"}]', '[]'),
('abandoned_cart_1', 'marketing', 'en', 'Hi {{1}}! You left {{2}} in your cart. Complete your order now and get free shipping!', '[{"1":"Customer name"},{"2":"Product name"}]', '[]'),
('abandoned_cart_2', 'marketing', 'en', 'Still thinking about {{1}}? Here''s 5% off with code {{2}}. Offer expires in 24h!', '[{"1":"Product name"},{"2":"Coupon code"}]', '[]'),
('welcome_message', 'marketing', 'en', 'Welcome to {{1}}! We''re excited to serve you. Browse our products or ask me anything!', '[{"1":"Business name"}]', '[]'),
('cod_confirmation', 'utility', 'en', 'Please confirm your order {{1}}: {{2}} — Total: {{3}} (Cash on Delivery). Reply YES to confirm or NO to cancel.', '[{"1":"Order number"},{"2":"Items"},{"3":"Total"}]', '[]'),
('welcome_message_ar', 'marketing', 'ar', 'أهلاً بك في {{1}}! سعداء بخدمتك. تصفح منتجاتنا أو اسألني أي شيء!', '[{"1":"اسم المتجر"}]', '[]'),
('order_confirmation_ar', 'utility', 'ar', 'مرحباً {{1}}! تم تأكيد طلبك {{2}}. الإجمالي: {{3}}. سنخبرك عند الشحن.', '[{"1":"اسم العميل"},{"2":"رقم الطلب"},{"3":"المبلغ"}]', '[]')
ON CONFLICT DO NOTHING;
