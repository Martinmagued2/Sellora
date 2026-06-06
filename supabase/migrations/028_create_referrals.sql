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
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS referral_credits numeric(10,2) DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
