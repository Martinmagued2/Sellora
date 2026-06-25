-- Migration 052: Unified activity notifications system
--
-- Adds:
-- 1. Notification preferences columns on accounts (toggle per category)
-- 2. Extends notifications table with priority + category columns
-- 3. Push + email delivery preference columns

-- ============================================
-- Notification preferences (per category)
-- ============================================
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS notif_prefs jsonb DEFAULT '{
  "orders": { "dashboard": true, "push": true, "email": false },
  "messages": { "dashboard": true, "push": true, "email": false },
  "payments": { "dashboard": true, "push": true, "email": true },
  "products": { "dashboard": true, "push": false, "email": false },
  "customers": { "dashboard": true, "push": false, "email": false },
  "reviews": { "dashboard": true, "push": true, "email": false },
  "team": { "dashboard": true, "push": false, "email": true },
  "channels": { "dashboard": true, "push": true, "email": true },
  "ai": { "dashboard": true, "push": false, "email": false },
  "automation": { "dashboard": true, "push": false, "email": false },
  "security": { "dashboard": true, "push": true, "email": true },
  "system": { "dashboard": true, "push": false, "email": false }
}';

-- Add columns to notifications table for richer categorization
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category text DEFAULT 'system';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_label text;

-- Index for fast unread queries
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(account_id, read, created_at DESC) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(account_id, category, created_at DESC);
