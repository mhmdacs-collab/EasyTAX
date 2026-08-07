import { createRouter, createRoute, createRootRoute, redirect } from "@tanstack/react-router"
import { Outlet } from "@tanstack/react-router"
import { lazy, Suspense, useEffect, useState } from "react"
import { authClient } from "@/lib/auth/client"
import { AppLayout } from "@/layouts/AppLayout"
import { ensureTenantContextForUser, bindOrganizationToAuthUser, hydrateOrganizationFromBootstrap } from "@/lib/session/customerSession"
import { Spinner } from "@/shared/components/ui/spinner"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { useSubscriptionStatus } from "@/lib/subscription/useSubscriptionStatus"
import { BlockedSubscriptionPage } from "@/features/subscription/BlockedSubscriptionPage"
import { fetchCustomerBootstrap, fetchCurrentSubscription } from "@/lib/subscription/api"
import { db } from "@/lib/db"
import { generateId } from "@/shared/utils"
import { useNavigate } from "@tanstack/react-router"

// ─── Root ─────────────────────────────────────────────────────────────────────
const rootRoute = createRootRoute({
  component: () => (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Spinner size="lg" /></div>}>
      <Outlet />
    </Suspense>
  ),
})

// ─── Public pages ─────────────────────────────────────────────────────────────
const LoginPage = lazy(() => import("@/features/auth/pages/LoginPage"))

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
})

// ─── Onboarding (requires auth, no org yet) ───────────────────────────────────
const OnboardingPage = lazy(() => import("@/features/onboarding/pages/OnboardingPage"))

/** Wraps onboarding with a subscription guard so suspended users never see the form.
 *  Also re-seeds Dexie org from the API for returning users whose local state was cleared. */
function OnboardingGuarded() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: subscription, isLoading } = useSubscriptionStatus(user?.id)
  const [reseeding, setReseeding] = useState(false)

  useEffect(() => {
    if (!user || isLoading || !subscription || reseeding) return
    if (subscription.effective_status !== "active") return
    // Only re-seed if the user previously completed onboarding in this browser
    if (!localStorage.getItem(`et_onboarded_${user.id}`)) return

    // Returning user with cleared Dexie — re-seed from Neon subscription
    setReseeding(true)
    const reseed = async () => {
      try {
        const subData = await fetchCurrentSubscription()
        if (!subData.subscription) { setReseeding(false); return }
        const now = new Date().toISOString()
        const orgId = generateId()
        await db.organizations.add({
          id: orgId,
          auth_user_id: user.id,
          business_name: subData.subscription.business_name,
          vat_number: subData.subscription.vat_number,
          phone: subData.subscription.phone,
          subscription_status: "active",
          created_at: now,
          updated_at: now,
          sync_status: "pending",
          version: 1,
        })
        await bindOrganizationToAuthUser(orgId, user.id)
        await navigate({ to: "/" })
      } catch {
        setReseeding(false)
      }
    }
    void reseed()
  }, [user, isLoading, subscription, navigate, reseeding])

  if (isLoading || reseeding) {
    return (
      <div className="flex h-screen items-center justify-center" dir="rtl">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Spinner size="lg" />
          <p className="text-sm">جارٍ التحقق من الاشتراك…</p>
        </div>
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
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Spinner size="lg" /></div>}>
      <OnboardingPage />
    </Suspense>
  )
}

const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/onboarding",
  beforeLoad: async () => {
    const session = await authClient.getSession()
    if (!session.data?.user) return redirect({ to: "/login" })
    try {
      const bootstrap = await fetchCustomerBootstrap()
      if (bootstrap.organization.onboarding_completed_at) {
        await hydrateOrganizationFromBootstrap(bootstrap.organization, session.data.user.id)
        return redirect({ to: "/" })
      }
      return
    } catch {
      const hasOrganization = await ensureTenantContextForUser(session.data.user.id)
      if (hasOrganization) return redirect({ to: "/" })
    }
    return
  },
  component: OnboardingGuarded,
})

// ─── Protected app shell ──────────────────────────────────────────────────────
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  beforeLoad: async ({ location }) => {
    const session = await authClient.getSession()
    if (!session.data?.user) {
      return redirect({ to: "/login", search: { redirect: location.href } })
    }
    const hasOrganization = await ensureTenantContextForUser(session.data.user.id)
    if (!hasOrganization) return redirect({ to: "/onboarding" })
    return
  },
  component: AppLayout,
})

