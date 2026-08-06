ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS internal_number TEXT,
  ADD COLUMN IF NOT EXISTS supplier_name TEXT,
  ADD COLUMN IF NOT EXISTS supplier_vat_number TEXT,
  ADD COLUMN IF NOT EXISTS invoice_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'included',
  ADD COLUMN IF NOT EXISTS exclusion_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS qr_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS duplicate_override BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS duplicate_of_id TEXT REFERENCES purchase_invoices(id) ON DELETE RESTRICT;

ALTER TABLE purchase_invoices
  ADD CONSTRAINT purchase_invoices_status_check
  CHECK (status IN ('included', 'excluded', 'cancelled'));

CREATE TABLE IF NOT EXISTS purchase_invoice_sequences (
  organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  next_number BIGINT NOT NULL DEFAULT 1 CHECK (next_number > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS purchase_invoices_internal_number_uidx
  ON purchase_invoices (organization_id, internal_number)
  WHERE internal_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS purchase_invoices_tax_return_idx
  ON purchase_invoices (organization_id, invoice_date, status)
  WHERE deleted_at IS NULL;

ALTER TABLE financial_audit_events DROP CONSTRAINT IF EXISTS financial_audit_events_entity_type_check;
ALTER TABLE financial_audit_events
  ADD CONSTRAINT financial_audit_events_entity_type_check
  CHECK (entity_type IN ('document', 'receipt', 'purchase_invoice', 'tax_return'));

ALTER TABLE financial_audit_events DROP CONSTRAINT IF EXISTS financial_audit_events_action_check;
ALTER TABLE financial_audit_events
  ADD CONSTRAINT financial_audit_events_action_check
  CHECK (action IN ('issued', 'cancelled', 'reversed', 'created', 'included', 'excluded', 'closed'));
