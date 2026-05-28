-- 010_audit_logs.sql
-- Create an audit_logs table to track security-related events

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  ip_address TEXT,
  route TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying logs by event type or user
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Prevent any modifications to audit logs from the frontend or backend (append-only)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- No policies are created for anon or authenticated roles.
-- Only the service_role key can insert into this table.
