ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS beneficiary_iban TEXT;

ALTER TABLE expense_payments
  ADD COLUMN IF NOT EXISTS beneficiary_name TEXT,
  ADD COLUMN IF NOT EXISTS beneficiary_iban TEXT;

UPDATE expense_payments AS payment SET
  beneficiary_name = COALESCE(payment.beneficiary_name, expense.supplier_name),
  beneficiary_iban = COALESCE(payment.beneficiary_iban, expense.beneficiary_iban)
FROM expenses AS expense
WHERE payment.expense_id = expense.id;
