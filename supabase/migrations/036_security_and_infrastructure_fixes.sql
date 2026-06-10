-- Migration 036: Critical security and infrastructure fixes
-- 1. Add 2FA server-side enforcement columns
-- 2. Create logos storage bucket
-- 3. Add rate_limits RLS policies
-- 4. Add accounts DELETE policy
-- 5. Add critical missing indexes
-- 6. Create increment_referral_credits RPC for atomic operations
-- 7. Move abandoned_carts table to proper migration

-- ════════════════════════════════════════════════════════════
-- 1. 2FA Server-Side Enforcement Columns
-- ════════════════════════════════════════════════════════════
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS two_factor_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_totp_time_step BIGINT;

-- ════════════════════════════════════════════════════════════
-- 2. Create Logos Storage Bucket
-- ════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  2097152, -- 2MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
) ON CONFLICT (id) DO NOTHING;

-- Logo upload policy: authenticated users can upload to their own folder
CREATE POLICY "Users can upload logos to own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND mimetype LIKE 'image/%'
  );

-- Logo read policy: anyone can read (public bucket)
CREATE POLICY "Logos are publicly readable"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'logos');

-- Logo delete policy: users can delete their own logos
CREATE POLICY "Users can delete own logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ════════════════════════════════════════════════════════════
-- 3. Rate Limits RLS Policies
-- ════════════════════════════════════════════════════════════
-- Deny all direct access from authenticated users (only service_role should access)
CREATE POLICY "Deny authenticated access to rate_limits"
  ON rate_limits FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ════════════════════════════════════════════════════════════
-- 4. Accounts DELETE Policy
-- ════════════════════════════════════════════════════════════
-- Allow users to delete their own account
CREATE POLICY "Users can delete own account"
  ON accounts FOR DELETE
  TO authenticated
  USING (id = auth.uid());

-- ════════════════════════════════════════════════════════════
-- 5. Critical Missing Indexes
-- ════════════════════════════════════════════════════════════
-- Rate limits lookup (most critical for performance)
CREATE INDEX IF NOT EXISTS idx_rate_limits_email_action_created
  ON rate_limits (email, action, created_at DESC);

-- Orders by account and date
CREATE INDEX IF NOT EXISTS idx_orders_account_created
  ON orders (account_id, created_at DESC);

-- Customers by email
CREATE INDEX IF NOT EXISTS idx_customers_email
  ON customers (email);

-- Customers by account and channel
CREATE INDEX IF NOT EXISTS idx_customers_account_channel
  ON customers (account_id, channel);

-- Messages by account and date
CREATE INDEX IF NOT EXISTS idx_messages_account_created
  ON messages (account_id, created_at DESC);

-- Campaigns by status
CREATE INDEX IF NOT EXISTS idx_campaigns_status
  ON campaigns (status);

-- Notifications by account and date
CREATE INDEX IF NOT EXISTS idx_notifications_account_created
  ON notifications (account_id, created_at DESC);

-- ════════════════════════════════════════════════════════════
-- 6. Atomic Referral Credits Increment RPC
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION increment_referral_credits(
  account_id UUID,
  amount DECIMAL(10,2)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE accounts
  SET referral_credits = COALESCE(referral_credits, 0) + amount
  WHERE id = increment_referral_credits.account_id;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- 7. Abandoned Carts Table (proper migration location)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS abandoned_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  cart_data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'abandoned' CHECK (status IN ('abandoned', 'reminded', 'recovered', 'expired')),
  abandoned_at TIMESTAMPTZ DEFAULT NOW(),
  first_reminder_at TIMESTAMPTZ,
  second_reminder_at TIMESTAMPTZ,
  recovered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE abandoned_carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own abandoned carts"
  ON abandoned_carts FOR ALL
  TO authenticated
  USING (account_id = auth.uid());

-- Index for abandoned cart lookups
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_account_status
  ON abandoned_carts (account_id, status);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_abandoned_at
  ON abandoned_carts (abandoned_at);

-- ════════════════════════════════════════════════════════════
-- 8. Missing ON DELETE CASCADE for orders.customer_id
-- ════════════════════════════════════════════════════════════
-- This requires dropping and recreating the FK constraint
-- Only apply if the current constraint doesn't have CASCADE
DO $$
BEGIN
  -- Drop the existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'orders'
      AND kcu.column_name = 'customer_id'
      AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT orders_customer_id_fkey;
  END IF;
END $$;

-- Add back with ON DELETE CASCADE
ALTER TABLE orders
  ADD CONSTRAINT orders_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

-- ════════════════════════════════════════════════════════════
-- 9. Missing updated_at triggers
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to stores table
DROP TRIGGER IF EXISTS update_stores_updated_at ON stores;
CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add trigger to shipment_trackings table
DROP TRIGGER IF EXISTS update_shipment_trackings_updated_at ON shipment_trackings;
CREATE TRIGGER update_shipment_trackings_updated_at
  BEFORE UPDATE ON shipment_trackings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add trigger to abandoned_carts table
DROP TRIGGER IF EXISTS update_abandoned_carts_updated_at ON abandoned_carts;
CREATE TRIGGER update_abandoned_carts_updated_at
  BEFORE UPDATE ON abandoned_carts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
