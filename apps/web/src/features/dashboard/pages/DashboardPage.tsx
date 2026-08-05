import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { ArrowLeft, Clock, FileText, Plus, TrendingUp, Users } from "lucide-react"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { DocumentStatusBadge } from "@/features/documents/components/DocumentStatusBadge"
import { fetchSettings, listCustomers, listDocuments, type CentralDocument, type SettingsPayload } from "@/lib/platform/api"
import { fetchSubscriptionStatus, type SubscriptionStatus } from "@/lib/subscription/api"
import { Badge } from "@/shared/components/ui/badge"
import { Button } from "@/shared/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Skeleton } from "@/shared/components/ui/skeleton"
import { formatCurrency, formatDate } from "@/shared/utils"

type OrganizationSummary = {
  id?: string
  business_name?: string
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [documents, setDocuments] = useState<CentralDocument[]>()
  const [customerCount, setCustomerCount] = useState<number>()
  const [settings, setSettings] = useState<SettingsPayload>()
  const [subscription, setSubscription] = useState<SubscriptionStatus>()
  const [error, setError] = useState("")

  const loadDashboard = useCallback(async () => {
    setError("")
    try {
      const [documentResult, customerResult, settingsResult, subscriptionResult] = await Promise.all([
        listDocuments(),
        listCustomers(),
        fetchSettings(),
        fetchSubscriptionStatus(),
      ])
      setDocuments(documentResult.documents)
      setCustomerCount(customerResult.customers.length)
      setSettings(settingsResult)
      setSubscription(subscriptionResult)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "تعذر تحميل بيانات لوحة التحكم")
    }
  }, [])

  useEffect(() => { void loadDashboard() }, [loadDashboard])

  const stats = useMemo(() => {
    if (!documents) return null
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const issued = documents.filter((document) => document.status === "issued")
    const thisMonth = issued.filter((document) => new Date(document.issue_date).getTime() >= monthStart)
    return {
      totalRevenue: issued.reduce((sum, document) => sum + Number(document.total), 0),
      monthRevenue: thisMonth.reduce((sum, document) => sum + Number(document.total), 0),
      issuedCount: issued.length,
      draftCount: documents.filter((document) => document.status === "draft").length,
    }
  }, [documents])

  const organization = settings?.organization as OrganizationSummary | undefined
  const recentDocuments = documents?.slice(0, 5)
  const loading = !documents || customerCount === undefined || !settings || !subscription

  if (error) {
    return <div className="m-6 rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center"><p className="font-medium text-destructive">{error}</p><Button variant="outline" className="mt-4" onClick={() => { void loadDashboard() }}>إعادة المحاولة</Button></div>
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">مرحباً{user?.name ? `، ${user.name}` : ""}</h1>
          {organization ? <div className="mt-0.5 space-y-0.5"><p className="text-sm text-muted-foreground">{organization.business_name}</p><p className="text-xs text-muted-foreground" dir="ltr">Organization ID: <span className="select-all font-mono">{organization.id}</span></p></div> : null}
        </div>
        <Button asChild className="gap-2"><Link to="/documents/new"><Plus className="size-4" />فاتورة جديدة</Link></Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="إجمالي الفواتير الصادرة" icon={<TrendingUp className="size-4 text-green-500" />} loading={loading} value={formatCurrency(stats?.totalRevenue ?? 0)} detail={`${formatCurrency(stats?.monthRevenue ?? 0)} هذا الشهر`} />
        <StatCard title="الفواتير الصادرة" icon={<FileText className="size-4 text-primary" />} loading={loading} value={String(stats?.issuedCount ?? 0)} detail={`${stats?.draftCount ?? 0} مسودة`} />
        <StatCard title="العملاء" icon={<Users className="size-4 text-blue-500" />} loading={loading} value={String(customerCount ?? 0)} detail="عميل مسجل" />
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">الاشتراك</CardTitle><Clock className="size-4 text-muted-foreground" /></CardHeader><CardContent>{!subscription ? <><Skeleton className="h-7 w-20" /><Skeleton className="mt-2 h-3 w-28" /></> : <><Badge variant={subscription.effective_status === "active" ? "success" : "destructive"} className="text-sm">{subscriptionLabel(subscription.effective_status)}</Badge><p className="mt-2 text-xs text-muted-foreground">{subscription.expires_at ? `ينتهي ${formatDate(subscription.expires_at)}` : "لا يوجد تاريخ انتهاء"}</p></>}</CardContent></Card>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">آخر الفواتير</h2><Link to="/documents" className="flex items-center gap-1 text-sm text-primary hover:underline">عرض الكل<ArrowLeft className="size-3.5" /></Link></div>
        {loading ? <LoadingRows /> : recentDocuments?.length ? (
          <div className="divide-y rounded-lg border">{recentDocuments.map((document) => (
            <Link key={document.id} to="/documents/$id" params={{ id: document.id }} className="grid grid-cols-[1fr_auto] gap-2 px-4 py-3 transition-colors hover:bg-muted/50 sm:grid-cols-[7rem_1fr_7rem_7rem_auto] sm:items-center">
              <span className="font-mono text-sm font-medium text-primary">{document.status === "draft" ? <span className="text-xs italic text-muted-foreground">مسودة</span> : document.number}</span>
              <span className="truncate text-sm">{document.customer_snapshot.name || "عميل غير محدد"}</span>
              <span className="hidden text-xs text-muted-foreground sm:block" dir="ltr">{formatDate(document.issue_date)}</span>
              <span className="hidden text-end text-sm font-medium tabular-nums sm:block">{formatCurrency(Number(document.total))}</span>
              <DocumentStatusBadge status={document.status} />
            </Link>
          ))}</div>
        ) : <EmptyDocuments />}
      </section>
    </div>
  )
}

function StatCard({ title, icon, loading, value, detail }: { title:string; icon:ReactNode; loading:boolean; value:string; detail:string }) {
  return <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>{icon}</CardHeader><CardContent>{loading ? <Skeleton className="h-7 w-32" /> : <div className="text-2xl font-bold tabular-nums">{value}</div>}<p className="mt-1 text-xs text-muted-foreground">{loading ? <Skeleton className="mt-1 h-3 w-20" /> : detail}</p></CardContent></Card>
}

function LoadingRows() {
  return <div className="space-y-2 rounded-lg border p-2">{Array.from({ length:4 }).map((_, index) => <div key={index} className="flex items-center gap-4 rounded-md px-3 py-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-4 flex-1" /><Skeleton className="h-4 w-16" /></div>)}</div>
}

function EmptyDocuments() {
  return <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-16 text-center"><FileText className="size-12 text-muted-foreground/30" /><div><p className="font-semibold">لا توجد فواتير بعد</p><p className="mt-1 text-sm text-muted-foreground">ابدأ بإنشاء أول فاتورة ضريبية</p></div><Button asChild className="gap-2"><Link to="/documents/new"><Plus className="size-4" />إنشاء فاتورة</Link></Button></div>
}

function subscriptionLabel(status: SubscriptionStatus["effective_status"]) {
  if (status === "active") return "فعّال"
  if (status === "expired") return "منتهي"
  if (status === "suspended") return "موقوف"
  return "غير فعّال"
}
