CREATE TABLE IF NOT EXISTS expense_payments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE RESTRICT,
  payment_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'card', 'sadad')),
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS expense_payments_expense_idx
  ON expense_payments (organization_id, expense_id, payment_date, created_at);

INSERT INTO expense_payments (id, organization_id, expense_id, payment_date, amount, payment_method, reference_number, notes)
SELECT 'opening-' || id, organization_id, id, expense_date, paid_amount,
  CASE payment_method
    WHEN 'bank_transfer' THEN 'bank_transfer'
    WHEN 'card' THEN 'card'
    WHEN 'sadad' THEN 'sadad'
    ELSE 'cash'
  END,
  reference_number, 'رصيد سداد سابق قبل تفعيل سجل الدفعات'
FROM expenses
WHERE deleted_at IS NULL AND paid_amount > 0
ON CONFLICT (id) DO NOTHING;
