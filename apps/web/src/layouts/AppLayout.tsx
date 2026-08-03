import { Outlet, useRouterState } from "@tanstack/react-router"
import { Sidebar } from "./Sidebar"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { useSubscriptionStatus } from "@/lib/subscription/useSubscriptionStatus"
import { BlockedSubscriptionPage } from "@/features/subscription/BlockedSubscriptionPage"
import { Spinner } from "@/shared/components/ui/spinner"
import { RefreshCw } from "lucide-react"

export function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { data: subscription, isLoading, isError, refetch } = useSubscriptionStatus()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center" dir="rtl">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Spinner size="lg" />
          <p className="text-sm">جارٍ التحقق من الاشتراك…</p>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div
        className="flex h-screen flex-col items-center justify-center gap-4 text-center"
        dir="rtl"
      >
        <p className="text-base font-medium text-destructive">
          تعذّر التحقق من حالة الاشتراك
        </p>
        <button
          onClick={() => { void refetch() }}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          <RefreshCw className="size-4" />
          حاول مرة أخرى
        </button>
      </div>
    )
  }

  if (subscription && subscription.effective_status !== "active") {
    return (
      <BlockedSubscriptionPage
        status={subscription.effective_status}
        vatNumber={subscription.vat_number}
      />
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <ErrorBoundary key={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  )
}
