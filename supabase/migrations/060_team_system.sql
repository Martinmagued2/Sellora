-- 060_team_system.sql
-- Team system overhaul: team-aware RLS + schema additions + team_member plan
-- Part of the team system rebuild — fixes the "team members see empty dashboard" bug.

-- ─────────────────────────────────────────────────────────────────────
-- 1. team_members schema additions
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'disabled', 'invited'));
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Backfill email + name from invited_email + accounts
UPDATE team_members
SET email = COALESCE(team_members.invited_email, accounts.email),
    name = COALESCE(accounts.owner_name, accounts.email),
    display_name = COALESCE(accounts.owner_name, split_part(accounts.email, '@', 1))
FROM accounts
WHERE team_members.user_id = accounts.id
  AND (team_members.email IS NULL OR team_members.name IS NULL);

-- Backfill email for pending invites (where user_id is the owner placeholder)
UPDATE team_members
SET email = invited_email
WHERE email IS NULL AND invited_email IS NOT NULL;

-- Update status check constraint to include 'pending'
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_status_check;
ALTER TABLE team_members ADD CONSTRAINT team_members_status_check
  CHECK (status IN ('active', 'disabled', 'invited', 'pending'));

-- Update existing rows: pending invite_status → status = 'invited'
UPDATE team_members SET status = 'invited' WHERE invite_status = 'pending';
UPDATE team_members SET status = 'active' WHERE invite_status = 'accepted';
UPDATE team_members SET status = 'disabled' WHERE invite_status = 'revoked';

-- Add assigned_at + assigned_by to conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS assigned_by UUID;

-- Add assigned_at to customer_tasks
ALTER TABLE customer_tasks ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
ALTER TABLE customer_tasks ADD COLUMN IF NOT EXISTS reassigned_by UUID;
ALTER TABLE customer_tasks ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────────────
-- 2. team_member plan in accounts (for plan-limits.js to recognize)
-- ─────────────────────────────────────────────────────────────────────
-- (No schema change needed — plan is just a TEXT column.
--  We just need to make sure plan-limits.js handles 'team_member'.)

-- ─────────────────────────────────────────────────────────────────────
-- 3. TEAM-AWARE RLS POLICIES
-- ─────────────────────────────────────────────────────────────────────
-- The core fix: team members should be able to read (and sometimes write)
-- rows that belong to the OWNER's account, not just their own.
--
-- Strategy: create a helper function `is_team_member(account_id)` that
-- returns TRUE if the current user is an accepted team member of that
-- account OR is the account owner. Then use it in all RLS policies.

CREATE OR REPLACE FUNCTION is_team_member(target_account_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    -- Owner case
    auth.uid() = target_account_id
    OR
    -- Team member case
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.user_id = auth.uid()
        AND team_members.account_id = target_account_id
        AND team_members.invite_status = 'accepted'
        AND team_members.status = 'active'
    )
    OR
    -- Platform admin override
    EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = auth.uid()
        AND accounts.role = 'admin'
    )
$$;

-- Grant execute on the helper
GRANT EXECUTE ON FUNCTION is_team_member(UUID) TO authenticated, anon;

-- ─────────────────────────────────────────────────────────────────────
-- 4. Replace existing RLS policies with team-aware versions
-- ─────────────────────────────────────────────────────────────────────

