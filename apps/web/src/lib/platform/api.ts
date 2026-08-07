import { resolveApiUrl } from "@/lib/api/baseUrl"
import { platformErrorMessage } from "./errorMessage"

const API_URL = resolveApiUrl()

function errorMessage(body: { error?: unknown; message?: unknown }) {
  return platformErrorMessage(body)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set("Content-Type", "application/json")
  const response = await fetch(`${API_URL}/api/v1${path}`, {
    ...init, credentials: "include", cache: "no-store",
    headers,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: unknown; message?: unknown }
    throw new Error(errorMessage(body))
  }
  return response.json() as Promise<T>
}

export type CentralCustomer = {
  id: string; name: string; vat_number: string; commercial_registration?: string; phone?: string; email?: string; notes?: string
  country: string; country_code: string; city: string; district: string; street: string; building_number: string; postal_code: string
  additional_number?: string; short_address?: string
}
export type CustomerInput = Omit<CentralCustomer, "id" | "country" | "country_code">
export const listCustomers = () => request<{ customers: CentralCustomer[] }>("/customers")
export const createCustomer = (input: CustomerInput) => request<{ customer: CentralCustomer }>("/customers", { method: "POST", body: JSON.stringify(input) })
export const updateCustomer = (id: string, input: CustomerInput) => request<{ customer: CentralCustomer }>(`/customers/${id}`, { method: "PUT", body: JSON.stringify(input) })
export const deleteCustomer = (id: string) => request<{ ok: true }>(`/customers/${id}`, { method: "DELETE" })
export type CustomerAccountMovement = {
  kind:"invoice"|"credit_note"|"debit_note"|"payment"|"receipt"; source_id:string; number:string; event_date:string
  invoice_total:number; retention_total:number; received:number; balance:number
  payment_method_name?:string; reference_number?:string
}
export type CustomerAccount = {
  customer:{id:string;name:string;vat_number:string}
  summary:{invoice_total:number;retention_total:number;received_total:number;balance:number}
  movements:CustomerAccountMovement[]
}
export const fetchCustomerAccount = (id:string) => request<CustomerAccount>(`/customers/${id}/account`)
export const createCustomerReceipt = (id:string,input:{amount:number;payment_method_name:string;receipt_date:string;reference_number?:string;notes?:string}) => request<{receipt:{id:string;number:string}}>(`/customers/${id}/receipts`,{method:"POST",body:JSON.stringify(input)})

export type CentralReceipt = {
  id:string; customer_id?:string; number:string; receipt_date:string; amount:number|string
  payment_method_name:string; payer_name:string; payer_phone?:string; payer_email?:string; payer_vat_number?:string
  reference_number?:string; notes?:string; organization_snapshot:Record<string,unknown>
  show_stamp:boolean; show_signature:boolean; issued_at:string; created_at:string; status:"issued"|"cancelled"
  cancelled_at?:string; cancellation_reason?:string; source_document_id?:string
}
export type ReceiptInput = {
  customer_id?:string; payer_name?:string; payer_phone?:string; payer_email?:string; payer_vat_number?:string
  amount:number; payment_method_name:string; receipt_date:string; reference_number?:string; notes?:string
  show_stamp:boolean; show_signature:boolean; request_id?:string
}
export const listReceipts = () => request<{receipts:CentralReceipt[]}>("/receipts")
export const fetchReceipt = (id:string) => request<{receipt:CentralReceipt}>(`/receipts/${id}`)
export const createReceipt = (input:ReceiptInput) => request<{receipt:CentralReceipt}>("/receipts",{method:"POST",body:JSON.stringify(input)})
export const cancelReceipt = (id:string,reason:string) => request<{receipt:CentralReceipt}>(`/receipts/${id}/cancel`,{method:"POST",body:JSON.stringify({reason})})

