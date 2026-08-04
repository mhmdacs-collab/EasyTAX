const API_URL = import.meta.env.VITE_API_URL as string

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