const DashboardPage = lazy(() => import("@/features/dashboard/pages/DashboardPage"))
const CustomersPage = lazy(() => import("@/features/customers/pages/CustomersPage"))
const DocumentsPage = lazy(() => import("@/features/documents/pages/DocumentsPage").then((m) => ({ default: m.DocumentsPage })))
const NewDocumentPage = lazy(() => import("@/features/documents/pages/NewDocumentPage").then((m) => ({ default: m.NewDocumentPage })))
const DocumentViewPage = lazy(() => import("@/features/documents/pages/DocumentViewPage").then((m) => ({ default: m.DocumentViewPage })))
const NewReceiptPage = lazy(() => import("@/features/receipts/pages/NewReceiptPage").then((m) => ({ default: m.NewReceiptPage })))
const ReceiptViewPage = lazy(() => import("@/features/receipts/pages/ReceiptViewPage").then((m) => ({ default: m.ReceiptViewPage })))
const SettingsPage = lazy(() => import("@/features/settings/pages/SettingsPage"))
const PurchasesPage = lazy(() => import("@/features/purchases/pages/PurchasesPage").then((m) => ({ default: m.PurchasesPage })))
const ScanPurchasePage = lazy(() => import("@/features/purchases/pages/ScanPurchasePage").then((m) => ({ default: m.ScanPurchasePage })))
const TaxReturnPage = lazy(() => import("@/features/taxReturns/pages/TaxReturnPage").then((m) => ({ default: m.TaxReturnPage })))
const ExpensesPage = lazy(() => import("@/features/expenses/pages/ExpensesPage").then((m) => ({ default: m.ExpensesPage })))
const FinancialStatementsPage = lazy(() => import("@/features/financialStatements/pages/FinancialStatementsPage"))

const dashboardRoute = createRoute({ getParentRoute: () => appRoute, path: "/", component: DashboardPage })
const customersRoute = createRoute({ getParentRoute: () => appRoute, path: "/customers", component: CustomersPage })
const documentsRoute = createRoute({ getParentRoute: () => appRoute, path: "/documents", component: DocumentsPage })
const newDocumentRoute = createRoute({ getParentRoute: () => appRoute, path: "/documents/new", component: NewDocumentPage })
const documentViewRoute = createRoute({ getParentRoute: () => appRoute, path: "/documents/$id", component: DocumentViewPage })
const newReceiptRoute = createRoute({ getParentRoute: () => appRoute, path: "/receipts/new", component: NewReceiptPage })
const receiptViewRoute = createRoute({ getParentRoute: () => appRoute, path: "/receipts/$id", component: ReceiptViewPage })
const documentEditRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/documents/$id/edit",
  component: lazy(() =>
    import("@/features/documents/pages/DocumentEditPage").then((m) => ({ default: m.DocumentEditPage }))
  ),
})
const settingsRoute = createRoute({ getParentRoute: () => appRoute, path: "/settings", component: SettingsPage })
const purchasesRoute = createRoute({ getParentRoute: () => appRoute, path: "/purchases", component: PurchasesPage })
const scanPurchaseRoute = createRoute({ getParentRoute: () => appRoute, path: "/purchases/scan", component: ScanPurchasePage })
const taxReturnRoute = createRoute({ getParentRoute: () => appRoute, path: "/tax-return", component: TaxReturnPage })
const expensesRoute = createRoute({ getParentRoute: () => appRoute, path: "/expenses", component: ExpensesPage })
const financialStatementsRoute = createRoute({ getParentRoute: () => appRoute, path: "/financial-statements", component: FinancialStatementsPage })

// ─── Tree ─────────────────────────────────────────────────────────────────────
const routeTree = rootRoute.addChildren([
  loginRoute,
  onboardingRoute,
  appRoute.addChildren([
    dashboardRoute,
    customersRoute,
    newDocumentRoute,
    documentViewRoute,
    newReceiptRoute,
    receiptViewRoute,
    documentEditRoute,
    documentsRoute,
    purchasesRoute,
    scanPurchaseRoute,
    taxReturnRoute,
    financialStatementsRoute,
    expensesRoute,
    settingsRoute,
  ]),
])

export const router = createRouter({ routeTree })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