export type SettingsPayload = {
  organization: Record<string, string | number | boolean | null>
  payment_methods: Array<{ id: string; name: string; is_collected: boolean; is_default: boolean; is_active: boolean }>
  quotation_terms: Array<{ id: string; text: string; sort_order: number; is_active: boolean }>
  sequences: Array<{ document_type: "invoice" | "quotation" | "receipt"; next_number: number }>
}
export const fetchSettings = () => request<SettingsPayload>("/settings")
export const saveSettings = (input: unknown) => request<{ ok: true }>("/settings", { method: "PUT", body: JSON.stringify(input) })
export type BrandingAssetKind = "logo" | "stamp" | "signature"
export async function uploadBrandingAsset(kind: BrandingAssetKind, file: File) {
  const response = await fetch(`${API_URL}/api/v1/assets/${kind}`, { method: "PUT", body: file, credentials: "include", headers: { "Content-Type": "image/png" } })
  if (!response.ok) { const body = await response.json().catch(() => ({})) as { error?: string }; throw new Error(body.error || "تعذر رفع الملف") }
}
export async function deleteBrandingAsset(kind: BrandingAssetKind) {
  const response = await fetch(`${API_URL}/api/v1/assets/${kind}`, { method: "DELETE", credentials: "include" })
  if (!response.ok) { const body = await response.json().catch(() => ({})) as { error?: string }; throw new Error(body.error || "تعذر حذف الملف") }
}
export async function fetchBrandingAssetUrl(kind: BrandingAssetKind) {
  const response = await fetch(`${API_URL}/api/v1/assets/${kind}`, { credentials: "include", cache: "no-store" })
  if (!response.ok) return null
  return URL.createObjectURL(await response.blob())
}

export type DocumentDraftInput = {
  type: "invoice" | "quotation"
  customer_id: string; issue_date: string; due_date?: string; prices_include_tax: boolean
  retention_basis?: "before_tax" | "including_tax"; discount_amount: number; notes?: string
  show_bank_details: boolean; show_stamp: boolean; show_signature: boolean
  reference_data: { purchase_order?: string; reference_number?: string; payment_method?: string; show_totals?: boolean }
  payments: Array<{ payment_method_name: string; amount: number }>
  terms: string[]
  items: Array<{ description: string; unit?: string; quantity: number; unit_price: number; discount_percent: number; retention_percent: number }>
}
export const createDocumentDraft = (input: DocumentDraftInput) => request<{ document_id: string }>("/documents", { method: "POST", body: JSON.stringify(input) })
export const updateDocumentDraft = (id: string, input: DocumentDraftInput) => request<{ document_id: string }>(`/documents/${id}`, { method: "PUT", body: JSON.stringify(input) })
export const issueDocumentDraft = (id: string) => request<{ document: { id: string; number: string } }>(`/documents/${id}/issue`, { method: "POST" })
export const cancelDocument = (id:string,reason:string) => request<{document:CentralDocument}>(`/documents/${id}/cancel`,{method:"POST",body:JSON.stringify({reason})})
export const createDocumentAdjustment = (id:string,input:{type:"credit_note"|"debit_note";issue_date:string;reason:string;taxable_amount:number}) => request<{document:CentralDocument}>(`/documents/${id}/adjustments`,{method:"POST",body:JSON.stringify(input)})
export type CentralDocument = {
  id:string; type:"invoice"|"quotation"|"credit_note"|"debit_note"; number:string; issue_date:string; due_date?:string; status:"draft"|"issued"|"paid"|"partially_paid"|"cancelled"; cancelled_at?:string; cancellation_reason?:string
  prices_include_tax:boolean; subtotal:number|string; discount_total:number|string; tax_total:number|string; retention_total:number|string; total:number|string; notes?:string
  show_bank_details:boolean; show_stamp:boolean; show_signature:boolean; reference_data:{ payment_method?:string; purchase_order?:string; reference_number?:string; show_totals?:boolean; source_invoice_number?:string }
  customer_snapshot:CentralCustomer; organization_snapshot:Record<string,unknown>; created_at:string; updated_at:string
  source_document_id?:string; correction_reason?:string
  items?:Array<{id:string;description:string;unit?:string;quantity:number|string;unit_price:number|string;discount:number|string;tax_rate:number|string;retention_rate:number|string;line_subtotal:number|string;line_tax:number|string;line_retention:number|string;line_total:number|string}>
  payments?:Array<{id:string;payment_method_name:string;amount:number|string;is_collected:boolean;paid_at?:string}>
  terms?:string[]
}
export const listDocuments = () => request<{ documents: CentralDocument[] }>("/documents")
export const fetchDocument = (id:string) => request<{ document: CentralDocument }>(`/documents/${id}`)

