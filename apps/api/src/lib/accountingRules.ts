export type AccountKey =
  | "cash_and_bank" | "accounts_receivable" | "retention_receivable" | "vat_receivable"
  | "vat_refund_receivable" | "prepayments" | "fixed_assets" | "accumulated_depreciation"
  | "accounts_payable" | "vat_payable" | "vat_settlement_payable" | "zakat_payable" | "income_tax_payable" | "customer_advances"
  | "current_loans" | "non_current_loans" | "capital" | "owner_drawings"
  | "retained_earnings" | "opening_balance_equity" | "sales_revenue" | "direct_cost"
  | "employee_expense" | "operating_expense" | "other_expense" | "depreciation_expense"
  | "zakat_expense" | "income_tax_expense"

export type JournalRuleLine = {
  accountKey: AccountKey
  debit?: number
  credit?: number
  memo?: string
}

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export function compactBalancedLines(lines: JournalRuleLine[]) {
  const compact = lines.map((line) => ({ ...line, debit: money(line.debit ?? 0), credit: money(line.credit ?? 0) }))
    .filter((line) => line.debit > 0 || line.credit > 0)
  const debit = money(compact.reduce((sum, line) => sum + line.debit, 0))
  const credit = money(compact.reduce((sum, line) => sum + line.credit, 0))
  if (compact.length < 2 || debit <= 0 || Math.abs(debit - credit) > 0.005) throw new Error(`Unbalanced journal rule: debit=${debit}, credit=${credit}`)
  return compact
}

export function documentJournal(input: { type: "invoice"|"credit_note"|"debit_note"; total:number; taxTotal:number; retentionTotal?:number }) {
  const base = money(input.total - input.taxTotal)
  const retention = input.type === "invoice" ? money(input.retentionTotal ?? 0) : 0
  if (input.type === "credit_note") return compactBalancedLines([
    { accountKey:"sales_revenue", debit:base, memo:"عكس صافي الإيراد" },
    { accountKey:"vat_payable", debit:input.taxTotal, memo:"عكس ضريبة المخرجات" },
    { accountKey:"accounts_receivable", credit:input.total, memo:"تخفيض ذمة العميل" },
  ])
  return compactBalancedLines([
    { accountKey:"accounts_receivable", debit:money(input.total-retention), memo:"ذمة العميل" },
    { accountKey:"retention_receivable", debit:retention, memo:"حجز ضمان الأعمال" },
    { accountKey:"sales_revenue", credit:base, memo:"صافي الإيراد" },
    { accountKey:"vat_payable", credit:input.taxTotal, memo:"ضريبة المخرجات" },
  ])
}

export function receiptJournal(input:{ amount:number; linkedToInvoice:boolean }) {
  return compactBalancedLines([
    { accountKey:"cash_and_bank", debit:input.amount, memo:"تحصيل من العميل" },
    { accountKey:input.linkedToInvoice?"accounts_receivable":"customer_advances", credit:input.amount, memo:input.linkedToInvoice?"تسوية ذمة العميل":"دفعة عميل مقدمة" },
  ])
}

export function purchaseJournal(input:{ subtotal:number; taxTotal:number; total:number }) {
  return compactBalancedLines([
    { accountKey:"direct_cost", debit:input.subtotal, memo:"تكلفة المشتريات" },
    { accountKey:"vat_receivable", debit:input.taxTotal, memo:"ضريبة المدخلات" },
    { accountKey:"accounts_payable", credit:input.total, memo:"ذمة المورد" },
  ])
}

export function purchaseTaxExclusionJournal(taxTotal:number) {
  return compactBalancedLines([
    {accountKey:"direct_cost",debit:taxTotal,memo:"ضريبة غير مدرجة ضمن الإقرار تضاف إلى التكلفة"},
    {accountKey:"vat_receivable",credit:taxTotal,memo:"استبعاد ضريبة المدخلات"},
  ])
}

export function payablePaymentJournal(amount:number) {
  return compactBalancedLines([
    { accountKey:"accounts_payable", debit:amount, memo:"تسوية ذمة المورد" },
    { accountKey:"cash_and_bank", credit:amount, memo:"سداد" },
  ])
}

