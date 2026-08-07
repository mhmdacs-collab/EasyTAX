import { Link, useRouterState } from "@tanstack/react-router"
import { LayoutDashboard, Users, FileText, Settings, LogOut, ChevronRight, ChevronLeft, ShoppingCart, Landmark, WalletCards, ChartNoAxesCombined } from "lucide-react"
import { useState } from "react"
import { cn } from "@/shared/utils"
import { Button } from "@/shared/components/ui/button"
import { useAuth } from "@/features/auth/hooks/useAuth"

const navItems = [
  { to: "/" as const, label: "لوحة التحكم", icon: LayoutDashboard },
  { to: "/documents" as const, label: "المستندات", icon: FileText },
  { to: "/purchases" as const, label: "المشتريات الضريبية", icon: ShoppingCart },
  { to: "/expenses" as const, label: "المصروفات", icon: WalletCards },
  { to: "/tax-return" as const, label: "الإقرار الضريبي", icon: Landmark },
  { to: "/financial-statements" as const, label: "القوائم المالية", icon: ChartNoAxesCombined },
  { to: "/customers" as const, label: "العملاء", icon: Users },
  { to: "/settings" as const, label: "الإعدادات", icon: Settings },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { signOut, user } = useAuth()
  const { location } = useRouterState()

  return (
    <aside
      className={cn(
        "relative flex h-screen flex-col border-e bg-card transition-[width] duration-300",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-4">
        {!collapsed && <span className="font-bold text-lg tracking-tight">EasyTAX</span>}
      </div>

      {/* Toggle button */}
      <button
        onClick={() => { setCollapsed(!collapsed) }}
        className="absolute -end-3 top-16 z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-accent"
      >
        {collapsed
          ? <ChevronLeft className="size-3" />
          : <ChevronRight className="size-3" />}
      </button>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {navItems.map(({ to, label, icon: Icon }) => {
          const isActive = location.pathname === to
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
              title={collapsed ? label : undefined}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t p-2">
        {!collapsed && user && (
          <p className="truncate px-3 py-1 text-xs text-muted-foreground">{user.email}</p>
        )}
        <Button
          variant="ghost"
          className={cn(
            "w-full gap-3 text-sm text-muted-foreground hover:text-destructive",
            collapsed ? "justify-center px-0" : "justify-start"
          )}
          onClick={() => {
            void signOut()
          }}
          title={collapsed ? "تسجيل الخروج" : undefined}
        >
          <LogOut className="size-4 shrink-0" />
          {!collapsed && "تسجيل الخروج"}
        </Button>
      </div>
    </aside>
  )
}
