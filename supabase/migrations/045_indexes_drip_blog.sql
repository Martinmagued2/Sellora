-- ============================================================
-- Migration 045: Performance indexes + affiliate tracking + email drip
-- ============================================================

-- ═══ 1. Performance indexes (critical for scale) ═══
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

-- ═══ 2. Email drip campaign tracking ═══
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

CREATE INDEX IF NOT EXISTS idx_drip_logs_account ON email_drip_logs(account_id, drip_type);

ALTER TABLE email_drip_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own drip_logs" ON email_drip_logs;
CREATE POLICY "Users can read own drip_logs"
  ON email_drip_logs FOR SELECT USING (account_id = auth.uid());

-- ═══ 3. Newsletter subscribers (from homepage email capture) ═══
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  source TEXT DEFAULT 'homepage_footer',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email);

-- ═══ 4. Blog posts table ═══
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
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  views INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_published ON blog_posts(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_slug ON blog_posts(slug);

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read published blog_posts" ON blog_posts;
CREATE POLICY "Public can read published blog_posts"
  ON blog_posts FOR SELECT USING (status = 'published');