export type TaxPurchase = {
  id:string; internal_number:string; supplier_name:string; supplier_vat_number:string; invoice_number:string
  invoice_date:string; invoice_timestamp:string; subtotal:number|string; tax_total:number|string; total:number|string
  status:"included"|"excluded"|"cancelled"; exclusion_reason?:string; cancellation_reason?:string
  accounting_status:"recorded"|"cancelled"; payment_status:"unpaid"|"partially_paid"|"paid"; paid_amount:number|string
  last_payment_method?:"cash"|"bank_transfer"|"card"|"sadad"; beneficiary_iban?:string
  duplicate_override:boolean; duplicate_of_id?:string; created_at:string
  payments?:Array<{id:string;payment_date:string;amount:number|string;payment_method:"cash"|"bank_transfer"|"card"|"sadad";beneficiary_name:string;beneficiary_iban?:string;reference_number?:string;notes?:string;status:"issued"|"cancelled";cancellation_reason?:string}>
}
export type TaxPurchaseInput = {
  supplier_name:string; supplier_vat_number:string; invoice_number:string; invoice_timestamp:string
  total:number; tax_total:number; qr_payload:string; qr_fields:Record<string,string>
  duplicate_override:boolean; responsibility_confirmed:true; notes?:string
}
export const listTaxPurchases = () => request<{purchases:TaxPurchase[]}>("/purchases")
export const fetchTaxPurchase = (id:string) => request<{purchase:TaxPurchase}>(`/purchases/${id}`)
export const createTaxPurchase = (input:TaxPurchaseInput) => request<{purchase:TaxPurchase}>("/purchases",{method:"POST",body:JSON.stringify(input)})
export const setTaxPurchaseStatus = (id:string,status:TaxPurchase["status"],reason?:string) => request<{purchase:TaxPurchase}>(`/purchases/${id}/status`,{method:"PATCH",body:JSON.stringify({status,reason})})
export type TaxPurchasePaymentInput = {amount:number;payment_method:"cash"|"bank_transfer"|"card"|"sadad";payment_date:string;beneficiary_name?:string;beneficiary_iban?:string;reference_number?:string;notes?:string}
export const addTaxPurchasePayment = (id:string,input:TaxPurchasePaymentInput) => request<{purchase:TaxPurchase;payment:NonNullable<TaxPurchase["payments"]>[number]}>(`/purchases/${id}/payments`,{method:"POST",body:JSON.stringify(input)})
export const cancelTaxPurchasePayment = (id:string,paymentId:string,reason:string) => request<{purchase:TaxPurchase;payment:NonNullable<TaxPurchase["payments"]>[number]}>(`/purchases/${id}/payments/${paymentId}/cancel`,{method:"POST",body:JSON.stringify({reason})})

export type TaxReturnSummary = {
  period:{year:number;quarter:number;starts_on:string;ends_on:string;deadline:string;status:"open"|"awaiting_review"|"closed";days_remaining:number;lock_id?:string|null}
  organization:{id:string;business_name:string;vat_number:string}
  sales:{total:number;taxable:number;tax:number;adjustments:number}
  purchases:{total:number;taxable:number;tax:number;adjustments:number}
  net_tax:number
  counts:{sales:number;purchases:number;sales_returns:number;purchase_returns:number}
  notice:string
}
export const fetchTaxReturnSummary = (year?:number,quarter?:number) => request<TaxReturnSummary>(`/tax-returns/current${year&&quarter?`?year=${year}&quarter=${quarter}`:""}`)
export const closeTaxReturn = (year:number,quarter:number,reason?:string) => request<{lock:PeriodLock}>("/tax-returns/close",{method:"POST",body:JSON.stringify({year,quarter,reason:reason||"اعتماد الإقرار الضريبي وقفل الفترة"})})

