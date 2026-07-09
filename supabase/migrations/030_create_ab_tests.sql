CREATE TABLE IF NOT EXISTS ab_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed')),
  metric text DEFAULT 'conversion' CHECK (metric IN ('conversion', 'response_rate', 'order_value', 'customer_satisfaction')),
  variants jsonb NOT NULL DEFAULT '[]',
  results jsonb DEFAULT '{}',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_ab_tests_account ON ab_tests(account_id);

-- Add WhatsApp catalog ID column to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS whatsapp_catalog_id text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS whatsapp_access_token text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS whatsapp_catalog_sync_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS whatsapp_catalog_last_sync timestamptz;

-- RLS policies for ab_tests
ALTER TABLE ab_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ab_tests"
  ON ab_tests FOR SELECT
  USING (auth.uid() = account_id);

CREATE POLICY "Users can insert their own ab_tests"
  ON ab_tests FOR INSERT
  WITH CHECK (auth.uid() = account_id);

CREATE POLICY "Users can update their own ab_tests"
  ON ab_tests FOR UPDATE
  USING (auth.uid() = account_id);

CREATE POLICY "Users can delete their own ab_tests"
  ON ab_tests FOR DELETE
  USING (auth.uid() = account_id);
