import { randomUUID } from "node:crypto"
import type { PoolClient } from "pg"
import type { AccountKey, JournalRuleLine } from "./accountingRules"
import { compactBalancedLines, yearEndAdjustmentJournal } from "./accountingRules"

type SourceType="document"|"receipt"|"purchase_invoice"|"purchase_payment"|"expense"|"expense_payment"|"financial_movement"|"purchase_tax_adjustment"|"tax_return"|"financial_year"|"opening_balance"

export type PostJournalInput={
  organizationId:string
  entryDate:string
  sourceType:SourceType
  sourceId:string
  idempotencyKey:string
  description:string
  lines:JournalRuleLine[]
  customerId?:string|null
  supplierReference?:string|null
  reversalOfEntryId?:string|null
}

const accounts:Array<[string,AccountKey,string,string,string]>=[
  ["1000","cash_and_bank","النقد وما في حكمه","asset","debit"],
  ["1100","accounts_receivable","الذمم المدينة التجارية","asset","debit"],
  ["1110","retention_receivable","ذمم حجز ضمان الأعمال","asset","debit"],
  ["1150","vat_receivable","ضريبة القيمة المضافة المدخلة","asset","debit"],
  ["1160","vat_refund_receivable","ضريبة مستردة من الهيئة","asset","debit"],
  ["1200","prepayments","مصروفات مدفوعة مقدمًا","asset","debit"],
  ["1300","fixed_assets","الممتلكات والآلات والمعدات","asset","debit"],
  ["1390","accumulated_depreciation","مجمع الإهلاك","asset","credit"],
  ["2000","accounts_payable","الذمم الدائنة التجارية","liability","credit"],
  ["2100","vat_payable","ضريبة القيمة المضافة المخرجة","liability","credit"],
  ["2110","vat_settlement_payable","ضريبة مستحقة للهيئة","liability","credit"],
  ["2120","zakat_payable","الزكاة مستحقة الدفع","liability","credit"],
  ["2130","income_tax_payable","ضريبة الدخل مستحقة الدفع","liability","credit"],
  ["2200","customer_advances","دفعات العملاء المقدمة","liability","credit"],
  ["2300","current_loans","قروض قصيرة الأجل","liability","credit"],
  ["2400","non_current_loans","قروض طويلة الأجل","liability","credit"],
  ["3000","capital","رأس المال","equity","credit"],
  ["3100","owner_drawings","مسحوبات المالك","equity","debit"],
  ["3200","retained_earnings","الأرباح المبقاة","equity","credit"],
  ["3900","opening_balance_equity","حساب موازنة الأرصدة الافتتاحية","equity","credit"],
  ["4000","sales_revenue","إيرادات المبيعات والخدمات","revenue","credit"],
  ["5000","direct_cost","تكلفة الأعمال","expense","debit"],
  ["5100","employee_expense","رواتب ومنافع الموظفين","expense","debit"],
  ["5200","operating_expense","مصاريف تشغيلية وعمومية","expense","debit"],
  ["5300","other_expense","مصاريف أخرى","expense","debit"],
  ["5400","depreciation_expense","مصروف الإهلاك","expense","debit"],
  ["5500","zakat_expense","مصروف الزكاة","expense","debit"],
  ["5600","income_tax_expense","مصروف ضريبة الدخل","expense","debit"],
]

export async function ensureSystemAccounts(client:PoolClient,organizationId:string){
  const count=await client.query("SELECT COUNT(*) count FROM chart_of_accounts WHERE organization_id=$1 AND is_system=TRUE",[organizationId])
  if(Number(count.rows[0].count)<accounts.length)for(const [code,key,name,type,normal] of accounts) await client.query(`INSERT INTO chart_of_accounts(
      organization_id,code,system_key,name_ar,account_type,normal_balance
    ) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(organization_id,system_key) DO NOTHING`,[organizationId,code,key,name,type,normal])
  await client.query("INSERT INTO journal_entry_sequences(organization_id,next_number) VALUES($1,1) ON CONFLICT(organization_id) DO NOTHING",[organizationId])
}

