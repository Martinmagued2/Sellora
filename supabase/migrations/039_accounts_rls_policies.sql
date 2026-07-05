-- Migration 039: Add missing SELECT and UPDATE RLS policies for accounts table
--
-- The accounts table had RLS enabled but only INSERT and DELETE policies.
-- This caused client-side Supabase updates to silently fail because there was
-- no SELECT or UPDATE policy for authenticated users.
--
-- This is why the "Save Changes" button stopped working — RLS was blocking
-- both reading and updating the user's own account row.

-- Ensure RLS is enabled on accounts
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (safe to re-run)
DROP POLICY IF EXISTS "Users can read own account" ON accounts;
DROP POLICY IF EXISTS "Users can update own account" ON accounts;
DROP POLICY IF EXISTS "Users can insert own account" ON accounts;
DROP POLICY IF EXISTS "Users can delete own account" ON accounts;

-- Allow authenticated users to read their own account
CREATE POLICY "Users can read own account"
  ON accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow authenticated users to update their own account
CREATE POLICY "Users can update own account"
  ON accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Re-create INSERT policy (was in migration 003)
CREATE POLICY "Users can insert own account"
  ON accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Re-create DELETE policy (was in migration 036)
CREATE POLICY "Users can delete own account"
  ON accounts FOR DELETE
  TO authenticated
  USING (id = auth.uid());
