export type AdminSummary = {
  total_subscribers: number
  active_subscriptions: number
  expired_subscriptions: number
  expiring_in_30_days: number
}

export type SubscriptionItem = {
  id: string
  business_name: string
  vat_number: string
  phone: string
  plan: string
  status: "active" | "inactive" | "suspended"
  starts_at: string | null
  expires_at: string | null
  derived_status: "active" | "inactive" | "suspended" | "expired"
  remaining_days: number | null
}
