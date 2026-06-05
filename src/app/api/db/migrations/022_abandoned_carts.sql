-- Migration 022: Abandoned Cart Recovery
-- Creates the abandoned_carts table and adds related config columns to accounts

CREATE TABLE IF NOT EXISTS abandoned_carts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  conversation_id UUID REFERENCES conversations(id),
  channel TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  cart_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'abandoned' CHECK (status IN ('abandoned', 'reminded', 'recovered', 'expired')),
  abandoned_at TIMESTAMPTZ DEFAULT NOW(),
  first_reminder_at TIMESTAMPTZ,
  second_reminder_at TIMESTAMPTZ,
  recovered_at TIMESTAMPTZ,
  recovery_order_id UUID REFERENCES orders(id),
  coupon_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_abandoned_carts_account ON abandoned_carts(account_id);
CREATE INDEX idx_abandoned_carts_status ON abandoned_carts(status);

-- RLS
ALTER TABLE abandoned_carts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own abandoned_carts" ON abandoned_carts;
CREATE POLICY "Users can manage own abandoned_carts" ON abandoned_carts FOR ALL USING (account_id = auth.uid());

-- Add abandoned cart config columns to accounts
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS abandoned_cart_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS abandoned_cart_hours INTEGER DEFAULT 2;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS abandoned_cart_auto_reminder BOOLEAN DEFAULT FALSE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS abandoned_cart_reminder_hours INTEGER DEFAULT 1;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS abandoned_cart_auto_second_reminder BOOLEAN DEFAULT FALSE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS abandoned_cart_second_reminder_hours INTEGER DEFAULT 24;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS abandoned_cart_discount_percent INTEGER DEFAULT 10;
