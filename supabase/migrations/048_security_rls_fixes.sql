-- Migration 048: Security RLS fixes
--
-- Addresses CRITICAL and HIGH findings from the RLS audit:
--
-- C1: notifications table had USING(true) WITH CHECK(true) policy (open to anon)
-- C2: affiliate_clicks table had no RLS at all
-- C3: affiliate_orders table had no RLS at all
-- H1: wa_template_library table had no RLS (globally mutable)
-- H2: newsletter_subscribers table had no RLS (emails world-readable)
-- H3: blog_posts table missing INSERT/UPDATE/DELETE policies for owners
--
-- This migration is idempotent — safe to re-run.

-- ============================================
-- C1: Fix notifications USING(true) policy
-- ============================================
-- The "Service role full access" policy used USING(true) WITH CHECK(true),
-- which allows ANY role (including anon) to read/write/delete every
-- notification in the multi-tenant table.
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON notifications;
-- Re-create with proper service_role check (NOT USING(true))
CREATE POLICY "Service role full access" ON notifications
  FOR ALL
  TO authenticated, anon, service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Users can read their own notifications
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT
  TO authenticated
  USING (account_id = auth.uid());

-- Users can update their own notifications (mark as read, etc.)
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE
  TO authenticated
  USING (account_id = auth.uid())
  WITH CHECK (account_id = auth.uid());

-- Users can delete their own notifications
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications" ON notifications
  FOR DELETE
  TO authenticated
  USING (account_id = auth.uid());

-- ============================================
-- C2: Add RLS to affiliate_clicks
-- ============================================
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;

-- Account owners can read/manage their own affiliate clicks
DROP POLICY IF EXISTS "Users can manage own affiliate_clicks" ON affiliate_clicks;
CREATE POLICY "Users can manage own affiliate_clicks" ON affiliate_clicks
  FOR ALL
  TO authenticated
  USING (account_id = auth.uid())
  WITH CHECK (account_id = auth.uid());

-- Public can INSERT clicks (affiliate link tracking) — but only for valid affiliates
-- (validate via the affiliate_id → affiliates → account_id chain in the application layer)
DROP POLICY IF EXISTS "Public can insert affiliate clicks" ON affiliate_clicks;
CREATE POLICY "Public can insert affiliate clicks" ON affiliate_clicks
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ============================================
-- C3: Add RLS to affiliate_orders
-- ============================================
ALTER TABLE affiliate_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own affiliate_orders" ON affiliate_orders;
CREATE POLICY "Users can manage own affiliate_orders" ON affiliate_orders
  FOR ALL
  TO authenticated
  USING (account_id = auth.uid())
  WITH CHECK (account_id = auth.uid());

-- ============================================
-- H1: Add RLS to wa_template_library
-- ============================================
-- Global templates — anyone can read, but only service_role can write
-- (prevents attackers from injecting phishing templates)
ALTER TABLE wa_template_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read wa_template_library" ON wa_template_library;
CREATE POLICY "Public can read wa_template_library" ON wa_template_library
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- No INSERT/UPDATE/DELETE policy for anon/authenticated → only service_role can write

-- ============================================
-- H2: Add RLS to newsletter_subscribers
-- ============================================
-- Anyone can subscribe (INSERT), only service_role can read/manage
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can subscribe" ON newsletter_subscribers;
CREATE POLICY "Anyone can subscribe" ON newsletter_subscribers
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- No SELECT/UPDATE/DELETE policy for anon/authenticated
-- → emails are NOT world-readable (GDPR/CCPA compliance)

-- ============================================
-- H3: Add owner policies to blog_posts
-- ============================================
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Public can read published posts (existing policy — preserve it)
DROP POLICY IF EXISTS "Public can read published blog_posts" ON blog_posts;
CREATE POLICY "Public can read published blog_posts" ON blog_posts
  FOR SELECT
  TO authenticated, anon
  USING (status = 'published');

-- Account owners can manage their own posts
DROP POLICY IF EXISTS "Users can manage own blog_posts" ON blog_posts;
CREATE POLICY "Users can manage own blog_posts" ON blog_posts
  FOR ALL
  TO authenticated
  USING (account_id = auth.uid())
  WITH CHECK (account_id = auth.uid());

-- ============================================
-- Defense-in-depth: verify all sensitive tables have RLS enabled
-- ============================================
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
