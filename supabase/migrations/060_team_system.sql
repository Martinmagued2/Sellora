-- 060_team_system.sql — DEFENSIVE VERSION
-- Skips tables that don't exist (broadcasts, campaigns, etc.)
-- Safe to run on any Sellora database.

-- ─────────────────────────────────────────────────────────────────────
-- 1. team_members schema additions
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Backfill email + name from invited_email + accounts
UPDATE team_members
SET email = COALESCE(team_members.invited_email, accounts.email),
    name = COALESCE(accounts.owner_name, accounts.email)
FROM accounts
WHERE team_members.user_id = accounts.id
  AND (team_members.email IS NULL OR team_members.name IS NULL);

UPDATE team_members
SET email = invited_email
WHERE email IS NULL AND invited_email IS NOT NULL;

-- Drop and re-add status check constraint with more values
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_status_check;
ALTER TABLE team_members ADD CONSTRAINT team_members_status_check
  CHECK (status IN ('active', 'disabled', 'invited', 'pending'));

-- Backfill status from invite_status
UPDATE team_members SET status = 'invited' WHERE invite_status = 'pending';
UPDATE team_members SET status = 'active' WHERE invite_status = 'accepted';
UPDATE team_members SET status = 'disabled' WHERE invite_status = 'revoked';

-- Conversations + customer_tasks additions
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS assigned_by UUID;
ALTER TABLE customer_tasks ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
ALTER TABLE customer_tasks ADD COLUMN IF NOT EXISTS reassigned_by UUID;
ALTER TABLE customer_tasks ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────────────
-- 2. is_team_member() helper function
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_team_member(target_account_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    auth.uid() = target_account_id
    OR
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.user_id = auth.uid()
        AND team_members.account_id = target_account_id
        AND team_members.invite_status = 'accepted'
        AND team_members.status = 'active'
    )
    OR
    EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = auth.uid()
        AND accounts.role = 'admin'
    )
$$;

GRANT EXECUTE ON FUNCTION is_team_member(UUID) TO authenticated, anon;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Apply team-aware RLS policies — DEFENSIVE (skips missing tables)
-- ─────────────────────────────────────────────────────────────────────