-- Helper: drop policy if exists
-- (Postgres doesn't have IF NOT EXISTS for CREATE POLICY, so we drop first)

-- conversations
DROP POLICY IF EXISTS "conversations_select_own" ON conversations;
DROP POLICY IF EXISTS "Owners can view conversations" ON conversations;
CREATE POLICY conversations_team_read ON conversations
  FOR SELECT USING (is_team_member(account_id));
DROP POLICY IF EXISTS "conversations_insert_own" ON conversations;
DROP POLICY IF EXISTS "Owners can insert conversations" ON conversations;
CREATE POLICY conversations_team_insert ON conversations
  FOR INSERT WITH CHECK (is_team_member(account_id));
DROP POLICY IF EXISTS "conversations_update_own" ON conversations;
DROP POLICY IF EXISTS "Owners can update conversations" ON conversations;
CREATE POLICY conversations_team_update ON conversations
  FOR UPDATE USING (is_team_member(account_id));
DROP POLICY IF EXISTS "conversations_delete_own" ON conversations;
CREATE POLICY conversations_team_delete ON conversations
  FOR DELETE USING (is_team_member(account_id));

-- messages
DROP POLICY IF EXISTS "messages_select_own" ON messages;
DROP POLICY IF EXISTS "Owners can view messages" ON messages;
CREATE POLICY messages_team_read ON messages
  FOR SELECT USING (is_team_member(account_id));
DROP POLICY IF EXISTS "messages_insert_own" ON messages;
CREATE POLICY messages_team_insert ON messages
  FOR INSERT WITH CHECK (is_team_member(account_id));
DROP POLICY IF EXISTS "messages_update_own" ON messages;
CREATE POLICY messages_team_update ON messages
  FOR UPDATE USING (is_team_member(account_id));

-- customers
DROP POLICY IF EXISTS "customers_select_own" ON customers;
DROP POLICY IF EXISTS "Owners can view customers" ON customers;
CREATE POLICY customers_team_read ON customers
  FOR SELECT USING (is_team_member(account_id));
DROP POLICY IF EXISTS "customers_insert_own" ON customers;
CREATE POLICY customers_team_insert ON customers
  FOR INSERT WITH CHECK (is_team_member(account_id));
DROP POLICY IF EXISTS "customers_update_own" ON customers;
CREATE POLICY customers_team_update ON customers
  FOR UPDATE USING (is_team_member(account_id));

-- orders
DROP POLICY IF EXISTS "orders_select_own" ON orders;
DROP POLICY IF EXISTS "Owners can view orders" ON orders;
CREATE POLICY orders_team_read ON orders
  FOR SELECT USING (is_team_member(account_id));
DROP POLICY IF EXISTS "orders_insert_own" ON orders;
CREATE POLICY orders_team_insert ON orders
  FOR INSERT WITH CHECK (is_team_member(account_id));
DROP POLICY IF EXISTS "orders_update_own" ON orders;
CREATE POLICY orders_team_update ON orders
  FOR UPDATE USING (is_team_member(account_id));

-- products
DROP POLICY IF EXISTS "products_select_own" ON products;
DROP POLICY IF EXISTS "Owners can view products" ON products;
CREATE POLICY products_team_read ON products
  FOR SELECT USING (is_team_member(account_id));
DROP POLICY IF EXISTS "products_insert_own" ON products;
CREATE POLICY products_team_insert ON products
  FOR INSERT WITH CHECK (is_team_member(account_id));
DROP POLICY IF EXISTS "products_update_own" ON products;
CREATE POLICY products_team_update ON products
  FOR UPDATE USING (is_team_member(account_id));
DROP POLICY IF EXISTS "products_delete_own" ON products;
CREATE POLICY products_team_delete ON products
  FOR DELETE USING (is_team_member(account_id));

-- customer_tasks
DROP POLICY IF EXISTS "customer_tasks_select_own" ON customer_tasks;
CREATE POLICY customer_tasks_team_read ON customer_tasks
  FOR SELECT USING (is_team_member(account_id));
DROP POLICY IF EXISTS "customer_tasks_insert_own" ON customer_tasks;
CREATE POLICY customer_tasks_team_insert ON customer_tasks
  FOR INSERT WITH CHECK (is_team_member(account_id));
DROP POLICY IF EXISTS "customer_tasks_update_own" ON customer_tasks;
CREATE POLICY customer_tasks_team_update ON customer_tasks
  FOR UPDATE USING (is_team_member(account_id));
DROP POLICY IF EXISTS "customer_tasks_delete_own" ON customer_tasks;
CREATE POLICY customer_tasks_team_delete ON customer_tasks
  FOR DELETE USING (is_team_member(account_id));

-- customer_notes
DROP POLICY IF EXISTS "customer_notes_select_own" ON customer_notes;
CREATE POLICY customer_notes_team_read ON customer_notes
  FOR SELECT USING (is_team_member(account_id));
DROP POLICY IF EXISTS "customer_notes_insert_own" ON customer_notes;
CREATE POLICY customer_notes_team_insert ON customer_notes
  FOR INSERT WITH CHECK (is_team_member(account_id));

-- conversation_notes
DROP POLICY IF EXISTS "conversation_notes_select_own" ON conversation_notes;
CREATE POLICY conversation_notes_team_read ON conversation_notes
  FOR SELECT USING (is_team_member(account_id));
DROP POLICY IF EXISTS "conversation_notes_insert_own" ON conversation_notes;
CREATE POLICY conversation_notes_team_insert ON conversation_notes
  FOR INSERT WITH CHECK (is_team_member(account_id));

-- conversation_events
DROP POLICY IF EXISTS "conversation_events_select_own" ON conversation_events;
CREATE POLICY conversation_events_team_read ON conversation_events
  FOR SELECT USING (is_team_member(account_id));
DROP POLICY IF EXISTS "conversation_events_insert_own" ON conversation_events;
CREATE POLICY conversation_events_team_insert ON conversation_events
  FOR INSERT WITH CHECK (is_team_member(account_id));

-- notifications
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY notifications_team_read ON notifications
  FOR SELECT USING (is_team_member(account_id));
DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
CREATE POLICY notifications_team_insert ON notifications
  FOR INSERT WITH CHECK (is_team_member(account_id));
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY notifications_team_update ON notifications
  FOR UPDATE USING (is_team_member(account_id));

-- broadcasts + campaigns + coupons + segments
DROP POLICY IF EXISTS "broadcasts_select_own" ON broadcasts;
CREATE POLICY broadcasts_team_read ON broadcasts
  FOR SELECT USING (is_team_member(account_id));

DROP POLICY IF EXISTS "campaigns_select_own" ON campaigns;
CREATE POLICY campaigns_team_read ON campaigns
  FOR SELECT USING (is_team_member(account_id));

-- abandoned_carts
DROP POLICY IF EXISTS "abandoned_carts_select_own" ON abandoned_carts;
CREATE POLICY abandoned_carts_team_read ON abandoned_carts
  FOR SELECT USING (is_team_member(account_id));

-- reviews
DROP POLICY IF EXISTS "reviews_select_own" ON reviews;
CREATE POLICY reviews_team_read ON reviews
  FOR SELECT USING (is_team_member(account_id));

-- ─────────────────────────────────────────────────────────────────────
-- 5. team_members can read other team_members on the same account
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Team members can read own membership" ON team_members;
CREATE POLICY team_members_read_team ON team_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_team_member(account_id)
  );

