-- ============================================================
-- Migration 040: Conversation Enhancements
-- Adds: AI pause, assignment, snooze, summaries, internal notes,
--       AI message feedback, customer preferences (AI memory),
--       AI deflection tracking
-- ============================================================

-- ═══ 1. Conversations: extend with AI pause, snooze, summary, deflection ═══
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_paused BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_paused_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_paused_by UUID,            -- account id of who paused
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
CREATE INDEX IF NOT EXISTS idx_conversations_assigned ON conversations(account_id, assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_resolved_by ON conversations(account_id, resolved_by);

-- ═══ 2. Internal notes (private, AI-hidden) ═══
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

CREATE INDEX IF NOT EXISTS idx_conv_notes_conversation ON conversation_notes(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_notes_account ON conversation_notes(account_id);

ALTER TABLE conversation_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own conversation_notes" ON conversation_notes;
CREATE POLICY "Users can manage own conversation_notes"
  ON conversation_notes FOR ALL
  USING (account_id = auth.uid())
  WITH CHECK (account_id = auth.uid());

-- ═══ 3. AI message feedback (thumbs up/down on AI replies) ═══
CREATE TABLE IF NOT EXISTS ai_message_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  message_id UUID NOT NULL,                   -- reference to messages.id (no FK to avoid RLS churn)
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  rating TEXT NOT NULL CHECK (rating IN ('up', 'down')),
  reason TEXT,                                -- optional: "wrong info", "rude", "hallucinated", etc.
  operator_id UUID REFERENCES accounts(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id)                          -- one feedback per AI message
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_account ON ai_message_feedback(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_rating ON ai_message_feedback(account_id, rating);

ALTER TABLE ai_message_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own ai_message_feedback" ON ai_message_feedback;
CREATE POLICY "Users can manage own ai_message_feedback"
  ON ai_message_feedback FOR ALL
  USING (account_id = auth.uid())
  WITH CHECK (account_id = auth.uid());

-- ═══ 4. Customer preferences (AI memory) ═══
-- Structured JSONB the AI reads/writes via a tool.
-- Examples: {"prefers_cod": true, "allergies": ["peanuts"], "preferred_language": "ar", "vip": true}
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_memory TEXT,        -- free-form notes the AI can append to
  ADD COLUMN IF NOT EXISTS vip BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS lifetime_value DECIMAL(10,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_customers_preferences ON customers USING GIN (preferences);

-- ═══ 5. Pending AI actions (for order confirmations etc.) ═══
-- When AI proposes to create an order, it stores a "pending action"
-- that the operator or customer must approve before it executes.
CREATE TABLE IF NOT EXISTS pending_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  action_type TEXT NOT NULL CHECK (action_type IN ('create_order', 'redeem_coupon', 'send_payment_link', 'custom')),
  payload JSONB NOT NULL,                       -- the proposed action data
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'executed')),
  proposed_by TEXT NOT NULL DEFAULT 'ai' CHECK (proposed_by IN ('ai', 'operator')),
  proposed_at TIMESTAMPTZ DEFAULT NOW(),
  decided_by UUID REFERENCES accounts(id),       -- operator who decided (NULL if customer-approved)
  decided_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  executed_at TIMESTAMPTZ,
  result JSONB,                                  -- output of execution (e.g. order_id)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_actions_conversation ON pending_actions(conversation_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_actions_account ON pending_actions(account_id, status, proposed_at DESC);

ALTER TABLE pending_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own pending_actions" ON pending_actions;
CREATE POLICY "Users can manage own pending_actions"
  ON pending_actions FOR ALL
  USING (account_id = auth.uid())
  WITH CHECK (account_id = auth.uid());

-- ═══ 6. Carts (multi-item chat orders) ═══
CREATE TABLE IF NOT EXISTS carts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'converted', 'abandoned', 'expired')),
  items JSONB NOT NULL DEFAULT '[]',             -- [{product_id, name, price, qty, variant}]
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

CREATE INDEX IF NOT EXISTS idx_carts_account ON carts(account_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_carts_customer ON carts(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_carts_conversation ON carts(conversation_id) WHERE conversation_id IS NOT NULL;

ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own carts" ON carts;
CREATE POLICY "Users can manage own carts"
  ON carts FOR ALL
  USING (account_id = auth.uid())
  WITH CHECK (account_id = auth.uid());

-- ═══ 7. Extend abandoned_carts for 3-step recovery sequence ═══
-- Existing migration 022 has first_reminder_at, second_reminder_at.
-- Add third_reminder_at + sequence tracking.
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS third_reminder_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS third_reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recovery_sequence_version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recovery_revenue DECIMAL(10,2) DEFAULT 0;

-- ═══ 8. Product reviews ═══
CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected', 'flagged')),
  source TEXT DEFAULT 'whatsapp' CHECK (source IN ('whatsapp', 'instagram', 'facebook', 'manual', 'web')),
  reply TEXT,
  reply_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews(product_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_account ON product_reviews(account_id, status);
CREATE INDEX IF NOT EXISTS idx_reviews_customer ON product_reviews(customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_order_product_customer
  ON product_reviews(order_id, product_id, customer_id) WHERE order_id IS NOT NULL;

ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own product_reviews" ON product_reviews;
CREATE POLICY "Users can manage own product_reviews"
  ON product_reviews FOR ALL
  USING (account_id = auth.uid())
  WITH CHECK (account_id = auth.uid());

-- Public can read published reviews (for storefront later)
DROP POLICY IF EXISTS "Public can read published reviews" ON product_reviews;
CREATE POLICY "Public can read published reviews"
  ON product_reviews FOR SELECT
  USING (status = 'published');

-- ═══ 9. Extend coupons with smart types ═══
-- Add BOGO, tiered, first-order-only, customer-specific
ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS subtype TEXT DEFAULT 'standard' CHECK (subtype IN ('standard', 'bogo', 'tiered', 'first_order', 'customer_specific')),
  ADD COLUMN IF NOT EXISTS bogo_buy_qty INTEGER,         -- buy X
  ADD COLUMN IF NOT EXISTS bogo_get_qty INTEGER,         -- get Y
  ADD COLUMN IF NOT EXISTS bogo_get_discount_percent INTEGER DEFAULT 100,  -- % off the Y items
  ADD COLUMN IF NOT EXISTS tiered_rules JSONB,           -- [{"min": 500, "percent": 10}, {"min": 1000, "percent": 15}]
  ADD COLUMN IF NOT EXISTS target_customer_id UUID REFERENCES customers(id),
  ADD COLUMN IF NOT EXISTS auto_apply BOOLEAN DEFAULT FALSE;

-- ═══ 10. AI deflection tracking on conversations ═══
-- Add a helper view for deflection metrics
CREATE OR REPLACE VIEW v_ai_deflection AS
SELECT
  account_id,
  DATE_TRUNC('day', created_at) AS day,
  COUNT(*) AS total_conversations,
  COUNT(*) FILTER (WHERE resolved_by = 'ai') AS fully_ai_resolved,
  COUNT(*) FILTER (WHERE resolved_by = 'human') AS fully_human_resolved,
  COUNT(*) FILTER (WHERE resolved_by = 'mixed') AS mixed_resolved,
  ROUND(
    COUNT(*) FILTER (WHERE resolved_by = 'ai')::NUMERIC / NULLIF(COUNT(*), 0) * 100,
    2
  ) AS deflection_rate
FROM conversations
WHERE created_at > NOW() - INTERVAL '90 days'
GROUP BY account_id, day;

-- ═══ 11. Audit log entries ═══
-- Record AI pause/resume/snooze events for audit
CREATE TABLE IF NOT EXISTS conversation_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,                      -- 'ai_paused', 'ai_resumed', 'assigned', 'snoozed', 'unsnoozed', 'note_added', 'escalated'
  actor_id UUID REFERENCES accounts(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_events_conversation ON conversation_events(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_events_account ON conversation_events(account_id, created_at DESC);

ALTER TABLE conversation_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own conversation_events" ON conversation_events;
CREATE POLICY "Users can read own conversation_events"
  ON conversation_events FOR SELECT
  USING (account_id = auth.uid());

-- ═══ 12. Backfill resolved_by for existing conversations ═══
-- A conversation is "ai_resolved" if it has outgoing AI messages and
-- NO outgoing human messages (i.e. outgoing messages where is_ai = FALSE).
UPDATE conversations c
SET resolved_by = 'ai'
WHERE c.status = 'closed'
  AND c.resolved_by IS NULL
  AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.is_ai = TRUE AND m.direction = 'outgoing')
  AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.is_ai = FALSE AND m.direction = 'outgoing');

UPDATE conversations c
SET resolved_by = 'human'
WHERE c.status = 'closed'
  AND c.resolved_by IS NULL
  AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.is_ai = FALSE AND m.direction = 'outgoing');

UPDATE conversations c
SET resolved_by = 'mixed'
WHERE c.status = 'closed'
  AND c.resolved_by IS NULL;

-- ═══ 13. Onboarding checklist tracking on accounts ═══
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS onboarding_steps JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- onboarding_steps example:
-- {"connect_whatsapp": true, "add_product": true, "set_ai_personality": false, "send_test_msg": false, "invite_teammate": false}

-- ═══ 14. Order post-delivery event tracking ═══
-- Used by the post-delivery cron to avoid double-sending review requests
-- and payment reminders.
CREATE TABLE IF NOT EXISTS order_post_delivery_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('review_request', 'payment_reminder', 'thank_you_sent')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_opde_order_event
  ON order_post_delivery_events(order_id, event_type);

ALTER TABLE order_post_delivery_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own order_post_delivery_events" ON order_post_delivery_events;
CREATE POLICY "Users can manage own order_post_delivery_events"
  ON order_post_delivery_events FOR ALL
  USING (account_id = auth.uid())
  WITH CHECK (account_id = auth.uid());
