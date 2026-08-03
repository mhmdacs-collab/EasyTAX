import { useQuery } from "@tanstack/react-query"

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

export const SUBSCRIPTION_STATUS_QUERY_KEY = ["subscription-status"] as const

export function useSubscriptionStatus() {
  return useQuery<SubscriptionStatus>({
    queryKey: SUBSCRIPTION_STATUS_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v1/subscription/status`, {
        credentials: "include",
      })
      if (!res.ok) {
        throw new Error("فشل التحقق من حالة الاشتراك")
      }
      return res.json() as Promise<SubscriptionStatus>
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })
}