export async function postJournalEntry(client:PoolClient,input:PostJournalInput){
  const existing=await client.query("SELECT * FROM journal_entries WHERE organization_id=$1 AND idempotency_key=$2 LIMIT 1",[input.organizationId,input.idempotencyKey])
  if(existing.rows[0]&&existing.rows[0].status!=="reversed")return existing.rows[0]
  let idempotencyKey=input.idempotencyKey
  if(existing.rows[0]){
    const reposts=await client.query("SELECT COUNT(*) count FROM journal_entries WHERE organization_id=$1 AND idempotency_key LIKE $2",[input.organizationId,`${input.idempotencyKey}:repost:%`])
    idempotencyKey=`${input.idempotencyKey}:repost:${Number(reposts.rows[0].count)+1}`
  }
  const lines=compactBalancedLines(input.lines)
  await ensureSystemAccounts(client,input.organizationId)
  const sequence=await client.query("SELECT next_number FROM journal_entry_sequences WHERE organization_id=$1 FOR UPDATE",[input.organizationId])
  const candidate=Number(sequence.rows[0].next_number)
  const number=`JE-${String(candidate).padStart(7,"0")}`
  await client.query("UPDATE journal_entry_sequences SET next_number=$1 WHERE organization_id=$2",[candidate+1,input.organizationId])
  const id=randomUUID()
  await client.query(`INSERT INTO journal_entries(
    id,organization_id,entry_number,entry_date,source_type,source_id,idempotency_key,description,status,reversal_of_entry_id
  ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9)`,[
    id,input.organizationId,number,input.entryDate,input.sourceType,input.sourceId,idempotencyKey,input.description,input.reversalOfEntryId??null,
  ])
  const accountRows=await client.query("SELECT id,system_key FROM chart_of_accounts WHERE organization_id=$1 AND system_key=ANY($2::text[])",[input.organizationId,lines.map(line=>line.accountKey)])
  const accountIds=new Map(accountRows.rows.map(row=>[String(row.system_key),String(row.id)]))
  for(const line of lines){
    const accountId=accountIds.get(line.accountKey)
    if(!accountId)throw new Error(`Missing system account: ${line.accountKey}`)
    await client.query(`INSERT INTO journal_lines(
      organization_id,journal_entry_id,account_id,debit,credit,customer_id,supplier_reference,memo
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[
      input.organizationId,id,accountId,line.debit??0,line.credit??0,input.customerId??null,input.supplierReference??null,line.memo??null,
    ])
  }
  const posted=await client.query("UPDATE journal_entries SET status='posted',posted_at=NOW(),updated_at=NOW() WHERE id=$1 RETURNING *",[id])
  await client.query("INSERT INTO financial_audit_events(organization_id,entity_type,entity_id,action,snapshot) VALUES($1,'journal_entry',$2,'posted',$3)",[input.organizationId,id,JSON.stringify({entry_number:number,entry_date:input.entryDate,source_type:input.sourceType,source_id:input.sourceId,idempotency_key:idempotencyKey})])
  return posted.rows[0]
}

export async function reverseSourceJournalEntries(client:PoolClient,input:{organizationId:string;sourceType:SourceType;sourceId:string;reversalDate:string;reason:string}){
  const originals=await client.query(`SELECT * FROM journal_entries WHERE organization_id=$1 AND source_type=$2 AND source_id=$3
    AND status='posted' AND reversal_of_entry_id IS NULL ORDER BY created_at FOR UPDATE`,[input.organizationId,input.sourceType,input.sourceId])
  const reversals=[]
  for(const original of originals.rows){
    const rows=await client.query(`SELECT coa.system_key,jl.debit,jl.credit,jl.memo FROM journal_lines jl
      JOIN chart_of_accounts coa ON coa.id=jl.account_id WHERE jl.journal_entry_id=$1 ORDER BY jl.created_at,jl.id`,[original.id])
    const reversal=await postJournalEntry(client,{
      organizationId:input.organizationId,entryDate:input.reversalDate,sourceType:input.sourceType,sourceId:input.sourceId,
      idempotencyKey:`journal:${original.id}:reversal`,description:`عكس ${original.entry_number}: ${input.reason}`,
      reversalOfEntryId:String(original.id),lines:rows.rows.map(row=>({accountKey:String(row.system_key) as AccountKey,debit:Number(row.credit),credit:Number(row.debit),memo:`عكس: ${String(row.memo??"")}`})),
    })
    await client.query("UPDATE journal_entries SET status='reversed',reversed_by_entry_id=$1,reversal_reason=$2,updated_at=NOW() WHERE id=$3",[reversal.id,input.reason,original.id])
    await client.query("INSERT INTO financial_audit_events(organization_id,entity_type,entity_id,action,reason,snapshot) VALUES($1,'journal_entry',$2,'reversed',$3,$4)",[input.organizationId,original.id,input.reason,JSON.stringify({reversed_by_entry_id:reversal.id})])
    reversals.push(reversal)
  }
  return reversals
}

export async function ledgerHealth(client:PoolClient,organizationId:string){
  const balance=await client.query(`SELECT COALESCE(SUM(jl.debit),0) debit,COALESCE(SUM(jl.credit),0) credit
      FROM journal_lines jl JOIN journal_entries je ON je.id=jl.journal_entry_id
      WHERE je.organization_id=$1 AND je.status IN ('posted','reversed')`,[organizationId])
  const missing=await client.query(`SELECT
      (SELECT COUNT(*) FROM documents d WHERE d.organization_id=$1 AND d.type IN ('invoice','credit_note','debit_note') AND d.status IN ('issued','paid','partially_paid') AND d.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM journal_entries je WHERE je.organization_id=d.organization_id AND je.idempotency_key='document:'||d.id||':issued')) missing_documents,
      (SELECT COUNT(*) FROM customer_receipts r WHERE r.organization_id=$1 AND r.status='issued' AND NOT EXISTS(SELECT 1 FROM journal_entries je WHERE je.organization_id=r.organization_id AND je.idempotency_key='receipt:'||r.id||':issued')) missing_receipts,
      (SELECT COUNT(*) FROM purchase_invoices p WHERE p.organization_id=$1 AND p.accounting_status='recorded' AND p.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM journal_entries je WHERE je.organization_id=p.organization_id AND je.idempotency_key='purchase_invoice:'||p.id||':recorded')) missing_purchases,
      (SELECT COUNT(*) FROM purchase_invoice_payments p WHERE p.organization_id=$1 AND p.status='issued' AND NOT EXISTS(SELECT 1 FROM journal_entries je WHERE je.organization_id=p.organization_id AND je.idempotency_key='purchase_payment:'||p.id||':issued')) missing_purchase_payments,
      (SELECT COUNT(*) FROM expenses e WHERE e.organization_id=$1 AND e.source_type='manual' AND e.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM journal_entries je WHERE je.organization_id=e.organization_id AND je.idempotency_key='expense:'||e.id||':recorded')) missing_expenses,
      (SELECT COUNT(*) FROM expense_payments p WHERE p.organization_id=$1 AND NOT EXISTS(SELECT 1 FROM journal_entries je WHERE je.organization_id=p.organization_id AND je.idempotency_key='expense_payment:'||p.id||':recorded')) missing_expense_payments,
      (SELECT COUNT(*) FROM financial_movements m WHERE m.organization_id=$1 AND m.status='recorded' AND NOT EXISTS(SELECT 1 FROM journal_entries je WHERE je.organization_id=m.organization_id AND je.idempotency_key='financial_movement:'||m.id||':recorded')) missing_movements`,[organizationId])
  const reconciliationResult=await client.query(`WITH expected AS (SELECT
      (SELECT COALESCE(SUM(CASE WHEN type IN ('invoice','debit_note') THEN total-retention_total WHEN type='credit_note' THEN -total ELSE 0 END),0) FROM documents WHERE organization_id=$1 AND type IN ('invoice','credit_note','debit_note') AND status IN ('issued','paid','partially_paid') AND deleted_at IS NULL)
        -(SELECT COALESCE(SUM(amount),0) FROM customer_receipts WHERE organization_id=$1 AND status='issued' AND source_document_id IS NOT NULL) accounts_receivable,
      (SELECT COALESCE(SUM(retention_total),0) FROM documents WHERE organization_id=$1 AND type='invoice' AND status IN ('issued','paid','partially_paid') AND deleted_at IS NULL) retention_receivable,
      (SELECT COALESCE(SUM(CASE WHEN type IN ('invoice','debit_note') THEN total-tax_total WHEN type='credit_note' THEN -(total-tax_total) ELSE 0 END),0) FROM documents WHERE organization_id=$1 AND type IN ('invoice','credit_note','debit_note') AND status IN ('issued','paid','partially_paid') AND deleted_at IS NULL) sales_revenue,
      (SELECT COALESCE(SUM(CASE WHEN type IN ('invoice','debit_note') THEN tax_total WHEN type='credit_note' THEN -tax_total ELSE 0 END),0) FROM documents WHERE organization_id=$1 AND type IN ('invoice','credit_note','debit_note') AND status IN ('issued','paid','partially_paid') AND deleted_at IS NULL) vat_payable,
      (SELECT COALESCE(SUM(tax_total),0) FROM purchase_invoices WHERE organization_id=$1 AND accounting_status='recorded' AND include_in_tax_return=TRUE AND deleted_at IS NULL) vat_receivable,
      (SELECT COALESCE(SUM(CASE WHEN include_in_tax_return THEN subtotal ELSE total END),0) FROM purchase_invoices WHERE organization_id=$1 AND accounting_status='recorded' AND deleted_at IS NULL)
        +(SELECT COALESCE(SUM(amount),0) FROM expenses WHERE organization_id=$1 AND source_type='manual' AND financial_class='direct_cost' AND deleted_at IS NULL) direct_cost,
      (SELECT COALESCE(SUM(amount),0) FROM customer_receipts WHERE organization_id=$1 AND status='issued' AND source_document_id IS NULL) customer_advances,
      (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE organization_id=$1 AND source_type='manual' AND deleted_at IS NULL)
        +(SELECT COALESCE(SUM(total),0) FROM purchase_invoices WHERE organization_id=$1 AND accounting_status='recorded' AND deleted_at IS NULL)
        -(SELECT COALESCE(SUM(amount),0) FROM expense_payments WHERE organization_id=$1)
        -(SELECT COALESCE(SUM(amount),0) FROM purchase_invoice_payments WHERE organization_id=$1 AND status='issued') accounts_payable,
      (SELECT COALESCE(SUM(amount),0) FROM customer_receipts WHERE organization_id=$1 AND status='issued')
        -(SELECT COALESCE(SUM(amount),0) FROM expense_payments WHERE organization_id=$1)
        -(SELECT COALESCE(SUM(amount),0) FROM purchase_invoice_payments WHERE organization_id=$1 AND status='issued')
        +(SELECT COALESCE(SUM(CASE WHEN movement_type IN ('opening_cash','capital_contribution','loan_received') THEN amount WHEN movement_type IN ('owner_withdrawal','loan_repayment') THEN -amount ELSE 0 END),0) FROM financial_movements WHERE organization_id=$1 AND status='recorded') cash_and_bank
    ), ledger AS (SELECT
      COALESCE(SUM(jl.debit-jl.credit) FILTER (WHERE coa.system_key='accounts_receivable' AND je.source_type<>'opening_balance'),0) accounts_receivable,
      COALESCE(SUM(jl.debit-jl.credit) FILTER (WHERE coa.system_key='retention_receivable' AND je.source_type<>'opening_balance'),0) retention_receivable,
      COALESCE(SUM(jl.credit-jl.debit) FILTER (WHERE coa.system_key='sales_revenue' AND je.source_type<>'financial_year'),0) sales_revenue,
      COALESCE(SUM(jl.credit-jl.debit) FILTER (WHERE coa.system_key='vat_payable' AND je.source_type<>'tax_return' AND je.source_type<>'opening_balance'),0) vat_payable,
      COALESCE(SUM(jl.debit-jl.credit) FILTER (WHERE coa.system_key='vat_receivable' AND je.source_type<>'tax_return' AND je.source_type<>'opening_balance'),0) vat_receivable,
      COALESCE(SUM(jl.debit-jl.credit) FILTER (WHERE coa.system_key='direct_cost' AND je.source_type<>'financial_year'),0) direct_cost,
      COALESCE(SUM(jl.credit-jl.debit) FILTER (WHERE coa.system_key='customer_advances' AND je.source_type<>'opening_balance'),0) customer_advances,
      COALESCE(SUM(jl.credit-jl.debit) FILTER (WHERE coa.system_key='accounts_payable' AND je.source_type<>'opening_balance'),0) accounts_payable,
      COALESCE(SUM(jl.debit-jl.credit) FILTER (WHERE coa.system_key='cash_and_bank' AND je.source_type<>'opening_balance'),0) cash_and_bank
      FROM journal_lines jl JOIN journal_entries je ON je.id=jl.journal_entry_id JOIN chart_of_accounts coa ON coa.id=jl.account_id
      WHERE je.organization_id=$1 AND je.status IN ('posted','reversed'))
    SELECT e.accounts_receivable-l.accounts_receivable accounts_receivable,
      e.retention_receivable-l.retention_receivable retention_receivable,e.sales_revenue-l.sales_revenue sales_revenue,
      e.vat_payable-l.vat_payable vat_payable,e.vat_receivable-l.vat_receivable vat_receivable,e.direct_cost-l.direct_cost direct_cost,
      e.customer_advances-l.customer_advances customer_advances,e.accounts_payable-l.accounts_payable accounts_payable,
      e.cash_and_bank-l.cash_and_bank cash_and_bank FROM expected e CROSS JOIN ledger l`,[organizationId])
  const debit=Number(balance.rows[0].debit),credit=Number(balance.rows[0].credit)
  const missingSources=Object.fromEntries(Object.entries(missing.rows[0]).map(([key,value])=>[key,Number(value)]))
  const reconciliation=Object.fromEntries(Object.entries(reconciliationResult.rows[0]).map(([key,value])=>[key,Math.round(Number(value)*100)/100]))
  return {debit,credit,difference:Math.round((debit-credit)*100)/100,missingSources,reconciliation,isHealthy:Math.abs(debit-credit)<=0.005&&Object.values(missingSources).every(value=>value===0)&&Object.values(reconciliation).every(value=>Math.abs(value)<=0.01)}
}

export async function postYearEndClosingEntry(client:PoolClient,input:{organizationId:string;periodId:string;startsOn:string;endsOn:string;fiscalYear:number}){
  const balances=await client.query(`SELECT coa.system_key,COALESCE(SUM(jl.debit-jl.credit),0) balance
    FROM chart_of_accounts coa JOIN journal_lines jl ON jl.account_id=coa.id JOIN journal_entries je ON je.id=jl.journal_entry_id
    WHERE coa.organization_id=$1 AND coa.account_type IN ('revenue','expense') AND je.status IN ('posted','reversed')
      AND je.entry_date BETWEEN $2 AND $3
      AND NOT (je.idempotency_key LIKE 'financial_year:%:closed%' OR EXISTS(
        SELECT 1 FROM journal_entries original WHERE original.id=je.reversal_of_entry_id AND original.idempotency_key LIKE 'financial_year:%:closed%'
      ))
    GROUP BY coa.id HAVING ABS(COALESCE(SUM(jl.debit-jl.credit),0))>0.005`,[input.organizationId,input.startsOn,input.endsOn])
  if(!balances.rows.length)return null
  const lines:JournalRuleLine[]=balances.rows.map(row=>{
    const balance=Math.round(Number(row.balance)*100)/100
    return {accountKey:String(row.system_key) as AccountKey,debit:balance<0?-balance:0,credit:balance>0?balance:0,memo:"إقفال حساب نتيجة الفترة"}
  })
  const debit=lines.reduce((sum,line)=>sum+(line.debit??0),0),credit=lines.reduce((sum,line)=>sum+(line.credit??0),0)
  if(Math.abs(debit-credit)>0.005)lines.push({accountKey:"retained_earnings",debit:credit>debit?credit-debit:0,credit:debit>credit?debit-credit:0,memo:"ترحيل نتيجة السنة إلى الأرباح المبقاة"})
  return postJournalEntry(client,{organizationId:input.organizationId,entryDate:input.endsOn,sourceType:"financial_year",sourceId:input.periodId,idempotencyKey:`financial_year:${input.periodId}:closed`,description:`قيد إقفال السنة المالية ${input.fiscalYear}`,lines})
}

export async function postYearEndAdjustments(client:PoolClient,input:{organizationId:string;periodId:string;endsOn:string;fiscalYear:number;values:{purchaseFixedAssets:number;purchasePrepayments:number;depreciation:number;zakatExpense:number;incomeTaxExpense:number}}){
  const lines=yearEndAdjustmentJournal(input.values)
  if(!lines.length)return null
  return postJournalEntry(client,{organizationId:input.organizationId,entryDate:input.endsOn,sourceType:"financial_year",sourceId:input.periodId,idempotencyKey:`financial_year:${input.periodId}:adjustments`,description:`تسويات السنة المالية ${input.fiscalYear}`,lines})
}
