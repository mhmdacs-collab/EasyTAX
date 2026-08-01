import { createRouter, createRoute, createRootRoute } from "@tanstack/react-router";
import { Outlet } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

// ─── Root Route ───────────────────────────────────────────────────────────────

const rootRoute = createRootRoute({
  component: () => (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">جاري التحميل...</div>}>
      <Outlet />
    </Suspense>
  ),
});

// ─── Lazy-loaded Pages ────────────────────────────────────────────────────────

const LoginPage = lazy(() => import("@/features/auth/pages/LoginPage"));
const DashboardPage = lazy(() => import("@/features/dashboard/pages/DashboardPage"));
const CustomersPage = lazy(() => import("@/features/customers/pages/CustomersPage"));
const DocumentsPage = lazy(() => import("@/features/documents/pages/DocumentsPage"));
const SettingsPage = lazy(() => import("@/features/settings/pages/SettingsPage"));

// ─── Route Definitions ────────────────────────────────────────────────────────

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
});

const customersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/customers",
  component: CustomersPage,
});

const documentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/documents",
  component: DocumentsPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

// ─── Router ───────────────────────────────────────────────────────────────────

const routeTree = rootRoute.addChildren([
  loginRoute,
  dashboardRoute,
  customersRoute,
  documentsRoute,
  settingsRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
