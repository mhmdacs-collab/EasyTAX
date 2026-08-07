ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_type_check;
ALTER TABLE documents ADD CONSTRAINT documents_type_check
  CHECK (type IN ('invoice','quotation','receipt','credit_note','debit_note'));

ALTER TABLE document_sequences DROP CONSTRAINT IF EXISTS document_sequences_document_type_check;
ALTER TABLE document_sequences ADD CONSTRAINT document_sequences_document_type_check
  CHECK (document_type IN ('invoice','quotation','receipt','credit_note','debit_note'));

CREATE TABLE IF NOT EXISTS accounting_period_locks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lock_type TEXT NOT NULL CHECK (lock_type IN ('tax_return','financial_year')),
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked','unlocked')),
  source_entity_id TEXT,
  reason TEXT NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unlocked_at TIMESTAMPTZ,
  unlock_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_on >= starts_on)
);

CREATE UNIQUE INDEX IF NOT EXISTS accounting_period_locks_active_uidx
  ON accounting_period_locks (organization_id, lock_type, starts_on, ends_on)
  WHERE status='locked';
CREATE INDEX IF NOT EXISTS accounting_period_locks_date_idx
  ON accounting_period_locks (organization_id, starts_on, ends_on)
  WHERE status='locked';

CREATE TABLE IF NOT EXISTS financial_movements (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  movement_date DATE NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'opening_cash','capital_contribution','owner_withdrawal','loan_received','loan_repayment'
  )),
  amount NUMERIC(18,4) NOT NULL CHECK (amount > 0),
  loan_term TEXT CHECK (loan_term IN ('current','non_current')),
  reference_number TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded','reversed')),
  reversed_at TIMESTAMPTZ,
  reversal_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (movement_type IN ('loan_received','loan_repayment') AND loan_term IS NOT NULL)
    OR (movement_type NOT IN ('loan_received','loan_repayment') AND loan_term IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS financial_movements_org_date_idx
  ON financial_movements (organization_id, movement_date, created_at)
  WHERE status='recorded';
CREATE UNIQUE INDEX IF NOT EXISTS financial_movements_opening_cash_uidx
  ON financial_movements (organization_id, movement_type)
  WHERE status='recorded' AND movement_type='opening_cash';

ALTER TABLE financial_audit_events DROP CONSTRAINT IF EXISTS financial_audit_events_entity_type_check;
ALTER TABLE financial_audit_events
  ADD CONSTRAINT financial_audit_events_entity_type_check
  CHECK (entity_type IN (
    'document','receipt','purchase_invoice','purchase_payment','tax_return',
    'financial_statement','period_lock','financial_movement'
  ));

ALTER TABLE financial_audit_events DROP CONSTRAINT IF EXISTS financial_audit_events_action_check;
ALTER TABLE financial_audit_events
  ADD CONSTRAINT financial_audit_events_action_check
  CHECK (action IN (
    'issued','cancelled','reversed','created','included','excluded','closed',
    'payment_recorded','payment_cancelled','locked','unlocked'
  ));
