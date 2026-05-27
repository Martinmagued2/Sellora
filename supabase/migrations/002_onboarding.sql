-- Add onboarding flag to accounts table

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
