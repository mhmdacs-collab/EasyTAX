const API_URL = import.meta.env.VITE_API_URL as string

export type EffectiveStatus = "active" | "suspended" | "expired" | "inactive"

export type SubscriptionStatus = {
  vat_number: string | null
  business_name: string | null
  stored_status: string | null
  effective_status: EffectiveStatus
  starts_at: string | null
  expires_at: string | null
  remaining_days: number | null
}

export type CurrentSubscription = {
  subscription: {
    vat_number: string
    business_name: string
    phone: string
  } | null
}

export async function fetchSubscriptionStatus(): Promise<SubscriptionStatus> {
  const response = await fetch(`${API_URL}/api/v1/subscription/status`, {
    credentials: "include",
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error("فشل التحقق من حالة الاشتراك")
  }

  return response.json() as Promise<SubscriptionStatus>
}

export async function fetchCurrentSubscription(): Promise<CurrentSubscription> {
  const response = await fetch(`${API_URL}/api/v1/subscription/me`, {
    credentials: "include",
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error("تعذر تحميل بيانات الاشتراك")
  }

  return response.json() as Promise<CurrentSubscription>
}