export type ExpenseCategory = "work_costs" | "payroll" | "rent_utilities" | "vehicles_transport" | "admin_marketing_professional" | "asset_equipment" | "other"
export type FinancialClass = "direct_cost" | "operating_expense" | "employee_expense" | "fixed_asset" | "prepayment" | "other_expense"
export type ExpensePaymentMethod = "cash" | "bank_transfer" | "card" | "sadad"
export type CentralExpense = {
  id:string; expense_date:string; category:ExpenseCategory; financial_class:FinancialClass; description:string
  amount:number|string; payment_status:"paid"|"unpaid"|"partially_paid"; paid_amount:number|string
  payment_method?:ExpensePaymentMethod; supplier_name?:string; beneficiary_iban?:string; reference_number?:string; project_reference?:string; notes?:string
  source_type:"manual"|"tax_purchase"; created_at:string
}
export type ExpenseInput = Omit<CentralExpense,"id"|"source_type"|"created_at"|"amount"|"paid_amount"> & { amount:number; paid_amount:number }
export type ExpenseSummary = { total:number|string; paid:number|string; outstanding:number|string; direct_costs:number|string; operating_expenses:number|string; asset_purchases:number|string }
export const listExpenses = (year:number,month:number) => request<{expenses:CentralExpense[];summary:ExpenseSummary;period:{year:number;month:number;starts_on:string;ends_on:string}}>(`/expenses?year=${year}&month=${month}`)
export const createExpense = (input:ExpenseInput) => request<{expense:CentralExpense}>("/expenses",{method:"POST",body:JSON.stringify(input)})
export const addExpensePayment = (id:string,input:{amount:number;payment_method:ExpensePaymentMethod;payment_date:string;beneficiary_name:string;beneficiary_iban?:string;reference_number?:string;notes?:string}) => request<{expense:CentralExpense}>(`/expenses/${id}/payments`,{method:"POST",body:JSON.stringify(input)})
export const deleteExpense = (id:string) => request<{ok:true}>(`/expenses/${id}`,{method:"DELETE"})

export type FinancialInputKey =
  | "purchase_fixed_asset_reclassification" | "purchase_prepayment_reclassification"
  | "cash_and_cash_equivalents" | "inventory"
  | "other_current_assets" | "related_party_receivable" | "property_plant_equipment"
  | "intangible_assets" | "investment_property" | "equity_method_investments" | "other_non_current_assets"
  | "current_loans" | "non_current_loans" | "employee_benefits"
  | "zakat_payable" | "taxes_payable" | "related_party_payable" | "other_current_liabilities"
  | "other_non_current_liabilities" | "capital" | "statutory_reserve" | "retained_earnings_opening"
  | "other_equity" | "owner_distributions" | "other_income" | "finance_cost" | "zakat_expense"
  | "income_tax_expense" | "depreciation_expense" | "other_comprehensive_income"

export type FinancialInputValue = { current:number|null; prior:number|null; note?:string }
export type FinancialStatementRow = { code:string; label:string; kind:"heading"|"line"|"subtotal"|"total"; current:number; prior:number }
export type EquityMovementRow = { code:string; label:string; capital:number; statutoryReserve:number; retainedEarnings:number; otherEquity:number; total:number }
export type FinancialValidationIssue = { code:string; severity:"error"|"warning"|"info"; message:string; difference?:number }
export type FinancialSourceTotals = {
  revenue:number; invoiceTotal:number; salesTax:number; taxPurchases:number; purchaseTax:number
  directCosts:number; employeeExpenses:number; operatingExpenses:number; otherExpenses:number
  fixedAssetAdditions:number; fixedAssetBalance:number; prepaymentBalance:number; receiptInflows:number
  standaloneAdvances:number; expensePayments:number; purchasePayments:number; openingCash:number; capitalBalance:number
  ownerWithdrawals:number; currentLoanBalance:number; nonCurrentLoanBalance:number; systemCashBalance:number; tradeReceivables:number
  tradePayables:number; invoiceCount:number; purchaseCount:number; expenseCount:number
}
export type FinancialStatementReport = {
  organization:{id:string;businessName:string;legalForm:string;vatNumber:string;commercialRegistration:string}
  period:{fiscalYear:number;startsOn:string;endsOn:string;priorStartsOn:string;priorEndsOn:string;currency:"SAR"}
  sourceSummary:FinancialSourceTotals&{prior:FinancialSourceTotals}
  inputs:Partial<Record<FinancialInputKey,FinancialInputValue>>
  inputDefinitions:Array<{key:FinancialInputKey;label:string;group:"assets"|"liabilities"|"equity"|"income";description:string}>
  statements:{financialPosition:FinancialStatementRow[];comprehensiveIncome:FinancialStatementRow[];changesInEquity:EquityMovementRow[];cashFlows:FinancialStatementRow[]}
  totals:{assets:number;liabilitiesAndEquity:number;netProfit:number;comprehensiveIncome:number;closingCash:number;calculatedClosingCash:number}
  validation:{isExportable:boolean;issues:FinancialValidationIssue[]}
}
export type FinancialStatementInputPayload = {key:FinancialInputKey;current_amount:number|null;prior_amount:number|null;note?:string}
export const fetchFinancialStatements = (year:number) => request<{report:FinancialStatementReport}>(`/financial-statements/${year}`)
export const saveFinancialStatementInputs = (year:number,inputs:FinancialStatementInputPayload[]) => request<{report:FinancialStatementReport}>(`/financial-statements/${year}/inputs`,{method:"PUT",body:JSON.stringify({inputs})})
export const createFinancialStatementSnapshot = (year:number) => request<{snapshot:{id:string;version:number;generated_at:string}}>(`/financial-statements/${year}/snapshots`,{method:"POST"})
export const closeFinancialYear = (year:number,reason?:string) => request<{snapshot:{id:string;version:number;generated_at:string};lock:PeriodLock}>(`/financial-statements/${year}/close`,{method:"POST",body:JSON.stringify({reason:reason||"اعتماد القوائم المالية وقفل السنة"})})