-- ─────────────────────────────────────────────────────────────────────
-- 6. Grant SELECT on team_members to authenticated users (for assignee lists)
-- ─────────────────────────────────────────────────────────────────────
GRANT SELECT ON team_members TO authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 7. Update team_members defaults so existing rows are valid
-- ─────────────────────────────────────────────────────────────────────
-- Ensure all accepted team_members have status='active'
UPDATE team_members SET status = 'active'
WHERE invite_status = 'accepted' AND status IS NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 8. Index for performance
-- ─────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_team_members_user_status ON team_members(user_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_to ON conversations(assigned_to);

-- ─────────────────────────────────────────────────────────────────────
-- 9. notifications.user_id — for targeting specific team members
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id UUID;
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- RLS for user_id-targeted notifications: a team member can read notifs
-- addressed to them OR addressed to the account they belong to.
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY notifications_team_read ON notifications
  FOR SELECT USING (
    -- Notifications targeted to me directly
    user_id = auth.uid()
    OR
    -- Notifications for an account I'm a member of (or own)
    is_team_member(account_id)
  );

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY notifications_team_update ON notifications
  FOR UPDATE USING (
    user_id = auth.uid() OR is_team_member(account_id)
  );

-- Done.
-- After running this migration:
-- 1. Team members can READ all of the owner's data (conversations, customers, orders, products, etc.)
-- 2. Team members can WRITE (insert/update) on the owner's data
-- 3. The /api/team-members endpoint will return real member data
-- 4. Conversation assignment will work
-- 5. Customer task assignment will work
