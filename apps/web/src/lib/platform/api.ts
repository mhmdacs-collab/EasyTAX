import { resolveApiUrl } from "@/lib/api/baseUrl"

const API_URL = resolveApiUrl()

function errorMessage(body: { error?: unknown; message?: unknown }) {
  if (typeof body.error === "string") return body.error
  if (body.error && typeof body.error === "object") {
    const error = body.error as Record<string, unknown>
    const issues = error.issues
    if (Array.isArray(issues) && issues[0] && typeof issues[0] === "object") {
      const message = (issues[0] as Record<string, unknown>).message
      if (typeof message === "string") return message
    }
    const message = error.message
    if (typeof message === "string") return message
  }
  return typeof body.message === "string" ? body.message : "تعذر إتمام الطلب"
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
  kind:"invoice"|"payment"|"receipt"; source_id:string; number:string; event_date:string
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
export type CentralDocument = {
  id:string; type:"invoice"|"quotation"; number:string; issue_date:string; due_date?:string; status:"draft"|"issued"|"paid"|"partially_paid"|"cancelled"; cancelled_at?:string; cancellation_reason?:string
  prices_include_tax:boolean; subtotal:number|string; discount_total:number|string; tax_total:number|string; retention_total:number|string; total:number|string; notes?:string
  show_bank_details:boolean; show_stamp:boolean; show_signature:boolean; reference_data:{ payment_method?:string; purchase_order?:string; reference_number?:string; show_totals?:boolean }
  customer_snapshot:CentralCustomer; organization_snapshot:Record<string,unknown>; created_at:string; updated_at:string
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
  duplicate_override:boolean; duplicate_of_id?:string; created_at:string
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

export type TaxReturnSummary = {
  period:{year:number;quarter:number;starts_on:string;ends_on:string;deadline:string;status:"open"|"awaiting_review";days_remaining:number}
  organization:{id:string;business_name:string;vat_number:string}
  sales:{total:number;taxable:number;tax:number;adjustments:number}
  purchases:{total:number;taxable:number;tax:number;adjustments:number}
  net_tax:number
  counts:{sales:number;purchases:number;sales_returns:number;purchase_returns:number}
  notice:string
}
export const fetchTaxReturnSummary = (year?:number,quarter?:number) => request<TaxReturnSummary>(`/tax-returns/current${year&&quarter?`?year=${year}&quarter=${quarter}`:""}`)

export type ExpenseCategory = "work_costs" | "payroll" | "rent_utilities" | "vehicles_transport" | "admin_marketing_professional" | "asset_equipment" | "other"
export type FinancialClass = "direct_cost" | "operating_expense" | "employee_expense" | "fixed_asset" | "prepayment" | "other_expense"
export type CentralExpense = {
  id:string; expense_date:string; category:ExpenseCategory; financial_class:FinancialClass; description:string
  amount:number|string; payment_status:"paid"|"unpaid"|"partially_paid"; paid_amount:number|string
  payment_method?:string; supplier_name?:string; reference_number?:string; project_reference?:string; notes?:string
  source_type:"manual"|"tax_purchase"; created_at:string
}
export type ExpenseInput = Omit<CentralExpense,"id"|"source_type"|"created_at"|"amount"|"paid_amount"> & { amount:number; paid_amount:number }
export type ExpenseSummary = { total:number|string; paid:number|string; outstanding:number|string; direct_costs:number|string; operating_expenses:number|string; asset_purchases:number|string }
export const listExpenses = (year:number,month:number) => request<{expenses:CentralExpense[];summary:ExpenseSummary;period:{year:number;month:number;starts_on:string;ends_on:string}}>(`/expenses?year=${year}&month=${month}`)
export const createExpense = (input:ExpenseInput) => request<{expense:CentralExpense}>("/expenses",{method:"POST",body:JSON.stringify(input)})
export const deleteExpense = (id:string) => request<{ok:true}>(`/expenses/${id}`,{method:"DELETE"})
