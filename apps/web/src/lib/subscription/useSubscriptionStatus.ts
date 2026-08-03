import { useQuery } from "@tanstack/react-query"
import { fetchSubscriptionStatus, type SubscriptionStatus } from "./api"

export const SUBSCRIPTION_STATUS_QUERY_KEY = "subscription-status"

export function useSubscriptionStatus(userId?: string) {
  return useQuery<SubscriptionStatus>({
    queryKey: [SUBSCRIPTION_STATUS_QUERY_KEY, userId],
    queryFn: fetchSubscriptionStatus,
    enabled: Boolean(userId),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })
}
