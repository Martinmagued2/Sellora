-- 067_drop_exec_sql.sql
-- SECURITY: Drop the exec_sql RPC function if it exists.
--
-- PROBLEM
-- The exec_sql function accepts a SQL string and executes it with service_role
-- privileges. If exposed via Supabase's anon/authenticated API (the default for
-- functions in the public schema), anyone with the anon key (which is public
-- in the frontend bundle) can execute arbitrary SQL — including DROP TABLE,
-- UPDATE accounts SET plan='business', or reading every user's tokens.
--
-- Even if not exposed, 7 API routes call this function with user-controllable
-- SQL strings, which is a privilege-escalation risk if the function is ever
-- re-enabled or if a future migration re-creates it.
--
-- FIX
-- Drop the function entirely. All schema changes should happen via versioned
-- migrations (like this one), not via runtime SQL execution.
--
-- The runtime "auto-migrate on first call" code in /api/db/migrate/route.js,
-- /api/admin/migrate/route.js, /api/auth/2fa/setup/route.js,
-- /api/storage/ensure-buckets/route.js, /api/segments/route.js, and
-- /api/integrations/shopify/fix-schema/route.js will fail gracefully
-- (they all have try/catch fallbacks) — the migrations they were trying
-- to run have already been applied via migration files.

DROP FUNCTION IF EXISTS public.exec_sql(text) CASCADE;
DROP FUNCTION IF EXISTS public.exec_sql(sql text) CASCADE;
DROP FUNCTION IF EXISTS public.exec_sql(query text) CASCADE;
DROP FUNCTION IF EXISTS public.exec_sql(sql_text text) CASCADE;

-- Also drop any variants with different parameter names
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT proname, oid
    FROM pg_proc
    WHERE proname = 'exec_sql'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE;', r.oid::regprocedure);
  END LOOP;
END
$$;

COMMENT ON SCHEMA public IS 'exec_sql RPC function has been removed for security. All schema changes must go through versioned migrations.';
