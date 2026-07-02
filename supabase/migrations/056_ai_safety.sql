-- Migration 056: AI Safety Center + Human Handoff System
--
-- This migration implements two review-item features:
--
-- 1. AI Safety Center
--    a) Confidence threshold — when the AI provider returns a finish_reason
--       that suggests uncertainty (e.g. "length", "content_filter"), the
--       message is flagged for human review instead of being auto-sent.
--    b) Preview mode — AI replies are saved with approval_status='pending'
--       instead of being sent immediately. Owner approves/rejects from the
--       dashboard.
--    c) High-value order approval — orders whose total exceeds a configurable
--       threshold are saved as pending_actions for owner approval rather than
--       auto-created.
--
-- 2. Human Handoff System
--    a) SLA timers — conversations have sla_deadline + priority. When a
--       conversation is escalated, sla_deadline = now + N hours (configurable).
--       A cron checks for breaches.
--    b) Priority levels — low/normal/high/urgent, settable from the UI.
--    c) Customer message — when AI escalates, a friendly message is sent to
--       the customer telling them a human will reply shortly.

-- ═══════════════════════════════════════════════════════════════
-- 1. AI Safety columns on accounts
-- ═══════════════════════════════════════════════════════════════

-- Confidence threshold (0-100). If the AI provider's confidence estimate
-- (or finish_reason-derived score) is below this, the reply is held for
-- human review instead of being sent to the customer.
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS ai_confidence_threshold integer DEFAULT 70
  CHECK (ai_confidence_threshold BETWEEN 0 AND 100);

-- Preview mode: when enabled, AI replies are stored with
-- approval_status='pending' rather than being sent to the customer.
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS ai_preview_mode boolean DEFAULT false;

-- High-value order threshold. Orders created by the AI whose total
-- exceeds this value are saved as pending_actions for owner approval
-- instead of being auto-created.
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS ai_high_value_threshold numeric(12,2) DEFAULT 1000;

-- SLA window in hours. When a conversation is escalated, sla_deadline
-- is set to now() + ai_sla_hours. Default 4 hours.
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS ai_sla_hours integer DEFAULT 4
  CHECK (ai_sla_hours > 0);

-- ═══════════════════════════════════════════════════════════════
-- 2. Human Handoff columns on conversations
-- ═══════════════════════════════════════════════════════════════

-- SLA deadline: timestamp by which a human must respond.
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS sla_deadline timestamptz;

-- Priority level for triage.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='priority') THEN
    ALTER TABLE conversations ADD COLUMN priority text DEFAULT 'normal';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add CHECK constraint on priority (drop first to allow re-creation with full set)
DO $$ BEGIN
  ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_priority_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE conversations ADD CONSTRAINT conversations_priority_check
    CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Index for fast SLA-breach queries
CREATE INDEX IF NOT EXISTS idx_conversations_sla_deadline
  ON conversations(sla_deadline)
  WHERE sla_deadline IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_priority
  ON conversations(account_id, priority);

-- ═══════════════════════════════════════════════════════════════
-- 3. Preview-mode approval column on messages
-- ═══════════════════════════════════════════════════════════════
--
-- When ai_preview_mode is enabled on the account, AI replies are stored
-- with approval_status='pending' rather than being sent immediately.
-- The owner can then approve (sends the message) or reject (discards).

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS approval_status text
  CHECK (approval_status IS NULL OR approval_status IN ('pending', 'approved', 'rejected'));

-- Index for fast "pending AI replies" queries on the dashboard
CREATE INDEX IF NOT EXISTS idx_messages_approval_pending
  ON messages(account_id, approval_status, created_at DESC)
  WHERE approval_status = 'pending';

-- Backfill existing rows: NULL approval_status for already-delivered messages
-- (no-op for new installs, safe for upgrades)
UPDATE messages
  SET approval_status = NULL
  WHERE approval_status IS NULL
    AND direction = 'outgoing'
    AND delivery_status IN ('delivered', 'sent', 'read');

-- ═══════════════════════════════════════════════════════════════
-- 4. Backfill default priority on existing conversations
-- ═══════════════════════════════════════════════════════════════
UPDATE conversations SET priority = 'normal' WHERE priority IS NULL;

-- ═══════════════════════════════════════════════════════════════
-- 5. Helpful comment for future readers
-- ═══════════════════════════════════════════════════════════════
--
-- SLA breach detection is performed by a cron that calls:
--   POST /api/ai-safety/sla-check
--
-- That endpoint marks conversations as 'sla_breached' (via status update
-- plus an 'sla_breached' tag) when now() > sla_deadline AND the
-- conversation is still in an unresolved state.
