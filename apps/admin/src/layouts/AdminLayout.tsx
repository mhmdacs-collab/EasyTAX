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
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            <Link to="/" className="rounded-md px-3 py-2 hover:bg-secondary [&.active]:bg-secondary [&.active]:font-medium">الرئيسية</Link>
            <Link to="/subscribers" className="rounded-md px-3 py-2 hover:bg-secondary [&.active]:bg-secondary [&.active]:font-medium">المشتركين</Link>
            <Link to="/subscribers/new" className="rounded-md px-3 py-2 hover:bg-secondary [&.active]:bg-secondary [&.active]:font-medium">مشترك جديد</Link>
            <Link to="/subscriptions/renew" search={{ vat: "" }} className="rounded-md px-3 py-2 hover:bg-secondary [&.active]:bg-secondary [&.active]:font-medium">تجديد الاشتراك</Link>
            <Link to="/subscriptions/status" search={{ vat: "" }} className="rounded-md px-3 py-2 hover:bg-secondary [&.active]:bg-secondary [&.active]:font-medium">إيقاف/إعادة تفعيل</Link>
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

