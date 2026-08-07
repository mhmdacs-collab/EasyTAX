CREATE TABLE IF NOT EXISTS financial_statement_periods (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL CHECK (fiscal_year BETWEEN 2020 AND 2100),
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'closed')),
  reporting_unit TEXT NOT NULL DEFAULT 'sar' CHECK (reporting_unit IN ('sar', 'thousands', 'millions')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, fiscal_year),
  CHECK (ends_on >= starts_on)
);

CREATE TABLE IF NOT EXISTS financial_statement_inputs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_id TEXT NOT NULL REFERENCES financial_statement_periods(id) ON DELETE CASCADE,
  input_key TEXT NOT NULL,
  current_amount NUMERIC(18,2),
  prior_amount NUMERIC(18,2),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (period_id, input_key)
);

CREATE INDEX IF NOT EXISTS financial_statement_inputs_org_period_idx
  ON financial_statement_inputs (organization_id, period_id);

CREATE TABLE IF NOT EXISTS financial_statement_snapshots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_id TEXT NOT NULL REFERENCES financial_statement_periods(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  report JSONB NOT NULL,
  validation JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (period_id, version)
);

CREATE INDEX IF NOT EXISTS financial_statement_snapshots_org_period_idx
  ON financial_statement_snapshots (organization_id, period_id, version DESC);

ALTER TABLE financial_audit_events DROP CONSTRAINT IF EXISTS financial_audit_events_entity_type_check;
ALTER TABLE financial_audit_events
  ADD CONSTRAINT financial_audit_events_entity_type_check
  CHECK (entity_type IN ('document', 'receipt', 'purchase_invoice', 'tax_return', 'financial_statement'));
