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


export type CustomerBootstrap = {
  user: {
    id: string
    email: string
    name: string
    role: string
  }
  organization: {
    id: string
    business_name: string
    vat_number: string
    phone: string | null
    email: string | null
    commercial_registration: string | null
    city: string | null
    district: string | null
    street: string | null
    building_number: string | null
    postal_code: string | null
    onboarding_completed_at: string | null
    status: string
  }
  subscription: {
    id: string | null
    plan: string | null
    status: string | null
    effective_status: EffectiveStatus
    starts_at: string | null
    expires_at: string | null
  }
}

export async function fetchCustomerBootstrap(): Promise<CustomerBootstrap> {
  const response = await fetch(`${API_URL}/api/v1/bootstrap/me`, {
    credentials: "include",
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error("تعذر تحميل بيانات المنشأة")
  }

  return response.json() as Promise<CustomerBootstrap>
}

export type CompleteOnboardingInput = {
  commercial_registration?: string
  phone?: string
  email?: string
  city?: string
  district?: string
  street?: string
  building_number?: string
  postal_code?: string
}

export async function completeCustomerOnboarding(input: CompleteOnboardingInput): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/bootstrap/onboarding-complete`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })

  if (!response.ok) throw new Error("تعذر حفظ اكتمال إعداد المنشأة")
}
