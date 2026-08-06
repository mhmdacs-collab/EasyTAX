ALTER TABLE customer_receipts
  ALTER COLUMN customer_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS payer_name TEXT,
  ADD COLUMN IF NOT EXISTS payer_phone TEXT,
  ADD COLUMN IF NOT EXISTS payer_email TEXT,
  ADD COLUMN IF NOT EXISTS payer_vat_number TEXT,
  ADD COLUMN IF NOT EXISTS organization_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS show_stamp BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS show_signature BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE customer_receipts cr
SET payer_name = c.name,
    payer_phone = c.phone,
    payer_email = c.email,
    payer_vat_number = c.vat_number
FROM customers c
WHERE cr.customer_id = c.id AND cr.payer_name IS NULL;

ALTER TABLE customer_receipts
  ALTER COLUMN payer_name SET NOT NULL;
