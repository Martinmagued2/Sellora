-- Migration 037: Security audit fixes
-- Adds columns and functions needed for the security audit remediation

-- Add weekly_summary_sent_at column for rate limiting weekly summary emails
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS weekly_summary_sent_at TIMESTAMPTZ;

-- Add index for cron/scheduled job lookups
CREATE INDEX IF NOT EXISTS idx_campaigns_status_scheduled_at
  ON campaigns (status, scheduled_at)
  WHERE status = 'scheduled';
