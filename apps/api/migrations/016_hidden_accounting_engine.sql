CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  system_key TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('asset','liability','equity','revenue','expense')),
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('debit','credit')),
  is_system BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code),
  UNIQUE (organization_id, system_key)
);

CREATE TABLE IF NOT EXISTS journal_entry_sequences (
  organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  next_number BIGINT NOT NULL DEFAULT 1 CHECK (next_number > 0)
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_number TEXT NOT NULL,
  entry_date DATE NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'document','receipt','purchase_invoice','purchase_payment','expense','expense_payment',
    'financial_movement','purchase_tax_adjustment','tax_return','financial_year','opening_balance'
  )),
  source_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','reversed')),
  reversal_of_entry_id TEXT REFERENCES journal_entries(id) ON DELETE RESTRICT,
  reversed_by_entry_id TEXT REFERENCES journal_entries(id) ON DELETE RESTRICT,
  reversal_reason TEXT,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, entry_number),
  UNIQUE (organization_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  journal_entry_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  debit NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  supplier_reference TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);

CREATE INDEX IF NOT EXISTS journal_entries_org_date_idx
  ON journal_entries (organization_id, entry_date, created_at)
  WHERE status IN ('posted','reversed');
CREATE INDEX IF NOT EXISTS journal_entries_source_idx
  ON journal_entries (organization_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS journal_lines_entry_idx ON journal_lines (journal_entry_id);
CREATE INDEX IF NOT EXISTS journal_lines_account_idx ON journal_lines (organization_id, account_id);

CREATE OR REPLACE FUNCTION prevent_posted_journal_line_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE entry_status TEXT; entry_org TEXT; account_org TEXT;
BEGIN
  SELECT status,organization_id INTO entry_status,entry_org FROM journal_entries WHERE id=COALESCE(NEW.journal_entry_id,OLD.journal_entry_id);
  IF entry_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Posted journal lines are immutable';
  END IF;
  IF TG_OP<>'DELETE' THEN
    SELECT organization_id INTO account_org FROM chart_of_accounts WHERE id=NEW.account_id;
    IF NEW.organization_id IS DISTINCT FROM entry_org OR NEW.organization_id IS DISTINCT FROM account_org THEN
      RAISE EXCEPTION 'Journal entry, line and account must belong to one organization';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS journal_lines_immutable_trigger ON journal_lines;
CREATE TRIGGER journal_lines_immutable_trigger
BEFORE INSERT OR UPDATE OR DELETE ON journal_lines
FOR EACH ROW EXECUTE FUNCTION prevent_posted_journal_line_mutation();

CREATE OR REPLACE FUNCTION validate_journal_before_posting()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE debit_total NUMERIC(18,4); credit_total NUMERIC(18,4); line_count INTEGER;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'draft' THEN RAISE EXCEPTION 'Journal entries must be created as drafts'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.status='posted' AND OLD.status='draft' THEN
    SELECT COALESCE(SUM(debit),0),COALESCE(SUM(credit),0),COUNT(*)
      INTO debit_total,credit_total,line_count FROM journal_lines WHERE journal_entry_id=NEW.id;
    IF line_count < 2 OR ABS(debit_total-credit_total) > 0.005 OR debit_total <= 0 THEN
      RAISE EXCEPTION 'Journal entry must contain balanced debit and credit lines';
    END IF;
    NEW.posted_at=COALESCE(NEW.posted_at,NOW());
  ELSIF OLD.status IN ('posted','reversed') AND NOT (
    OLD.status='posted' AND NEW.status='reversed' AND
    NEW.reversed_by_entry_id IS NOT NULL AND NEW.reversal_reason IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Posted journal entries are immutable';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS journal_entries_posting_trigger ON journal_entries;
CREATE TRIGGER journal_entries_posting_trigger
BEFORE INSERT OR UPDATE ON journal_entries
FOR EACH ROW EXECUTE FUNCTION validate_journal_before_posting();

INSERT INTO chart_of_accounts(organization_id,code,system_key,name_ar,account_type,normal_balance)
SELECT o.id,a.code,a.system_key,a.name_ar,a.account_type,a.normal_balance
FROM organizations o CROSS JOIN (VALUES
  ('1000','cash_and_bank','النقد وما في حكمه','asset','debit'),
  ('1100','accounts_receivable','الذمم المدينة التجارية','asset','debit'),
  ('1110','retention_receivable','ذمم حجز ضمان الأعمال','asset','debit'),
  ('1150','vat_receivable','ضريبة القيمة المضافة المدخلة','asset','debit'),
  ('1160','vat_refund_receivable','ضريبة مستردة من الهيئة','asset','debit'),
  ('1200','prepayments','مصروفات مدفوعة مقدمًا','asset','debit'),
  ('1300','fixed_assets','الممتلكات والآلات والمعدات','asset','debit'),
  ('1390','accumulated_depreciation','مجمع الإهلاك','asset','credit'),
  ('2000','accounts_payable','الذمم الدائنة التجارية','liability','credit'),
  ('2100','vat_payable','ضريبة القيمة المضافة المخرجة','liability','credit'),
  ('2110','vat_settlement_payable','ضريبة مستحقة للهيئة','liability','credit'),
  ('2120','zakat_payable','الزكاة مستحقة الدفع','liability','credit'),
  ('2130','income_tax_payable','ضريبة الدخل مستحقة الدفع','liability','credit'),
  ('2200','customer_advances','دفعات العملاء المقدمة','liability','credit'),
  ('2300','current_loans','قروض قصيرة الأجل','liability','credit'),
  ('2400','non_current_loans','قروض طويلة الأجل','liability','credit'),
  ('3000','capital','رأس المال','equity','credit'),
  ('3100','owner_drawings','مسحوبات المالك','equity','debit'),
  ('3200','retained_earnings','الأرباح المبقاة','equity','credit'),
  ('3900','opening_balance_equity','حساب موازنة الأرصدة الافتتاحية','equity','credit'),
  ('4000','sales_revenue','إيرادات المبيعات والخدمات','revenue','credit'),
  ('5000','direct_cost','تكلفة الأعمال','expense','debit'),
  ('5100','employee_expense','رواتب ومنافع الموظفين','expense','debit'),
  ('5200','operating_expense','مصاريف تشغيلية وعمومية','expense','debit'),
  ('5300','other_expense','مصاريف أخرى','expense','debit'),
  ('5400','depreciation_expense','مصروف الإهلاك','expense','debit'),
  ('5500','zakat_expense','مصروف الزكاة','expense','debit'),
  ('5600','income_tax_expense','مصروف ضريبة الدخل','expense','debit')
) AS a(code,system_key,name_ar,account_type,normal_balance)
ON CONFLICT (organization_id,system_key) DO NOTHING;

INSERT INTO journal_entry_sequences(organization_id,next_number)
SELECT id,1 FROM organizations ON CONFLICT (organization_id) DO NOTHING;

-- Existing production records are posted with deterministic keys. Running this
-- migration again is safe because every source event has a unique idempotency key.
INSERT INTO journal_entries(id,organization_id,entry_number,entry_date,source_type,source_id,idempotency_key,description,status)
SELECT 'bf-doc-'||d.id,d.organization_id,'BF-DOC-'||d.id,d.issue_date,'document',d.id,'document:'||d.id||':issued',
  CASE d.type WHEN 'credit_note' THEN 'إشعار دائن مرحّل' WHEN 'debit_note' THEN 'إشعار مدين مرحّل' ELSE 'فاتورة مبيعات مرحّلة' END,'draft'
FROM documents d
WHERE d.type IN ('invoice','credit_note','debit_note') AND d.status IN ('issued','paid','partially_paid') AND d.deleted_at IS NULL
ON CONFLICT (organization_id,idempotency_key) DO NOTHING;

INSERT INTO journal_lines(organization_id,journal_entry_id,account_id,debit,credit,customer_id,memo)
SELECT d.organization_id,'bf-doc-'||d.id,a.id,x.debit,x.credit,d.customer_id,x.memo
FROM documents d
CROSS JOIN LATERAL (VALUES
  ('accounts_receivable',CASE WHEN d.type IN ('invoice','debit_note') THEN GREATEST(d.total-d.retention_total,0) WHEN d.type='credit_note' THEN 0 ELSE 0 END,CASE WHEN d.type='credit_note' THEN d.total ELSE 0 END,'ذمم العميل'),
  ('retention_receivable',CASE WHEN d.type='invoice' THEN d.retention_total ELSE 0 END,0::numeric,'حجز ضمان الأعمال'),
  ('sales_revenue',CASE WHEN d.type='credit_note' THEN d.total-d.tax_total ELSE 0 END,CASE WHEN d.type IN ('invoice','debit_note') THEN d.total-d.tax_total ELSE 0 END,'صافي الإيراد'),
  ('vat_payable',CASE WHEN d.type='credit_note' THEN d.tax_total ELSE 0 END,CASE WHEN d.type IN ('invoice','debit_note') THEN d.tax_total ELSE 0 END,'ضريبة المخرجات')
) x(system_key,debit,credit,memo)
JOIN chart_of_accounts a ON a.organization_id=d.organization_id AND a.system_key=x.system_key
JOIN journal_entries je ON je.id='bf-doc-'||d.id AND je.status='draft'
WHERE (x.debit>0 OR x.credit>0);

INSERT INTO journal_entries(id,organization_id,entry_number,entry_date,source_type,source_id,idempotency_key,description,status)
SELECT 'bf-rec-'||r.id,r.organization_id,'BF-REC-'||r.id,r.receipt_date,'receipt',r.id,'receipt:'||r.id||':issued','سند قبض مرحّل','draft'
FROM customer_receipts r WHERE r.status='issued'
ON CONFLICT (organization_id,idempotency_key) DO NOTHING;

INSERT INTO journal_lines(organization_id,journal_entry_id,account_id,debit,credit,customer_id,memo)
SELECT r.organization_id,'bf-rec-'||r.id,a.id,x.debit,x.credit,r.customer_id,x.memo
FROM customer_receipts r
CROSS JOIN LATERAL (VALUES
  ('cash_and_bank',r.amount,0::numeric,'تحصيل نقدي'),
  (CASE WHEN r.source_document_id IS NULL THEN 'customer_advances' ELSE 'accounts_receivable' END,0::numeric,r.amount,'تسوية حساب العميل')
) x(system_key,debit,credit,memo)
JOIN chart_of_accounts a ON a.organization_id=r.organization_id AND a.system_key=x.system_key
JOIN journal_entries je ON je.id='bf-rec-'||r.id AND je.status='draft'
WHERE r.status='issued';

INSERT INTO journal_entries(id,organization_id,entry_number,entry_date,source_type,source_id,idempotency_key,description,status)
SELECT 'bf-pur-'||p.id,p.organization_id,'BF-PUR-'||p.id,p.invoice_date,'purchase_invoice',p.id,'purchase_invoice:'||p.id||':recorded','فاتورة مشتريات مرحّلة','draft'
FROM purchase_invoices p WHERE p.accounting_status='recorded' AND p.deleted_at IS NULL
ON CONFLICT (organization_id,idempotency_key) DO NOTHING;

INSERT INTO journal_lines(organization_id,journal_entry_id,account_id,debit,credit,supplier_reference,memo)
SELECT p.organization_id,'bf-pur-'||p.id,a.id,x.debit,x.credit,p.supplier_vat_number,x.memo
FROM purchase_invoices p
CROSS JOIN LATERAL (VALUES
  ('direct_cost',p.subtotal,0::numeric,'تكلفة المشتريات'),
  ('vat_receivable',p.tax_total,0::numeric,'ضريبة المدخلات'),
  ('accounts_payable',0::numeric,p.total,'ذمة المورد')
) x(system_key,debit,credit,memo)
JOIN chart_of_accounts a ON a.organization_id=p.organization_id AND a.system_key=x.system_key
JOIN journal_entries je ON je.id='bf-pur-'||p.id AND je.status='draft'
WHERE p.accounting_status='recorded' AND p.deleted_at IS NULL AND (x.debit>0 OR x.credit>0);

INSERT INTO journal_entries(id,organization_id,entry_number,entry_date,source_type,source_id,idempotency_key,description,status)
SELECT 'bf-pp-'||p.id,p.organization_id,'BF-PP-'||p.id,p.payment_date,'purchase_payment',p.id,'purchase_payment:'||p.id||':issued','دفعة مورد مرحّلة','draft'
FROM purchase_invoice_payments p WHERE p.status='issued'
ON CONFLICT (organization_id,idempotency_key) DO NOTHING;

INSERT INTO journal_lines(organization_id,journal_entry_id,account_id,debit,credit,supplier_reference,memo)
SELECT p.organization_id,'bf-pp-'||p.id,a.id,x.debit,x.credit,pi.supplier_vat_number,x.memo
FROM purchase_invoice_payments p JOIN purchase_invoices pi ON pi.id=p.purchase_invoice_id
CROSS JOIN LATERAL (VALUES
  ('accounts_payable',p.amount,0::numeric,'سداد ذمة المورد'),('cash_and_bank',0::numeric,p.amount,'دفع نقدي')
) x(system_key,debit,credit,memo)
JOIN chart_of_accounts a ON a.organization_id=p.organization_id AND a.system_key=x.system_key
JOIN journal_entries je ON je.id='bf-pp-'||p.id AND je.status='draft'
WHERE p.status='issued';

INSERT INTO journal_entries(id,organization_id,entry_number,entry_date,source_type,source_id,idempotency_key,description,status)
SELECT 'bf-pta-'||p.id,p.organization_id,'BF-PTA-'||p.id,p.invoice_date,'purchase_tax_adjustment',p.id,'purchase_invoice:'||p.id||':tax_excluded','استبعاد ضريبة مشتريات مرحّل','draft'
FROM purchase_invoices p WHERE p.accounting_status='recorded' AND p.deleted_at IS NULL AND p.include_in_tax_return=FALSE AND p.tax_total>0
ON CONFLICT (organization_id,idempotency_key) DO NOTHING;

INSERT INTO journal_lines(organization_id,journal_entry_id,account_id,debit,credit,supplier_reference,memo)
SELECT p.organization_id,'bf-pta-'||p.id,a.id,x.debit,x.credit,p.supplier_vat_number,x.memo
FROM purchase_invoices p
CROSS JOIN LATERAL (VALUES
  ('direct_cost',p.tax_total,0::numeric,'إضافة الضريبة غير المطالب بها إلى التكلفة'),
  ('vat_receivable',0::numeric,p.tax_total,'استبعاد ضريبة المدخلات')
) x(system_key,debit,credit,memo)
JOIN chart_of_accounts a ON a.organization_id=p.organization_id AND a.system_key=x.system_key
JOIN journal_entries je ON je.id='bf-pta-'||p.id AND je.status='draft'
WHERE p.accounting_status='recorded' AND p.deleted_at IS NULL AND p.include_in_tax_return=FALSE AND p.tax_total>0;

INSERT INTO journal_entries(id,organization_id,entry_number,entry_date,source_type,source_id,idempotency_key,description,status)
SELECT 'bf-exp-'||e.id,e.organization_id,'BF-EXP-'||e.id,e.expense_date,'expense',e.id,'expense:'||e.id||':recorded','مصروف مرحّل','draft'
FROM expenses e WHERE e.deleted_at IS NULL AND e.source_type='manual'
ON CONFLICT (organization_id,idempotency_key) DO NOTHING;

INSERT INTO journal_lines(organization_id,journal_entry_id,account_id,debit,credit,supplier_reference,memo)
SELECT e.organization_id,'bf-exp-'||e.id,a.id,x.debit,x.credit,NULL,x.memo
FROM expenses e
CROSS JOIN LATERAL (VALUES
  (CASE e.financial_class WHEN 'direct_cost' THEN 'direct_cost' WHEN 'employee_expense' THEN 'employee_expense'
    WHEN 'fixed_asset' THEN 'fixed_assets' WHEN 'prepayment' THEN 'prepayments' WHEN 'other_expense' THEN 'other_expense'
    ELSE 'operating_expense' END,e.amount,0::numeric,'إثبات المصروف'),
  ('accounts_payable',0::numeric,e.amount,'إثبات المستحق')
) x(system_key,debit,credit,memo)
JOIN chart_of_accounts a ON a.organization_id=e.organization_id AND a.system_key=x.system_key
JOIN journal_entries je ON je.id='bf-exp-'||e.id AND je.status='draft'
WHERE e.deleted_at IS NULL AND e.source_type='manual';

INSERT INTO journal_entries(id,organization_id,entry_number,entry_date,source_type,source_id,idempotency_key,description,status)
SELECT 'bf-ep-'||p.id,p.organization_id,'BF-EP-'||p.id,p.payment_date,'expense_payment',p.id,'expense_payment:'||p.id||':recorded','دفعة مصروف مرحّلة','draft'
FROM expense_payments p
ON CONFLICT (organization_id,idempotency_key) DO NOTHING;

INSERT INTO journal_lines(organization_id,journal_entry_id,account_id,debit,credit,memo)
SELECT p.organization_id,'bf-ep-'||p.id,a.id,x.debit,x.credit,x.memo
FROM expense_payments p
CROSS JOIN LATERAL (VALUES
  ('accounts_payable',p.amount,0::numeric,'سداد مصروف'),('cash_and_bank',0::numeric,p.amount,'دفع نقدي')
) x(system_key,debit,credit,memo)
JOIN chart_of_accounts a ON a.organization_id=p.organization_id AND a.system_key=x.system_key
JOIN journal_entries je ON je.id='bf-ep-'||p.id AND je.status='draft';

INSERT INTO journal_entries(id,organization_id,entry_number,entry_date,source_type,source_id,idempotency_key,description,status)
SELECT 'bf-fm-'||m.id,m.organization_id,'BF-FM-'||m.id,m.movement_date,'financial_movement',m.id,'financial_movement:'||m.id||':recorded','حركة مالية مرحّلة','draft'
FROM financial_movements m WHERE m.status='recorded'
ON CONFLICT (organization_id,idempotency_key) DO NOTHING;

INSERT INTO journal_lines(organization_id,journal_entry_id,account_id,debit,credit,memo)
SELECT m.organization_id,'bf-fm-'||m.id,a.id,x.debit,x.credit,x.memo
FROM financial_movements m
CROSS JOIN LATERAL (VALUES
  (CASE WHEN m.movement_type IN ('opening_cash','capital_contribution','loan_received') THEN 'cash_and_bank'
        WHEN m.movement_type='owner_withdrawal' THEN 'owner_drawings'
        WHEN m.movement_type='loan_repayment' AND m.loan_term='current' THEN 'current_loans'
        WHEN m.movement_type='loan_repayment' THEN 'non_current_loans' END,m.amount,0::numeric,'الطرف المدين'),
  (CASE WHEN m.movement_type='opening_cash' THEN 'opening_balance_equity'
        WHEN m.movement_type='capital_contribution' THEN 'capital'
        WHEN m.movement_type='loan_received' AND m.loan_term='current' THEN 'current_loans'
        WHEN m.movement_type='loan_received' THEN 'non_current_loans'
        WHEN m.movement_type IN ('owner_withdrawal','loan_repayment') THEN 'cash_and_bank' END,0::numeric,m.amount,'الطرف الدائن')
) x(system_key,debit,credit,memo)
JOIN chart_of_accounts a ON a.organization_id=m.organization_id AND a.system_key=x.system_key
JOIN journal_entries je ON je.id='bf-fm-'||m.id AND je.status='draft'
WHERE m.status='recorded' AND x.system_key IS NOT NULL;

INSERT INTO journal_entries(id,organization_id,entry_number,entry_date,source_type,source_id,idempotency_key,description,status)
SELECT 'bf-tax-'||tr.id,tr.organization_id,'BF-TAX-'||tr.id,tp.ends_on,'tax_return',tr.id,'tax_return:'||tr.id||':filed:backfill','إقفال ضريبة قيمة مضافة مرحّل','draft'
FROM tax_returns tr JOIN tax_periods tp ON tp.id=tr.tax_period_id
WHERE tr.status='filed' AND (tr.sales_tax>0 OR tr.purchase_tax>0)
ON CONFLICT (organization_id,idempotency_key) DO NOTHING;

INSERT INTO journal_lines(organization_id,journal_entry_id,account_id,debit,credit,memo)
SELECT tr.organization_id,'bf-tax-'||tr.id,a.id,x.debit,x.credit,x.memo
FROM tax_returns tr JOIN tax_periods tp ON tp.id=tr.tax_period_id
CROSS JOIN LATERAL (VALUES
  ('vat_payable',tr.sales_tax,0::numeric,'إقفال ضريبة المخرجات'),
  ('vat_receivable',0::numeric,tr.purchase_tax,'إقفال ضريبة المدخلات'),
  ('vat_settlement_payable',0::numeric,GREATEST(tr.net_tax,0),'المستحق للهيئة'),
  ('vat_refund_receivable',GREATEST(-tr.net_tax,0),0::numeric,'الرصيد المسترد من الهيئة')
) x(system_key,debit,credit,memo)
JOIN chart_of_accounts a ON a.organization_id=tr.organization_id AND a.system_key=x.system_key
JOIN journal_entries je ON je.id='bf-tax-'||tr.id AND je.status='draft'
WHERE tr.status='filed' AND (x.debit>0 OR x.credit>0);

UPDATE journal_entries SET status='posted',posted_at=NOW(),updated_at=NOW()
WHERE status='draft' AND entry_number LIKE 'BF-%';

UPDATE journal_entry_sequences s SET next_number=(
  SELECT COUNT(*)+1 FROM journal_entries je WHERE je.organization_id=s.organization_id
);

ALTER TABLE financial_audit_events DROP CONSTRAINT IF EXISTS financial_audit_events_entity_type_check;
ALTER TABLE financial_audit_events ADD CONSTRAINT financial_audit_events_entity_type_check
  CHECK (entity_type IN (
    'document','receipt','purchase_invoice','purchase_payment','tax_return','financial_statement',
    'period_lock','financial_movement','journal_entry'
  ));

ALTER TABLE financial_audit_events DROP CONSTRAINT IF EXISTS financial_audit_events_action_check;
ALTER TABLE financial_audit_events ADD CONSTRAINT financial_audit_events_action_check
  CHECK (action IN (
    'issued','cancelled','reversed','created','included','excluded','closed',
    'payment_recorded','payment_cancelled','locked','unlocked','posted'
  ));