const expenseAccounts:Record<string,AccountKey>={
  direct_cost:"direct_cost", employee_expense:"employee_expense", operating_expense:"operating_expense",
  fixed_asset:"fixed_assets", prepayment:"prepayments", other_expense:"other_expense",
}

export function expenseJournal(input:{ amount:number; financialClass:string }) {
  return compactBalancedLines([
    { accountKey:expenseAccounts[input.financialClass]??"other_expense", debit:input.amount, memo:"إثبات المصروف أو الأصل" },
    { accountKey:"accounts_payable", credit:input.amount, memo:"إثبات المبلغ المستحق" },
  ])
}

export function financialMovementJournal(input:{ movementType:string; amount:number; loanTerm?:string|null }) {
  const loan:AccountKey=input.loanTerm==="non_current"?"non_current_loans":"current_loans"
  switch(input.movementType){
    case "opening_cash": return compactBalancedLines([{accountKey:"cash_and_bank",debit:input.amount},{accountKey:"opening_balance_equity",credit:input.amount}])
    case "capital_contribution": return compactBalancedLines([{accountKey:"cash_and_bank",debit:input.amount},{accountKey:"capital",credit:input.amount}])
    case "owner_withdrawal": return compactBalancedLines([{accountKey:"owner_drawings",debit:input.amount},{accountKey:"cash_and_bank",credit:input.amount}])
    case "loan_received": return compactBalancedLines([{accountKey:"cash_and_bank",debit:input.amount},{accountKey:loan,credit:input.amount}])
    case "loan_repayment": return compactBalancedLines([{accountKey:loan,debit:input.amount},{accountKey:"cash_and_bank",credit:input.amount}])
    default: throw new Error(`Unsupported financial movement: ${input.movementType}`)
  }
}

export function vatSettlementJournal(input:{ outputTax:number; inputTax:number }) {
  const net=money(input.outputTax-input.inputTax)
  return compactBalancedLines([
    {accountKey:"vat_payable",debit:input.outputTax,memo:"إقفال ضريبة المخرجات"},
    {accountKey:"vat_receivable",credit:input.inputTax,memo:"إقفال ضريبة المدخلات"},
    ...(net>=0?[{accountKey:"vat_settlement_payable" as AccountKey,credit:net,memo:"المستحق للهيئة"}]:[{accountKey:"vat_refund_receivable" as AccountKey,debit:-net,memo:"الرصيد المسترد من الهيئة"}]),
  ])
}

export function yearEndAdjustmentJournal(input:{purchaseFixedAssets:number;purchasePrepayments:number;depreciation:number;zakatExpense:number;incomeTaxExpense:number}){
  const lines:JournalRuleLine[]=[
    {accountKey:"fixed_assets",debit:input.purchaseFixedAssets,memo:"إعادة تصنيف مشتريات إلى أصول"},
    {accountKey:"prepayments",debit:input.purchasePrepayments,memo:"إعادة تصنيف مشتريات إلى دفعات مقدمة"},
    {accountKey:"direct_cost",credit:input.purchaseFixedAssets+input.purchasePrepayments,memo:"عكس تكلفة المشتريات المعاد تصنيفها"},
    {accountKey:"depreciation_expense",debit:input.depreciation,memo:"إهلاك السنة"},
    {accountKey:"accumulated_depreciation",credit:input.depreciation,memo:"مجمع إهلاك السنة"},
    {accountKey:"zakat_expense",debit:input.zakatExpense,memo:"مصروف زكاة السنة"},
    {accountKey:"zakat_payable",credit:input.zakatExpense,memo:"الزكاة المستحقة"},
    {accountKey:"income_tax_expense",debit:input.incomeTaxExpense,memo:"مصروف ضريبة الدخل"},
    {accountKey:"income_tax_payable",credit:input.incomeTaxExpense,memo:"ضريبة الدخل المستحقة"},
  ]
  return lines.some(line=>(line.debit??0)>0||(line.credit??0)>0)?compactBalancedLines(lines):[]
}
