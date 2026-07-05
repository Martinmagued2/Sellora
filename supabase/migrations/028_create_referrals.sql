-- ============================================================
-- Migration 028: Referrals System
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Create referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  referral_code text UNIQUE NOT NULL,
  referred_email text,
  referred_id uuid REFERENCES accounts(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'signed_up', 'converted', 'paid')),
  commission_earned numeric(10,2) DEFAULT 0,
  commission_paid numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 2. Add referral columns to accounts
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS referral_credits numeric(10,2) DEFAULT 0;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_email ON referrals(referred_email);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);

-- 4. Enable RLS
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Users can read their own referrals (as referrer)
CREATE POLICY "Users can read own referrals"
  ON referrals FOR SELECT
  USING (referrer_id = auth.uid());

-- Users can read referrals where they are the referred user
CREATE POLICY "Users can read referrals about them"
  ON referrals FOR SELECT
  USING (referred_id = auth.uid());

-- Service role can do everything (for API routes)
CREATE POLICY "Service role full access"
  ON referrals FOR ALL
  USING (auth.role() = 'service_role');

-- Allow insert for authenticated users (API creates on their behalf)
CREATE POLICY "Authenticated users can insert referrals"
  ON referrals FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Only referrer can update their own referrals
CREATE POLICY "Referrer can update own referrals"
  ON referrals FOR UPDATE
  USING (referrer_id = auth.uid());

-- 6. Create the increment_referral_credits RPC function
CREATE OR REPLACE FUNCTION increment_referral_credits(
  p_account_id uuid,
  p_amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE accounts
  SET referral_credits = COALESCE(referral_credits, 0) + p_amount
  WHERE id = p_account_id;
END;
$$;

-- 7. Create a function to prevent self-referrals
CREATE OR REPLACE FUNCTION check_self_referral()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- If referred_id is set, it must not equal referrer_id
  IF NEW.referred_id IS NOT NULL AND NEW.referred_id = NEW.referrer_id THEN
    RAISE EXCEPTION 'Self-referral is not allowed';
  END IF;
  RETURN NEW;
END;
$$;

-- 8. Attach the trigger
DROP TRIGGER IF EXISTS prevent_self_referral ON referrals;
CREATE TRIGGER prevent_self_referral
  BEFORE INSERT ON referrals
  FOR EACH ROW
  EXECUTE FUNCTION check_self_referral();

-- 9. Create referral_payouts table for tracking payout requests
CREATE TABLE IF NOT EXISTS referral_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  amount numeric(10,2) NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'completed', 'rejected')),
  requested_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  notes text
);

ALTER TABLE referral_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own payouts"
  ON referral_payouts FOR SELECT
  USING (account_id = auth.uid());

CREATE POLICY "Users can insert own payouts"
  ON referral_payouts FOR INSERT
  WITH CHECK (account_id = auth.uid());

CREATE POLICY "Service role full access on payouts"
  ON referral_payouts FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_payouts_account ON referral_payouts(account_id);
