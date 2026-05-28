-- 008_payments_rls.sql
-- Enable Row Level Security on the payments table to secure transaction data

-- 1. Enable RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- 2. Create Policy for viewing own payments
CREATE POLICY "Users can view their own payments"
ON payments FOR SELECT
TO authenticated
USING (account_id = auth.uid());

-- Note: We are explicitly omitting INSERT, UPDATE, and DELETE policies for authenticated users.
-- All modifications to this table must be performed securely via the backend using the Service Role Key.
