import { createRootRoute, createRoute, createRouter, Outlet, redirect } from "@tanstack/react-router"
import { Suspense, lazy } from "react"
import { apiRequest } from "@/lib/api/client"
import { AdminLayout } from "@/layouts/AdminLayout"

type SummaryResponse = {
  ok: true
  data: {
    total_subscribers: number
    active_subscriptions: number
    expired_subscriptions: number
    expiring_in_30_days: number
  }
}

const rootRoute = createRootRoute({
  component: () => (
    <Suspense fallback={<div className="p-6 text-center">جاري التحميل...</div>}>
      <Outlet />
    </Suspense>
  ),
})

const LoginPage = lazy(() => import("@/features/auth/pages/AdminLoginPage"))
const DashboardPage = lazy(() => import("@/features/dashboard/pages/AdminDashboardPage"))
const SubscribersPage = lazy(() => import("@/features/subscribers/pages/SubscribersPage"))
const NewSubscriberPage = lazy(() => import("@/features/subscribers/pages/NewSubscriberPage"))

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
})

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "admin-app",
  beforeLoad: async ({ location }) => {
    try {
      await apiRequest<SummaryResponse>("/api/v1/admin/summary")
      return
    } catch {
      return redirect({ to: "/login", search: { redirect: location.href } })
    }
  },
  component: AdminLayout,
})

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/",
  component: DashboardPage,
})

const subscribersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/subscribers",
  component: SubscribersPage,
})

const newSubscriberRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/subscribers/new",
  component: NewSubscriberPage,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  appRoute.addChildren([
    dashboardRoute,
    subscribersRoute,
    newSubscriberRoute,
  ]),
])

export const router = createRouter({ routeTree })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
