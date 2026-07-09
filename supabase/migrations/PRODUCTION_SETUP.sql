-- ============================================================
-- PRODUCTION READINESS — Run ALL missing columns in one go
-- Paste this entire script into Supabase SQL Editor and Run
-- ============================================================

-- Migration 039: accounts RLS (critical for Settings page)
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own account" ON accounts;
DROP POLICY IF EXISTS "Users can update own account" ON accounts;
DROP POLICY IF EXISTS "Users can insert own account" ON accounts;
DROP POLICY IF EXISTS "Users can delete own account" ON accounts;
CREATE POLICY "Users can read own account" ON accounts FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own account" ON accounts FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can insert own account" ON accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can delete own account" ON accounts FOR DELETE TO authenticated USING (id = auth.uid());

-- Migration 022 (missing columns): abandoned cart config on accounts
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS abandoned_cart_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS abandoned_cart_hours INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS abandoned_cart_auto_reminder BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS abandoned_cart_reminder_hours INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS abandoned_cart_auto_second_reminder BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS abandoned_cart_second_reminder_hours INTEGER DEFAULT 24,
  ADD COLUMN IF NOT EXISTS abandoned_cart_discount_percent INTEGER DEFAULT 10;

-- Migration 040: conversation enhancements
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_paused BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_paused_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_paused_by UUID,
  ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS snoozed_by UUID,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS summary_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by TEXT CHECK (resolved_by IN ('ai', 'human', 'mixed', NULL)),
  ADD COLUMN IF NOT EXISTS first_ai_reply_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_human_reply_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_ai_message_id UUID,
  ADD COLUMN IF NOT EXISTS escalation_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_conversations_ai_paused ON conversations(account_id, ai_paused) WHERE ai_paused = TRUE;
CREATE INDEX IF NOT EXISTS idx_conversations_snoozed ON conversations(account_id, snoozed_until) WHERE snoozed_until IS NOT NULL;

-- Migration 040: customer preferences
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_memory TEXT,
  ADD COLUMN IF NOT EXISTS vip BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS lifetime_value DECIMAL(10,2) DEFAULT 0;

-- Migration 040: conversation notes
CREATE TABLE IF NOT EXISTS conversation_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES accounts(id),
  body TEXT NOT NULL,
  pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE conversation_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own conversation_notes" ON conversation_notes;
CREATE POLICY "Users can manage own conversation_notes" ON conversation_notes FOR ALL USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

-- Migration 040: AI message feedback
CREATE TABLE IF NOT EXISTS ai_message_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  message_id UUID NOT NULL,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  rating TEXT NOT NULL CHECK (rating IN ('up', 'down')),
  reason TEXT,
  operator_id UUID REFERENCES accounts(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id)
);
ALTER TABLE ai_message_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own ai_message_feedback" ON ai_message_feedback;
CREATE POLICY "Users can manage own ai_message_feedback" ON ai_message_feedback FOR ALL USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

-- Migration 040: pending actions
CREATE TABLE IF NOT EXISTS pending_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  action_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  proposed_by TEXT NOT NULL DEFAULT 'ai',
  proposed_at TIMESTAMPTZ DEFAULT NOW(),
  decided_by UUID REFERENCES accounts(id),
  decided_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  executed_at TIMESTAMPTZ,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE pending_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own pending_actions" ON pending_actions;
CREATE POLICY "Users can manage own pending_actions" ON pending_actions FOR ALL USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

-- Migration 040: carts
CREATE TABLE IF NOT EXISTS carts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open',
  items JSONB NOT NULL DEFAULT '[]',
  subtotal DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  coupon_code TEXT,
  currency TEXT DEFAULT 'EGP',
  converted_order_id UUID REFERENCES orders(id),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own carts" ON carts;
CREATE POLICY "Users can manage own carts" ON carts FOR ALL USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

-- Migration 040: abandoned cart extensions
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS third_reminder_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS third_reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recovery_sequence_version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recovery_revenue DECIMAL(10,2) DEFAULT 0;

-- Migration 040: product reviews
CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT DEFAULT 'whatsapp',
  reply TEXT,
  reply_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own product_reviews" ON product_reviews;
