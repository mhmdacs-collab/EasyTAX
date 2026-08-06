import { resolveApiUrl } from "@/lib/api/baseUrl"

const API_URL = resolveApiUrl()

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set("Content-Type", "application/json")
  const response = await fetch(`${API_URL}/api/v1${path}`, {
    ...init, credentials: "include", cache: "no-store",
    headers,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error || "تعذر إتمام الطلب")
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
  customer_id: string; issue_date: string; due_date?: string; prices_include_tax: boolean
  retention_basis?: "before_tax" | "including_tax"; discount_amount: number; notes?: string
  show_bank_details: boolean; show_stamp: boolean; show_signature: boolean
  reference_data: { purchase_order?: string; reference_number?: string; payment_method?: string }
  items: Array<{ description: string; unit?: string; quantity: number; unit_price: number; discount_percent: number; retention_percent: number }>
}
export const createDocumentDraft = (input: DocumentDraftInput) => request<{ document_id: string }>("/documents", { method: "POST", body: JSON.stringify(input) })
export const updateDocumentDraft = (id: string, input: DocumentDraftInput) => request<{ document_id: string }>(`/documents/${id}`, { method: "PUT", body: JSON.stringify(input) })
export const issueDocumentDraft = (id: string) => request<{ document: { id: string; number: string } }>(`/documents/${id}/issue`, { method: "POST" })
export type CentralDocument = {
  id:string; type:"invoice"; number:string; issue_date:string; due_date?:string; status:"draft"|"issued"|"cancelled"
  prices_include_tax:boolean; subtotal:number|string; discount_total:number|string; tax_total:number|string; retention_total:number|string; total:number|string; notes?:string
  show_bank_details:boolean; show_stamp:boolean; show_signature:boolean; reference_data:{ payment_method?:string; purchase_order?:string; reference_number?:string }
  customer_snapshot:CentralCustomer; organization_snapshot:Record<string,unknown>; created_at:string; updated_at:string
  items?:Array<{id:string;description:string;unit?:string;quantity:number|string;unit_price:number|string;discount:number|string;tax_rate:number|string;retention_rate:number|string;line_subtotal:number|string;line_tax:number|string;line_retention:number|string;line_total:number|string}>
}
export const listDocuments = () => request<{ documents: CentralDocument[] }>("/documents")
export const fetchDocument = (id:string) => request<{ document: CentralDocument }>(`/documents/${id}`)