export type PeriodLock = {id:string;lock_type:"tax_return"|"financial_year";starts_on:string;ends_on:string;status:"locked"|"unlocked";reason:string;locked_at:string;unlocked_at?:string;unlock_reason?:string}
export const listPeriodLocks = () => request<{locks:PeriodLock[]}>('/accounting/period-locks')
export const unlockPeriod = (id:string,reason:string) => request<{lock:PeriodLock}>(`/accounting/period-locks/${id}/unlock`,{method:"POST",body:JSON.stringify({reason})})

export type LedgerHealth = {debit:number;credit:number;difference:number;missingSources:Record<string,number>;reconciliation:Record<string,number>;isHealthy:boolean}
export const fetchLedgerHealth = () => request<{health:LedgerHealth}>('/accounting/ledger-health')

export type FinancialMovementType = "opening_cash"|"capital_contribution"|"owner_withdrawal"|"loan_received"|"loan_repayment"
export type FinancialMovement = {id:string;movement_date:string;movement_type:FinancialMovementType;amount:number|string;loan_term?:"current"|"non_current";reference_number?:string;notes?:string;status:"recorded"|"reversed";reversal_reason?:string}
export const listFinancialMovements = (year:number) => request<{movements:FinancialMovement[];summary:Record<string,number|string>;period:{year:number;starts_on:string;ends_on:string}}>(`/accounting/movements?year=${year}`)
export const createFinancialMovement = (input:{movement_date:string;movement_type:FinancialMovementType;amount:number;loan_term?:"current"|"non_current";reference_number?:string;notes?:string}) => request<{movement:FinancialMovement}>('/accounting/movements',{method:"POST",body:JSON.stringify(input)})
export const reverseFinancialMovement = (id:string,reason:string) => request<{movement:FinancialMovement}>(`/accounting/movements/${id}/reverse`,{method:"POST",body:JSON.stringify({reason})})

export type SupplierAccountSummary = {supplier_vat_number:string;supplier_name:string;invoice_count:number|string;invoice_total:number|string;paid_total:number|string;outstanding:number|string}
export type SupplierAccount = {supplier:{name:string;vat_number:string};summary:{invoice_total:number;paid_total:number;outstanding:number};invoices:Array<{id:string;internal_number:string;invoice_number:string;invoice_date:string;supplier_name:string;total:number|string;paid_amount:number|string;payment_status:"unpaid"|"partially_paid"|"paid"}>;payments:Array<{id:string;purchase_invoice_id:string;internal_number:string;payment_date:string;amount:number|string;payment_method:string;reference_number?:string;status:"issued"|"cancelled"}>}
export const listSupplierAccounts = () => request<{suppliers:SupplierAccountSummary[]}>('/accounting/suppliers')
export const fetchSupplierAccount = (vat:string) => request<SupplierAccount>(`/accounting/suppliers/${encodeURIComponent(vat)}/account`)