CREATE POLICY "Users can manage own product_reviews" ON product_reviews FOR ALL USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());
DROP POLICY IF EXISTS "Public can read published reviews" ON product_reviews;
CREATE POLICY "Public can read published reviews" ON product_reviews FOR SELECT USING (status = 'published');

-- Migration 040: smart coupons
ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS subtype TEXT DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS bogo_buy_qty INTEGER,
  ADD COLUMN IF NOT EXISTS bogo_get_qty INTEGER,
  ADD COLUMN IF NOT EXISTS bogo_get_discount_percent INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS tiered_rules JSONB,
  ADD COLUMN IF NOT EXISTS target_customer_id UUID REFERENCES customers(id),
  ADD COLUMN IF NOT EXISTS auto_apply BOOLEAN DEFAULT FALSE;

-- Migration 040: conversation events
CREATE TABLE IF NOT EXISTS conversation_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_id UUID REFERENCES accounts(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE conversation_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own conversation_events" ON conversation_events;
CREATE POLICY "Users can read own conversation_events" ON conversation_events FOR SELECT USING (account_id = auth.uid());

-- Migration 040: onboarding
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS onboarding_steps JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Migration 040: order post-delivery events
CREATE TABLE IF NOT EXISTS order_post_delivery_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_opde_order_event ON order_post_delivery_events(order_id, event_type);
ALTER TABLE order_post_delivery_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own order_post_delivery_events" ON order_post_delivery_events;
CREATE POLICY "Users can manage own order_post_delivery_events" ON order_post_delivery_events FOR ALL USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

-- Migration 040: message read receipts
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Migration 040: first sale tracking
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS first_sale_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_sale_celebrated BOOLEAN DEFAULT FALSE;

-- Migration 040: quick replies
ALTER TABLE quick_replies
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Migration 041: store extensions
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
  ADD COLUMN IF NOT EXISTS instagram_handle TEXT,
  ADD COLUMN IF NOT EXISTS facebook_page TEXT,
  ADD COLUMN IF NOT EXISTS banner_url TEXT,
  ADD COLUMN IF NOT EXISTS theme JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE;

DROP POLICY IF EXISTS "Public can read published stores" ON stores;
CREATE POLICY "Public can read published stores" ON stores FOR SELECT USING (is_published = TRUE AND is_active = TRUE);

-- Migration 042: loyalty + affiliates
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS loyalty_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS loyalty_points_per_egl INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS loyalty_points_value DECIMAL(10,2) DEFAULT 0.05,
  ADD COLUMN IF NOT EXISTS loyalty_tier_thresholds JSONB DEFAULT '{"bronze": 0, "silver": 1000, "gold": 5000, "platinum": 15000}'::jsonb,
  ADD COLUMN IF NOT EXISTS verified_status TEXT DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_application JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS email_channel_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_channel_address TEXT,
  ADD COLUMN IF NOT EXISTS max_stores INTEGER DEFAULT 1;

-- Migration 043: knowledge base + subscriptions + visual search
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'text',
  content TEXT NOT NULL,
  chunks JSONB DEFAULT '[]'::jsonb,
  embedding_status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own knowledge_documents" ON knowledge_documents;
CREATE POLICY "Users can manage own knowledge_documents" ON knowledge_documents FOR ALL USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant TEXT,
  quantity INTEGER DEFAULT 1,
  frequency_days INTEGER NOT NULL DEFAULT 30,
  next_order_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'active',
  total_orders INTEGER DEFAULT 0,
  last_order_at TIMESTAMPTZ,
  price_snapshot DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'EGP',
  payment_method TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own subscriptions" ON subscriptions;
CREATE POLICY "Users can manage own subscriptions" ON subscriptions FOR ALL USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

ALTER TABLE customers ADD COLUMN IF NOT EXISTS referred_by_affiliate_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS label_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bulk_ship_batch_id TEXT;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS endpoint_url TEXT;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS expiration_time TIMESTAMPTZ;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

-- Migration 044: templates + CSAT + flows + live chat
CREATE TABLE IF NOT EXISTS wa_template_library (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  body TEXT NOT NULL,
  header TEXT,
  footer TEXT,
  buttons JSONB DEFAULT '[]'::jsonb,
  variables JSONB DEFAULT '[]'::jsonb,
  meta_status TEXT DEFAULT 'not_submitted',
  meta_template_id TEXT,
  meta_rejection_reason TEXT,
  is_global BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS csat_surveys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  feedback TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE csat_surveys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own csat_surveys" ON csat_surveys;
CREATE POLICY "Users can manage own csat_surveys" ON csat_surveys FOR ALL USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

CREATE TABLE IF NOT EXISTS live_chat_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  customer_name TEXT,
  customer_email TEXT,
  visitor_id TEXT,
  status TEXT DEFAULT 'open',
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ
);
ALTER TABLE live_chat_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own live_chat_sessions" ON live_chat_sessions;
CREATE POLICY "Users can manage own live_chat_sessions" ON live_chat_sessions FOR ALL USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

CREATE TABLE IF NOT EXISTS automation_flows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB DEFAULT '{}'::jsonb,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'draft',
  total_runs INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE automation_flows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own automation_flows" ON automation_flows;
CREATE POLICY "Users can manage own automation_flows" ON automation_flows FOR ALL USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

-- Migration 045: indexes + email drip + newsletter + blog
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_account_status ON orders(account_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_account_created ON orders(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_account_ltv ON customers(account_id, lifetime_value DESC);
CREATE INDEX IF NOT EXISTS idx_customers_account_active ON customers(account_id, last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_account_lastmsg ON conversations(account_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(account_id, status);
CREATE INDEX IF NOT EXISTS idx_products_account_status ON products(account_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_account_unread ON notifications(account_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_carts_conversation_open ON carts(conversation_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_pending_actions_status ON pending_actions(account_id, status, proposed_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_order ON subscriptions(next_order_at) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS email_drip_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  drip_type TEXT NOT NULL DEFAULT 'first_week',
  step_number INTEGER NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  UNIQUE(account_id, drip_type, step_number)
);
ALTER TABLE email_drip_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own drip_logs" ON email_drip_logs;
CREATE POLICY "Users can read own drip_logs" ON email_drip_logs FOR SELECT USING (account_id = auth.uid());

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  source TEXT DEFAULT 'homepage_footer',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  cover_image TEXT,
  author TEXT DEFAULT 'Sellora Team',
  category TEXT DEFAULT 'guides',
  tags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  views INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read published blog_posts" ON blog_posts;
CREATE POLICY "Public can read published blog_posts" ON blog_posts FOR SELECT USING (status = 'published');

-- Migration 046: Blog posts content (5 SEO articles)
INSERT INTO blog_posts (title, slug, excerpt, content, category, tags, status, published_at, author) VALUES
('How to Sell on WhatsApp in Egypt (2026 Guide)', 'how-to-sell-on-whatsapp-egypt-2026', 'A complete guide to setting up WhatsApp Business API and automating sales in Egypt.', '# How to Sell on WhatsApp in Egypt

WhatsApp is the #1 messaging app in Egypt with over 50 million users. This guide covers everything from setup to AI automation.

## Step 1: Get WhatsApp Business API
Set up at developers.facebook.com, create a Business app, add WhatsApp product.

## Step 2: Connect to Sellora
Sellora handles AI auto-replies, product catalog, orders, and payments.

## Step 3: Add Products
Add products with images, prices, and descriptions. The AI uses them to sell.

## Step 4: Enable AI
The AI replies 24/7 in Arabic and English, creates orders, and sends payment links.

## Step 5: Accept Payments
Paymob for cards/Vodafone Cash, COD for cash customers.

Start your free trial at Sellora today!', 'guides', ARRAY['whatsapp','egypt','e-commerce'], 'published', NOW(), 'Sellora Team'),
('WhatsApp Business API Pricing Explained', 'whatsapp-business-api-pricing-explained', 'How much does WhatsApp Business API cost? Complete breakdown for Egyptian sellers.', '# WhatsApp Business API Pricing

WhatsApp Cloud API is free to set up. You pay per conversation (24h session).

## Pricing
- Service (customer-initiated): $0.0088
- Utility (order updates): $0.015
- Marketing (broadcasts): $0.025
- First 1,000/month: FREE

## Example
500 customer conversations + 200 order updates = ~$5.50/month (~170 EGP)

## Tips
Use AI to handle conversations, batch broadcasts, reply within 24h.

Combined with Sellora (999-5999 EGP/month), you get a complete sales channel.', 'guides', ARRAY['whatsapp','pricing','api'], 'published', NOW(), 'Sellora Team'),
('5 Ways AI Can Increase Your WhatsApp Sales', '5-ways-ai-increase-whatsapp-sales', 'AI isnt just for FAQs. Here are 5 proven ways AI actively drives sales on WhatsApp.', '# 5 Ways AI Increases Sales

1. **Product Recommendations** - AI suggests complementary items (20-30% AOV increase)
2. **Order Creation** - AI creates orders mid-conversation with cart + payment link
3. **Customer Memory** - AI remembers preferences, size, payment method
4. **Cart Recovery** - 3-step automated sequence recovers 15-25% of abandoned carts
5. **Review Collection** - Auto-sends rating prompts after delivery

Result: 30% higher conversion, 25% higher AOV, 80% faster response time.

Start with Sellora - AI is ready to sell from day one.', 'guides', ARRAY['ai','whatsapp','sales'], 'published', NOW(), 'Sellora Team'),
('Cash on Delivery: Best Practices for Egyptian E-commerce', 'cash-on-delivery-best-practices-egypt', 'COD has 30-40% refusal rate. Heres how to minimize refusals and maximize deliveries.', '# COD Best Practices for Egypt

60% of Egyptian online orders are COD, but 30-40% are refused at the door.

## 7 Best Practices
1. **Confirm every order** via WhatsApp before shipping (cuts refusals 50%)
2. **Use interactive buttons** for 1-tap confirmation
3. **Set a deadline** - "Confirm by 6 PM or auto-cancel"
4. **Offer online payment incentive** - 5% discount for prepay
5. **Track refusal rates** per customer
6. **Call high-value orders** (1000+ EGP)
7. **Partial COD** - 30% prepay + 70% COD

## The Math
Without confirmation: 40% refused = 2,400 EGP loss per 100 orders
With confirmation: 15% refused = 900 EGP loss per 100 orders
**Savings: 1,500 EGP per 100 orders**

Sellora automates the entire COD confirmation flow.', 'guides', ARRAY['cod','egypt','payments'], 'published', NOW(), 'Sellora Team'),
('Instagram DM Automation for Small Businesses', 'instagram-dm-automation-small-businesses', 'Turn Instagram DMs into a sales channel with AI automation.', '# Instagram DM Automation

80% of Instagram users follow a business. DMs have 40% higher open rate than email.

## Setup
1. Switch to Business account
2. Connect Meta App with Messenger API
3. Enable AI auto-replies via Sellora

## What AI Does
- Replies instantly to product inquiries
- Recommends products
- Creates orders from DMs
- Handles order status
- Auto-greeting for new conversations

## Instagram + WhatsApp Strategy
Use Instagram for discovery (post products, use hashtags) then convert to WhatsApp for closing sales.

Sellora unifies both channels in one inbox with one AI agent.', 'guides', ARRAY['instagram','automation','dm'], 'published', NOW(), 'Sellora Team')
ON CONFLICT DO NOTHING;

-- Backfill resolved_by for existing conversations
UPDATE conversations c SET resolved_by = 'ai'
WHERE c.status = 'closed' AND c.resolved_by IS NULL
AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.is_ai = TRUE AND m.direction = 'outgoing')
AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.is_ai = FALSE AND m.direction = 'outgoing');

UPDATE conversations c SET resolved_by = 'human'
WHERE c.status = 'closed' AND c.resolved_by IS NULL
AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.is_ai = FALSE AND m.direction = 'outgoing');

UPDATE conversations c SET resolved_by = 'mixed'
WHERE c.status = 'closed' AND c.resolved_by IS NULL;

-- Done!
SELECT 'Production setup complete!' as status;

-- ============================================
-- Migration 047: Shopify products sync fix
-- ============================================
-- Adds shopify_id column + unique constraint to products table so the
-- Shopify sync route's upsert(..., { onConflict: 'account_id, shopify_id' })
-- actually works. Without this, every sync silently failed.

ALTER TABLE products ADD COLUMN IF NOT EXISTS shopify_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS products_account_id_shopify_id_key
  ON products(account_id, shopify_id)
  WHERE shopify_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_shopify_id
  ON products(shopify_id)
  WHERE shopify_id IS NOT NULL;

-- ============================================
-- Migration 048: Security RLS fixes
-- ============================================
-- Fixes critical RLS gaps:
-- - notifications table had USING(true) policy (open to anon)
-- - affiliate_clicks / affiliate_orders had no RLS at all
-- - wa_template_library / newsletter_subscribers had no RLS at all
-- - blog_posts was missing owner INSERT/UPDATE/DELETE policies

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON notifications;
CREATE POLICY "Service role full access" ON notifications
  FOR ALL TO authenticated, anon, service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT TO authenticated USING (account_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications" ON notifications
  FOR DELETE TO authenticated USING (account_id = auth.uid());

ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own affiliate_clicks" ON affiliate_clicks;
CREATE POLICY "Users can manage own affiliate_clicks" ON affiliate_clicks
  FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());
DROP POLICY IF EXISTS "Public can insert affiliate clicks" ON affiliate_clicks;
CREATE POLICY "Public can insert affiliate clicks" ON affiliate_clicks
  FOR INSERT TO anon, authenticated WITH CHECK (true);

ALTER TABLE affiliate_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own affiliate_orders" ON affiliate_orders;
CREATE POLICY "Users can manage own affiliate_orders" ON affiliate_orders
  FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

ALTER TABLE wa_template_library ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read wa_template_library" ON wa_template_library;
CREATE POLICY "Public can read wa_template_library" ON wa_template_library
  FOR SELECT TO authenticated, anon USING (true);

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can subscribe" ON newsletter_subscribers;
CREATE POLICY "Anyone can subscribe" ON newsletter_subscribers
  FOR INSERT TO anon, authenticated WITH CHECK (true);

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read published blog_posts" ON blog_posts;
CREATE POLICY "Public can read published blog_posts" ON blog_posts
  FOR SELECT TO authenticated, anon USING (status = 'published');
DROP POLICY IF EXISTS "Users can manage own blog_posts" ON blog_posts;
CREATE POLICY "Users can manage own blog_posts" ON blog_posts
  FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

-- Verify all sensitive tables have RLS enabled
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE abandoned_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Migration 049: Revenue automation suite
-- ============================================
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS winback_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS winback_days_threshold integer DEFAULT 60;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS winback_discount_percent integer DEFAULT 10;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS winback_message_template text;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS back_in_stock_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS back_in_stock_message_template text;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS upsell_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS upsell_delay_days integer DEFAULT 3;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS upsell_discount_percent integer DEFAULT 15;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS upsell_message_template text;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS payment_recovery_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS payment_recovery_discount_percent integer DEFAULT 5;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS payment_recovery_message_template text;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS vip_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS vip_threshold numeric DEFAULT 5000;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS vip_welcome_message text;

CREATE TABLE IF NOT EXISTS win_back_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  days_dormant integer NOT NULL,
  discount_code text, discount_percent integer,
  message_sent text, status text DEFAULT 'sent',
  sent_at timestamptz DEFAULT now(), recovered_at timestamptz,
  recovered_order_id uuid, created_at timestamptz DEFAULT now(),
  UNIQUE(account_id, customer_id)
);

CREATE TABLE IF NOT EXISTS back_in_stock_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  conversation_id uuid, notified boolean DEFAULT false,
  notified_at timestamptz, created_at timestamptz DEFAULT now(),
  UNIQUE(account_id, customer_id, product_id)
);

CREATE TABLE IF NOT EXISTS upsell_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  suggested_products jsonb DEFAULT '[]', discount_code text,
  discount_percent integer, message_sent text, status text DEFAULT 'sent',
  sent_at timestamptz DEFAULT now(), converted_at timestamptz,
  converted_order_id uuid, created_at timestamptz DEFAULT now(),
  UNIQUE(account_id, order_id)
);

CREATE TABLE IF NOT EXISTS payment_recoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  discount_code text, discount_percent integer, message_sent text,
  attempts integer DEFAULT 1, status text DEFAULT 'sent',
  sent_at timestamptz DEFAULT now(), recovered_at timestamptz,
  created_at timestamptz DEFAULT now(), UNIQUE(account_id, order_id)
);

CREATE TABLE IF NOT EXISTS vip_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  total_spent numeric NOT NULL, tagged_at timestamptz DEFAULT now(),
  welcome_sent_at timestamptz, UNIQUE(account_id, customer_id)
);

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

-- ============================================
-- Migration 050: Lifecycle + AI automation suite
-- ============================================
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS birthday_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS birthday_discount_percent integer DEFAULT 20;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS birthday_message_template text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS welcome_series_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS welcome_discount_percent integer DEFAULT 10;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS reorder_reminders_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS reorder_reminder_days integer DEFAULT 25;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS reorder_message_template text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS review_optimization_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS segment_auto_update_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS smart_routing_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS routing_rules jsonb DEFAULT '[]';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS faq_auto_generate_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS negative_review_response_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS negative_review_message_template text;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS birthday date;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS first_order_at timestamptz;

CREATE TABLE IF NOT EXISTS birthday_rewards (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL, customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL, discount_code text, discount_percent integer, message_sent text, sent_at timestamptz DEFAULT now(), created_at timestamptz DEFAULT now(), UNIQUE(account_id, customer_id, sent_at));
CREATE TABLE IF NOT EXISTS welcome_series (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL, customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL, step integer NOT NULL, message_sent text, discount_code text, sent_at timestamptz DEFAULT now(), converted boolean DEFAULT false, converted_order_id uuid REFERENCES orders(id), created_at timestamptz DEFAULT now(), UNIQUE(account_id, customer_id, step));
CREATE TABLE IF NOT EXISTS reorder_reminders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL, customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL, order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL, product_name text, message_sent text, sent_at timestamptz DEFAULT now(), converted boolean DEFAULT false, converted_order_id uuid REFERENCES orders(id), created_at timestamptz DEFAULT now(), UNIQUE(account_id, order_id));
CREATE TABLE IF NOT EXISTS review_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL, order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL, customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL, scheduled_for timestamptz, sent_at timestamptz, responded_at timestamptz, rating integer, status text DEFAULT 'scheduled', created_at timestamptz DEFAULT now(), UNIQUE(account_id, order_id));
CREATE TABLE IF NOT EXISTS routing_assignments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL, conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE NOT NULL, assigned_to uuid, assigned_by text, rule_matched text, assigned_at timestamptz DEFAULT now(), created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS faq_drafts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL, question text NOT NULL, answer text NOT NULL, source_conversation_ids uuid[] DEFAULT '{}', frequency integer DEFAULT 1, status text DEFAULT 'draft', generated_at timestamptz DEFAULT now(), reviewed_at timestamptz, reviewed_by uuid, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS negative_review_responses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL, review_id uuid REFERENCES product_reviews(id) ON DELETE CASCADE NOT NULL, customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL, draft_response text, sent_at timestamptz, status text DEFAULT 'draft', created_at timestamptz DEFAULT now(), UNIQUE(account_id, review_id));

ALTER TABLE birthday_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own birthday_rewards" ON birthday_rewards FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());
ALTER TABLE welcome_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own welcome_series" ON welcome_series FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());
ALTER TABLE reorder_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own reorder_reminders" ON reorder_reminders FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());
ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own review_requests" ON review_requests FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());
ALTER TABLE routing_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own routing_assignments" ON routing_assignments FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());
ALTER TABLE faq_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own faq_drafts" ON faq_drafts FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());
ALTER TABLE negative_review_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own negative_review_responses" ON negative_review_responses FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());
