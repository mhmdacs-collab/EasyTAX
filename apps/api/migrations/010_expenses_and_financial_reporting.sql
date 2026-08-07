ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS financial_reporting_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS legal_form TEXT NOT NULL DEFAULT 'sole_establishment',
  ADD COLUMN IF NOT EXISTS fiscal_year_start_month SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_legal_form_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_legal_form_check
  CHECK (legal_form IN ('sole_establishment', 'limited_liability', 'simplified_joint_stock', 'joint_stock', 'partnership', 'limited_partnership'));

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_fiscal_year_start_month_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_fiscal_year_start_month_check
  CHECK (fiscal_year_start_month BETWEEN 1 AND 12);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL,
  category TEXT NOT NULL,
  financial_class TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_status TEXT NOT NULL DEFAULT 'paid',
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  payment_method TEXT,
  supplier_name TEXT,
  reference_number TEXT,
  project_reference TEXT,
  notes TEXT,
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_purchase_invoice_id TEXT REFERENCES purchase_invoices(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT expenses_category_check CHECK (category IN (
    'work_costs', 'payroll', 'rent_utilities', 'vehicles_transport',
    'admin_marketing_professional', 'asset_equipment', 'other'
  )),
  CONSTRAINT expenses_financial_class_check CHECK (financial_class IN (
    'direct_cost', 'operating_expense', 'employee_expense', 'fixed_asset', 'prepayment', 'other_expense'
  )),
  CONSTRAINT expenses_payment_status_check CHECK (payment_status IN ('paid', 'unpaid', 'partially_paid')),
  CONSTRAINT expenses_source_type_check CHECK (source_type IN ('manual', 'tax_purchase')),
  CONSTRAINT expenses_paid_amount_check CHECK (paid_amount <= amount)
);

CREATE UNIQUE INDEX IF NOT EXISTS expenses_purchase_source_uidx
  ON expenses (organization_id, source_purchase_invoice_id)
  WHERE source_purchase_invoice_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS expenses_reporting_idx
  ON expenses (organization_id, expense_date, category)
  WHERE deleted_at IS NULL;
