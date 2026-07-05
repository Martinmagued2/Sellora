-- Add free trial tracking to accounts table
ALTER TABLE accounts 
ADD COLUMN trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days');

-- Update existing accounts to have a 14-day trial starting from their creation date
UPDATE accounts 
SET trial_ends_at = created_at + INTERVAL '14 days'
WHERE trial_ends_at IS NULL;
