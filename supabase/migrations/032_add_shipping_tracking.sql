-- Migration: 032_add_shipping_tracking.sql
-- Feature #30: AfterShip/ShipStation Integration

-- Shipping tracking table
CREATE TABLE IF NOT EXISTS shipment_trackings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  tracking_number text NOT NULL,
  carrier text,
  carrier_code text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'info_received', 'in_transit', 'out_for_delivery', 'failed_attempt', 'delivered', 'exception', 'expired')),
  title text,
  checkpoints jsonb DEFAULT '[]',
  estimated_delivery timestamptz,
  last_checked_at timestamptz,
  auto_track boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_shipment_trackings_account ON shipment_trackings(account_id);
CREATE INDEX idx_shipment_trackings_order ON shipment_trackings(order_id);

-- Add shipping config to accounts
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS aftership_api_key text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS aftership_default_carrier text DEFAULT 'aramex';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS auto_track_shipments boolean DEFAULT true;

-- RLS policies for shipment_trackings
ALTER TABLE shipment_trackings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own shipment trackings" ON shipment_trackings
  FOR SELECT USING (account_id = auth.uid());

CREATE POLICY "Users can create own shipment trackings" ON shipment_trackings
  FOR INSERT WITH CHECK (account_id = auth.uid());

CREATE POLICY "Users can update own shipment trackings" ON shipment_trackings
  FOR UPDATE USING (account_id = auth.uid());

CREATE POLICY "Users can delete own shipment trackings" ON shipment_trackings
  FOR DELETE USING (account_id = auth.uid());
