import { Link, Outlet, useNavigate } from "@tanstack/react-router"
import { authClient } from "@/lib/auth/client"

export function AdminLayout() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await authClient.signOut()
    await navigate({ to: "/login" })
  }

  return (
    <div dir="rtl" className="min-h-screen bg-muted/30">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-lg font-bold">EasyTAX Admin</h1>
            <p className="text-xs text-muted-foreground">إدارة الاشتراكات</p>
          </div>
          <nav className="flex items-center gap-2 text-sm">
            <Link to="/" className="rounded-md px-3 py-2 hover:bg-secondary">الرئيسية</Link>
            <Link to="/subscribers" className="rounded-md px-3 py-2 hover:bg-secondary">المشتركين</Link>
            <Link to="/subscribers/new" className="rounded-md px-3 py-2 hover:bg-secondary">مشترك جديد</Link>
            <button
              type="button"
              className="rounded-md bg-secondary px-3 py-2"
              onClick={() => { void handleLogout() }}
            >
              خروج
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  )
}
