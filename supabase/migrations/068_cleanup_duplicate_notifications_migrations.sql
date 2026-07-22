-- 068_cleanup_duplicate_notifications_migrations.sql
-- SECURITY: Fix the open RLS policy on notifications table.
--
-- PROBLEM
-- Migrations 017a_create_notifications.sql and 20260601000000_create_notifications.sql
-- are duplicates that re-create the broken policy:
--   CREATE POLICY "Service role full access" ON public.notifications
--     FOR ALL USING (true) WITH CHECK (true);
--
-- This policy allows ANYONE (anon + authenticated) to read/write ALL notifications.
-- Migration 048_security_rls_fixes.sql fixed this, but the date-prefixed migration
-- (20260601_*) runs AFTER 048 (lexicographic order) and re-introduces the vulnerability.
--
-- FIX
-- 1. Drop the open policy
-- 2. Recreate it properly (service_role only)
-- 3. Note: the duplicate migration files (017a_*, 20260601_*) should be deleted
--    from the repo, but since they've already run on production, we need this
--    migration to fix the policy regardless.

-- Drop the open policy if it exists
DROP POLICY IF EXISTS "Service role full access" ON public.notifications;

-- Recreate with proper service_role-only access
CREATE POLICY "Service role full access" ON public.notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Also ensure users can only see their own notifications (by account_id)
-- Drop existing user policies first to avoid duplicates
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT
  TO authenticated
  USING (account_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (account_id = auth.uid())
  WITH CHECK (account_id = auth.uid());

CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE
  TO authenticated
  USING (account_id = auth.uid());
