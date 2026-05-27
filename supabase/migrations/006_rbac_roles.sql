-- ============================================
-- RBAC: Add role column to accounts
-- ============================================

-- Add role column with default 'owner'
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'owner'
CHECK (role IN ('admin', 'owner', 'agent'));

-- Index for role lookups
CREATE INDEX IF NOT EXISTS idx_accounts_role ON accounts(role);
