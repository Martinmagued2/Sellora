-- 076_invoices.sql
-- Invoice management with sequential numbering.

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'EGP',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  pdf_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_account ON invoices(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);

-- Sequence for invoice numbers (per-account, year-prefixed)
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own invoices" ON invoices
  FOR ALL TO authenticated
  USING (account_id = auth.uid())
  WITH CHECK (account_id = auth.uid());
