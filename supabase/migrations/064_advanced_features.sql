-- 064_advanced_features.sql
-- Adds columns for 6 new features:
-- 1. Payment OCR verification (orders)
-- 2. AI dialect shifter (accounts)
-- 3. Low stock scarcity threshold (accounts)
-- 4. Business hours + after-hours auto-pilot (accounts + team_members)
-- 5. Push notification thresholds (accounts)
-- 6. Waybill printing fields (orders)

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accounts') THEN
    -- Feature 2: AI Dialect Shifter
    EXECUTE 'ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ai_dialect TEXT DEFAULT ''auto''';
    -- Feature 3: Scarcity threshold
    EXECUTE 'ALTER TABLE accounts ADD COLUMN IF NOT EXISTS scarcity_threshold INT DEFAULT 5';
    EXECUTE 'ALTER TABLE accounts ADD COLUMN IF NOT EXISTS scarcity_enabled BOOLEAN DEFAULT true';
    -- Feature 4: Business hours + auto-pilot
    EXECUTE 'ALTER TABLE accounts ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT ''{}''::jsonb';
    EXECUTE 'ALTER TABLE accounts ADD COLUMN IF NOT EXISTS after_hours_auto_pilot BOOLEAN DEFAULT true';
    EXECUTE 'ALTER TABLE accounts ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT ''Africa/Cairo''';
    -- Feature 5: Push thresholds
    EXECUTE 'ALTER TABLE accounts ADD COLUMN IF NOT EXISTS push_thresholds JSONB DEFAULT ''{}''::jsonb';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
    -- Feature 1: Payment OCR
    EXECUTE 'ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_screenshot_url TEXT';
    EXECUTE 'ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_ocr_result JSONB DEFAULT ''{}''::jsonb';
    EXECUTE 'ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_verified_by_ocr BOOLEAN DEFAULT false';
    EXECUTE 'ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ';
    -- Feature 2: Waybill
    EXECUTE 'ALTER TABLE orders ADD COLUMN IF NOT EXISTS waybill_number TEXT';
    EXECUTE 'ALTER TABLE orders ADD COLUMN IF NOT EXISTS waybill_pdf_url TEXT';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members') THEN
    -- Feature 4: Per-member working hours
    EXECUTE 'ALTER TABLE team_members ADD COLUMN IF NOT EXISTS working_hours JSONB DEFAULT ''{}''::jsonb';
  END IF;
END $$;

-- Done.
