import { Outlet } from "@tanstack/react-router"
import { Sidebar } from "./Sidebar"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  )
}
