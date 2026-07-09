-- ============================================================
-- Migration 035: Critical Security Fixes
-- Fixes: RLS gaps, open policies, missing constraints, 
-- referral fraud, migration ordering
-- ============================================================

-- ═══ FIX 1: Notifications RLS — was USING (true), now service_role only ═══
DROP POLICY IF EXISTS "Service role full access" ON public.notifications;

CREATE POLICY "Service role full access" ON public.notifications
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Allow users to read their own notifications
-- 🔒 FIX: Must drop existing policy first (created in migration 017a) to avoid duplicate name error
-- that would roll back the entire migration transaction
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;

CREATE POLICY "Users can read own notifications" ON public.notifications
  FOR SELECT USING (account_id = auth.uid());

-- ═══ FIX 2: push_subscriptions — enable RLS and add policies ═══
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own push subscriptions" ON push_subscriptions
  FOR ALL USING (account_id = auth.uid());

-- ═══ FIX 3: Referral INSERT policy — enforce referrer_id = auth.uid() ═══
DROP POLICY IF EXISTS "Authenticated users can insert referrals" ON referrals;

CREATE POLICY "Users can insert own referrals" ON referrals
  FOR INSERT WITH CHECK (referrer_id = auth.uid());

-- ═══ FIX 4: Restrict increment_referral_credits() to service_role only ═══
REVOKE EXECUTE ON FUNCTION increment_referral_credits FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_referral_credits TO service_role;

-- ═══ FIX 5: Add missing index on orders.order_number ═══
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- ═══ FIX 6: Add CHECK constraint on coupons.value (no negative, no >100%) ═══
ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_value_positive;
ALTER TABLE coupons ADD CONSTRAINT coupons_value_positive CHECK (value > 0);

ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_percentage_max;
ALTER TABLE coupons ADD CONSTRAINT coupons_percentage_max 
  CHECK (type != 'percentage' OR value <= 100);

-- ═══ FIX 7: Add index on whatsapp_phone_number_id for webhook routing ═══
CREATE INDEX IF NOT EXISTS idx_accounts_whatsapp_phone ON accounts(whatsapp_phone_number_id);

-- ═══ FIX 8: webhook_deliveries — remove UPDATE policy (audit log integrity) ═══
DROP POLICY IF EXISTS "Users can update own webhook deliveries" ON webhook_deliveries;

-- ═══ FIX 9: broadcast_logs — restrict to SELECT + INSERT only (no DELETE) ═══
DROP POLICY IF EXISTS "Users can manage own broadcast_logs" ON broadcast_logs;

CREATE POLICY "Users can read own broadcast_logs" ON broadcast_logs
  FOR SELECT USING (account_id = auth.uid());

CREATE POLICY "Users can insert own broadcast_logs" ON broadcast_logs
  FOR INSERT WITH CHECK (account_id = auth.uid());

-- ═══ FIX 10: Add index on conversations.last_message_at ═══
CREATE INDEX IF NOT EXISTS idx_conversations_last_message 
  ON conversations(account_id, last_message_at DESC);

-- ═══ FIX 11: Add index on messages.is_ai ═══
CREATE INDEX IF NOT EXISTS idx_messages_is_ai ON messages(conversation_id, is_ai);
