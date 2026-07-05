-- 061_customer_assignment.sql — DEFENSIVE VERSION
-- Adds customer assignment system so team members see only THEIR customers.

DO $$
BEGIN
  -- 1. customers.assigned_to + audit columns
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
    EXECUTE 'ALTER TABLE customers ADD COLUMN IF NOT EXISTS assigned_to UUID';
    EXECUTE 'ALTER TABLE customers ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ';
    EXECUTE 'ALTER TABLE customers ADD COLUMN IF NOT EXISTS assigned_by UUID';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_customers_assigned_to ON customers(assigned_to)';
  END IF;
END $$;

-- Done.
