-- Create a table to track actions for rate limiting purposes, specifically password resets
CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  action text not null,
  created_at timestamptz default now()
);

-- We only allow the service_role key to access this table, so no RLS policies are strictly needed.
-- But we can enable RLS and just bypass it with process.env.SUPABASE_SERVICE_ROLE_KEY
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
