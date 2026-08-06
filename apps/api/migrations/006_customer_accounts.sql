CREATE TABLE IF NOT EXISTS customer_receipts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  number TEXT NOT NULL,
  receipt_date DATE NOT NULL,
  amount NUMERIC(18,4) NOT NULL CHECK (amount > 0),
  payment_method_name TEXT NOT NULL,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, number)
);

CREATE INDEX IF NOT EXISTS customer_receipts_customer_date_idx
  ON customer_receipts (organization_id, customer_id, receipt_date, created_at);
