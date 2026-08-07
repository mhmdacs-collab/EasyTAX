ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS accounting_status TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT,
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(18,4),
  ADD COLUMN IF NOT EXISTS last_payment_method TEXT,
  ADD COLUMN IF NOT EXISTS beneficiary_iban TEXT;

UPDATE purchase_invoices SET
  accounting_status = COALESCE(accounting_status, CASE WHEN status = 'cancelled' THEN 'cancelled' ELSE 'recorded' END),
  payment_status = COALESCE(payment_status, 'unpaid'),
  paid_amount = COALESCE(paid_amount, 0);

ALTER TABLE purchase_invoices
  ALTER COLUMN accounting_status SET NOT NULL,
  ALTER COLUMN accounting_status SET DEFAULT 'recorded',
  ALTER COLUMN payment_status SET NOT NULL,
  ALTER COLUMN payment_status SET DEFAULT 'unpaid',
  ALTER COLUMN paid_amount SET NOT NULL,
  ALTER COLUMN paid_amount SET DEFAULT 0;

ALTER TABLE purchase_invoices DROP CONSTRAINT IF EXISTS purchase_invoices_accounting_status_check;
ALTER TABLE purchase_invoices ADD CONSTRAINT purchase_invoices_accounting_status_check
  CHECK (accounting_status IN ('recorded', 'cancelled'));

ALTER TABLE purchase_invoices DROP CONSTRAINT IF EXISTS purchase_invoices_payment_status_check;
ALTER TABLE purchase_invoices ADD CONSTRAINT purchase_invoices_payment_status_check
  CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid'));

ALTER TABLE purchase_invoices DROP CONSTRAINT IF EXISTS purchase_invoices_paid_amount_check;
ALTER TABLE purchase_invoices ADD CONSTRAINT purchase_invoices_paid_amount_check
  CHECK (paid_amount >= 0 AND paid_amount <= total);

CREATE TABLE IF NOT EXISTS purchase_invoice_payments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  purchase_invoice_id TEXT NOT NULL REFERENCES purchase_invoices(id) ON DELETE RESTRICT,
  payment_date DATE NOT NULL,
  amount NUMERIC(18,4) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'card', 'sadad')),
  beneficiary_name TEXT NOT NULL,
  beneficiary_iban TEXT,
  reference_number TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'cancelled')),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS purchase_invoice_payments_org_date_idx
  ON purchase_invoice_payments (organization_id, payment_date, created_at)
  WHERE status = 'issued';

CREATE INDEX IF NOT EXISTS purchase_invoice_payments_purchase_idx
  ON purchase_invoice_payments (purchase_invoice_id, created_at);

CREATE INDEX IF NOT EXISTS purchase_invoices_accounting_idx
  ON purchase_invoices (organization_id, invoice_date, accounting_status)
  WHERE deleted_at IS NULL;

ALTER TABLE financial_audit_events DROP CONSTRAINT IF EXISTS financial_audit_events_entity_type_check;
ALTER TABLE financial_audit_events
  ADD CONSTRAINT financial_audit_events_entity_type_check
  CHECK (entity_type IN ('document', 'receipt', 'purchase_invoice', 'purchase_payment', 'tax_return', 'financial_statement'));

ALTER TABLE financial_audit_events DROP CONSTRAINT IF EXISTS financial_audit_events_action_check;
ALTER TABLE financial_audit_events
  ADD CONSTRAINT financial_audit_events_action_check
  CHECK (action IN ('issued', 'cancelled', 'reversed', 'created', 'included', 'excluded', 'closed', 'payment_recorded', 'payment_cancelled'));