-- Helper: apply RLS policies only if the table exists
DO $$
BEGIN
  -- conversations
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations') THEN
    EXECUTE 'DROP POLICY IF EXISTS conversations_select_own ON conversations';
    EXECUTE 'DROP POLICY IF EXISTS "Owners can view conversations" ON conversations';
    EXECUTE 'CREATE POLICY conversations_team_read ON conversations FOR SELECT USING (is_team_member(account_id))';
    EXECUTE 'DROP POLICY IF EXISTS conversations_insert_own ON conversations';
    EXECUTE 'DROP POLICY IF EXISTS "Owners can insert conversations" ON conversations';
    EXECUTE 'CREATE POLICY conversations_team_insert ON conversations FOR INSERT WITH CHECK (is_team_member(account_id))';
    EXECUTE 'DROP POLICY IF EXISTS conversations_update_own ON conversations';
    EXECUTE 'DROP POLICY IF EXISTS "Owners can update conversations" ON conversations';
    EXECUTE 'CREATE POLICY conversations_team_update ON conversations FOR UPDATE USING (is_team_member(account_id))';
    EXECUTE 'DROP POLICY IF EXISTS conversations_delete_own ON conversations';
    EXECUTE 'CREATE POLICY conversations_team_delete ON conversations FOR DELETE USING (is_team_member(account_id))';
  END IF;

  -- messages
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
    EXECUTE 'DROP POLICY IF EXISTS messages_select_own ON messages';
    EXECUTE 'DROP POLICY IF EXISTS "Owners can view messages" ON messages';
    EXECUTE 'CREATE POLICY messages_team_read ON messages FOR SELECT USING (is_team_member(account_id))';
    EXECUTE 'DROP POLICY IF EXISTS messages_insert_own ON messages';
    EXECUTE 'CREATE POLICY messages_team_insert ON messages FOR INSERT WITH CHECK (is_team_member(account_id))';
    EXECUTE 'DROP POLICY IF EXISTS messages_update_own ON messages';
    EXECUTE 'CREATE POLICY messages_team_update ON messages FOR UPDATE USING (is_team_member(account_id))';
  END IF;

  -- customers
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
    EXECUTE 'DROP POLICY IF EXISTS customers_select_own ON customers';
    EXECUTE 'DROP POLICY IF EXISTS "Owners can view customers" ON customers';
    EXECUTE 'CREATE POLICY customers_team_read ON customers FOR SELECT USING (is_team_member(account_id))';
    EXECUTE 'DROP POLICY IF EXISTS customers_insert_own ON customers';
    EXECUTE 'CREATE POLICY customers_team_insert ON customers FOR INSERT WITH CHECK (is_team_member(account_id))';
    EXECUTE 'DROP POLICY IF EXISTS customers_update_own ON customers';
    EXECUTE 'CREATE POLICY customers_team_update ON customers FOR UPDATE USING (is_team_member(account_id))';
  END IF;

  -- orders
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
    EXECUTE 'DROP POLICY IF EXISTS orders_select_own ON orders';
    EXECUTE 'DROP POLICY IF EXISTS "Owners can view orders" ON orders';
    EXECUTE 'CREATE POLICY orders_team_read ON orders FOR SELECT USING (is_team_member(account_id))';
    EXECUTE 'DROP POLICY IF EXISTS orders_insert_own ON orders';
    EXECUTE 'CREATE POLICY orders_team_insert ON orders FOR INSERT WITH CHECK (is_team_member(account_id))';
    EXECUTE 'DROP POLICY IF EXISTS orders_update_own ON orders';
    EXECUTE 'CREATE POLICY orders_team_update ON orders FOR UPDATE USING (is_team_member(account_id))';
  END IF;

  -- products
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
    EXECUTE 'DROP POLICY IF EXISTS products_select_own ON products';
    EXECUTE 'DROP POLICY IF EXISTS "Owners can view products" ON products';
    EXECUTE 'CREATE POLICY products_team_read ON products FOR SELECT USING (is_team_member(account_id))';
    EXECUTE 'DROP POLICY IF EXISTS products_insert_own ON products';
    EXECUTE 'CREATE POLICY products_team_insert ON products FOR INSERT WITH CHECK (is_team_member(account_id))';
    EXECUTE 'DROP POLICY IF EXISTS products_update_own ON products';
    EXECUTE 'CREATE POLICY products_team_update ON products FOR UPDATE USING (is_team_member(account_id))';
    EXECUTE 'DROP POLICY IF EXISTS products_delete_own ON products';
    EXECUTE 'CREATE POLICY products_team_delete ON products FOR DELETE USING (is_team_member(account_id))';
  END IF;

  -- customer_tasks
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_tasks') THEN
    EXECUTE 'DROP POLICY IF EXISTS customer_tasks_select_own ON customer_tasks';
    EXECUTE 'CREATE POLICY customer_tasks_team_read ON customer_tasks FOR SELECT USING (is_team_member(account_id))';
    EXECUTE 'DROP POLICY IF EXISTS customer_tasks_insert_own ON customer_tasks';
    EXECUTE 'CREATE POLICY customer_tasks_team_insert ON customer_tasks FOR INSERT WITH CHECK (is_team_member(account_id))';
    EXECUTE 'DROP POLICY IF EXISTS customer_tasks_update_own ON customer_tasks';
    EXECUTE 'CREATE POLICY customer_tasks_team_update ON customer_tasks FOR UPDATE USING (is_team_member(account_id))';
    EXECUTE 'DROP POLICY IF EXISTS customer_tasks_delete_own ON customer_tasks';
    EXECUTE 'CREATE POLICY customer_tasks_team_delete ON customer_tasks FOR DELETE USING (is_team_member(account_id))';
  END IF;

  -- customer_notes
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_notes') THEN
    EXECUTE 'DROP POLICY IF EXISTS customer_notes_select_own ON customer_notes';
    EXECUTE 'CREATE POLICY customer_notes_team_read ON customer_notes FOR SELECT USING (is_team_member(account_id))';
    EXECUTE 'DROP POLICY IF EXISTS customer_notes_insert_own ON customer_notes';
    EXECUTE 'CREATE POLICY customer_notes_team_insert ON customer_notes FOR INSERT WITH CHECK (is_team_member(account_id))';
  END IF;

  -- conversation_notes
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversation_notes') THEN
    EXECUTE 'DROP POLICY IF EXISTS conversation_notes_select_own ON conversation_notes';
    EXECUTE 'CREATE POLICY conversation_notes_team_read ON conversation_notes FOR SELECT USING (is_team_member(account_id))';
    EXECUTE 'DROP POLICY IF EXISTS conversation_notes_insert_own ON conversation_notes';
    EXECUTE 'CREATE POLICY conversation_notes_team_insert ON conversation_notes FOR INSERT WITH CHECK (is_team_member(account_id))';
  END IF;

  -- conversation_events
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversation_events') THEN
    EXECUTE 'DROP POLICY IF EXISTS conversation_events_select_own ON conversation_events';
    EXECUTE 'CREATE POLICY conversation_events_team_read ON conversation_events FOR SELECT USING (is_team_member(account_id))';
    EXECUTE 'DROP POLICY IF EXISTS conversation_events_insert_own ON conversation_events';
    EXECUTE 'CREATE POLICY conversation_events_team_insert ON conversation_events FOR INSERT WITH CHECK (is_team_member(account_id))';
  END IF;

  -- notifications
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    EXECUTE 'DROP POLICY IF EXISTS notifications_select_own ON notifications';
    EXECUTE 'DROP POLICY IF EXISTS "Users can read own notifications" ON notifications';
    EXECUTE 'CREATE POLICY notifications_team_read ON notifications FOR SELECT USING (user_id = auth.uid() OR is_team_member(account_id))';
    EXECUTE 'DROP POLICY IF EXISTS notifications_insert_own ON notifications';
    EXECUTE 'CREATE POLICY notifications_team_insert ON notifications FOR INSERT WITH CHECK (is_team_member(account_id))';
    EXECUTE 'DROP POLICY IF EXISTS notifications_update_own ON notifications';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update own notifications" ON notifications';
    EXECUTE 'CREATE POLICY notifications_team_update ON notifications FOR UPDATE USING (user_id = auth.uid() OR is_team_member(account_id))';
  END IF;

  -- broadcasts (only if exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'broadcasts') THEN
    EXECUTE 'DROP POLICY IF EXISTS broadcasts_select_own ON broadcasts';
    EXECUTE 'CREATE POLICY broadcasts_team_read ON broadcasts FOR SELECT USING (is_team_member(account_id))';
  END IF;

  -- campaigns (only if exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns') THEN
    EXECUTE 'DROP POLICY IF EXISTS campaigns_select_own ON campaigns';
    EXECUTE 'CREATE POLICY campaigns_team_read ON campaigns FOR SELECT USING (is_team_member(account_id))';
  END IF;

  -- abandoned_carts (only if exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'abandoned_carts') THEN
    EXECUTE 'DROP POLICY IF EXISTS abandoned_carts_select_own ON abandoned_carts';
    EXECUTE 'CREATE POLICY abandoned_carts_team_read ON abandoned_carts FOR SELECT USING (is_team_member(account_id))';
  END IF;

  -- reviews (only if exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reviews') THEN
    EXECUTE 'DROP POLICY IF EXISTS reviews_select_own ON reviews';
    EXECUTE 'CREATE POLICY reviews_team_read ON reviews FOR SELECT USING (is_team_member(account_id))';
  END IF;

  -- team_members: can read own row OR rows for teams they belong to
  EXECUTE 'DROP POLICY IF EXISTS "Team members can read own membership" ON team_members';
  EXECUTE 'CREATE POLICY team_members_read_team ON team_members FOR SELECT USING (user_id = auth.uid() OR is_team_member(account_id))';

END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 4. Grant SELECT on team_members to authenticated users
-- ─────────────────────────────────────────────────────────────────────
GRANT SELECT ON team_members TO authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 5. notifications.user_id column
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id UUID;
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- ─────────────────────────────────────────────────────────────────────
-- 6. Performance indexes
-- ─────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_team_members_user_status ON team_members(user_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_to ON conversations(assigned_to);

-- Done.
