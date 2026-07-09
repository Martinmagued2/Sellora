-- 066_meta_oauth_debug_user_id.sql
-- Adds an `authenticated_user_id` column to the meta_oauth_debug table.
--
-- PROBLEM
-- The meta-callback/route.js saves diagnostics using `accountId` (parsed from
-- the OAuth `state` param). When the logged-in user is a TEAM MEMBER of the
-- Sellora account, `accountId` is the OWNER's user ID — not the team member's.
-- The /api/debug/last-meta-oauth endpoint queries by `user.id` (the logged-in
-- user), so the team member sees "No OAuth attempts found" even though the
-- OAuth flow DID save diagnostics — just under the owner's account_id.
--
-- FIX
-- Save BOTH the account_id (owner) AND the authenticated_user_id (the user
-- who actually clicked Connect). The debug endpoint queries by either column.

ALTER TABLE meta_oauth_debug
  ADD COLUMN IF NOT EXISTS authenticated_user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_meta_oauth_debug_auth_user
  ON meta_oauth_debug (authenticated_user_id, created_at DESC);

COMMENT ON COLUMN meta_oauth_debug.authenticated_user_id IS
  'The Supabase user ID of the person who actually clicked "Connect with Meta". Differs from account_id when the user is a team member of someone else''s Sellora account.';
