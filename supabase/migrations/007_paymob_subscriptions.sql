-- 1. Update accounts table for Paymob Subscription tracking
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS paymob_order_id TEXT,
ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMPTZ;

-- 2. Modify plan_status constraint to support 'expired'
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_plan_status_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_plan_status_check 
CHECK (plan_status IN ('trialing', 'active', 'past_due', 'canceled', 'expired'));

-- 3. Create payments table for B2B transactions
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  merchant_order_id TEXT UNIQUE NOT NULL, -- e.g. account_{user_id}_{timestamp}
  paymob_order_id TEXT,
  paymob_transaction_id TEXT,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'EGP',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
  payment_method TEXT,
  plan_purchased TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_account_id ON payments(account_id);
CREATE INDEX IF NOT EXISTS idx_payments_merchant_order ON payments(merchant_order_id);
