-- ============================================
-- Migration 026: Webhook Deliveries Log
-- ============================================

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  webhook_id uuid REFERENCES account_webhooks(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb,
  response_status integer,
  response_body text,
  duration_ms integer,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
  attempts integer DEFAULT 1,
  next_retry_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_webhook_deliveries_account ON webhook_deliveries(account_id);
CREATE INDEX idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);

-- RLS: Users can only see their own deliveries
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own webhook deliveries"
  ON webhook_deliveries FOR SELECT
  USING (account_id = auth.uid());

CREATE POLICY "Users can update own webhook deliveries"
  ON webhook_deliveries FOR UPDATE
  USING (account_id = auth.uid());
