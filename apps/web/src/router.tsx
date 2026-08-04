import { createRouter, createRoute, createRootRoute, redirect } from "@tanstack/react-router"
import { Outlet } from "@tanstack/react-router"
import { lazy, Suspense } from "react"
import { authClient } from "@/lib/auth/client"
import { AppLayout } from "@/layouts/AppLayout"
import { ensureTenantContextForUser } from "@/lib/session/customerSession"
import { Spinner } from "@/shared/components/ui/spinner"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { useSubscriptionStatus } from "@/lib/subscription/useSubscriptionStatus"
import { BlockedSubscriptionPage } from "@/features/subscription/BlockedSubscriptionPage"

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
const RegisterPage = lazy(() => import("@/features/auth/pages/SubscriptionActivationPage"))

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  component: RegisterPage,
})

// ─── Onboarding (requires auth, no org yet) ───────────────────────────────────
const OnboardingPage = lazy(() => import("@/features/onboarding/pages/OnboardingPage"))

/** Wraps onboarding with a subscription guard so suspended users never see the form */
function OnboardingGuarded() {
  const { user } = useAuth()
  const { data: subscription, isLoading } = useSubscriptionStatus(user?.id)

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
    const hasOrganization = await ensureTenantContextForUser(session.data.user.id)
    if (hasOrganization) return redirect({ to: "/" })
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
const SettingsPage = lazy(() => import("@/features/settings/pages/SettingsPage"))

const dashboardRoute = createRoute({ getParentRoute: () => appRoute, path: "/", component: DashboardPage })
const customersRoute = createRoute({ getParentRoute: () => appRoute, path: "/customers", component: CustomersPage })
const documentsRoute = createRoute({ getParentRoute: () => appRoute, path: "/documents", component: DocumentsPage })
const newDocumentRoute = createRoute({ getParentRoute: () => appRoute, path: "/documents/new", component: NewDocumentPage })
const documentViewRoute = createRoute({ getParentRoute: () => appRoute, path: "/documents/$id", component: DocumentViewPage })
const documentEditRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/documents/$id/edit",
  component: lazy(() =>
    import("@/features/documents/pages/DocumentEditPage").then((m) => ({ default: m.DocumentEditPage }))
  ),
})
const settingsRoute = createRoute({ getParentRoute: () => appRoute, path: "/settings", component: SettingsPage })

// ─── Tree ─────────────────────────────────────────────────────────────────────
const routeTree = rootRoute.addChildren([
  loginRoute,
  registerRoute,
  onboardingRoute,
  appRoute.addChildren([
    dashboardRoute,
    customersRoute,
    newDocumentRoute,
    documentViewRoute,
    documentEditRoute,
    documentsRoute,
    settingsRoute,
  ]),
])

export const router = createRouter({ routeTree })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
