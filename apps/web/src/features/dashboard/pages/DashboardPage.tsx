import { useMemo } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { Link } from "@tanstack/react-router"
import { FileText, Users, TrendingUp, Plus, ArrowLeft, Clock } from "lucide-react"
import { db } from "@/lib/db"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Badge } from "@/shared/components/ui/badge"
import { Button } from "@/shared/components/ui/button"
import { Skeleton } from "@/shared/components/ui/skeleton"
import { DocumentTypeBadge } from "@/features/documents/components/DocumentTypeBadge"
import { DocumentStatusBadge } from "@/features/documents/components/DocumentStatusBadge"
import { formatCurrency, formatDate } from "@/shared/utils"

export default function DashboardPage() {
  const { user } = useAuth()
  const org = useLiveQuery(() => db.organizations.toArray().then((r) => r[0]))

  const customerCount = useLiveQuery(
    () => db.customers.filter((c) => !c.deleted_at).count()
  )

  const allDocs = useLiveQuery(() =>
    db.documents
      .orderBy("created_at")
      .reverse()
      .toArray()
      .catch(() => db.documents.orderBy("date").reverse().toArray())
  )

  const stats = useMemo(() => {
    if (!allDocs) return null
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const issued = allDocs.filter((d) => d.status === "issued")
    const thisMonth = issued.filter((d) => d.created_at >= startOfMonth)
    const drafts = allDocs.filter((d) => d.status === "draft")

    return {
      totalRevenue: issued.reduce((s, d) => s + d.total, 0),
      monthRevenue: thisMonth.reduce((s, d) => s + d.total, 0),
      issuedCount: issued.length,
      draftCount: drafts.length,
      totalDocs: allDocs.length,
    }
  }, [allDocs])

  const recentDocs = allDocs?.slice(0, 5)
  const loading = !allDocs || customerCount === undefined

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            مرحباً{user?.name ? `، ${user.name}` : ""}
          </h1>
          {org && <p className="mt-0.5 text-sm text-muted-foreground">{org.business_name}</p>}
        </div>
        <Link to="/documents/new">
          <Button className="gap-2">
            <Plus className="size-4" />
            مستند جديد
          </Button>
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي الإيرادات</CardTitle>
            <TrendingUp className="size-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <div className="text-2xl font-bold tabular-nums">{formatCurrency(stats?.totalRevenue ?? 0)}</div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {loading ? <Skeleton className="h-3 w-20 mt-1" /> : `${formatCurrency(stats?.monthRevenue ?? 0)} هذا الشهر`}
            </p>
          </CardContent>
        </Card>

        {/* Issued docs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">المستندات الصادرة</CardTitle>
            <FileText className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <div className="text-2xl font-bold">{stats?.issuedCount}</div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {loading ? <Skeleton className="h-3 w-24 mt-1" /> : `${stats?.draftCount} مسودة`}
            </p>
          </CardContent>
        </Card>

        {/* Customers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">العملاء</CardTitle>
            <Users className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <div className="text-2xl font-bold">{customerCount}</div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">عميل نشط</p>
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">الاشتراك</CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge variant={org?.subscription_status === "active" ? "success" : "destructive"} className="text-sm">
              {org?.subscription_status === "active" ? "فعّال" : "منتهي"}
            </Badge>
            <p className="mt-2 text-xs text-muted-foreground">
              {org?.subscription_expires_at
                ? `ينتهي ${formatDate(org.subscription_expires_at)}`
                : "بدون انتهاء"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Documents */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">آخر المستندات</h2>
          <Link to="/documents" className="flex items-center gap-1 text-sm text-primary hover:underline">
            عرض الكل
            <ArrowLeft className="size-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2 rounded-lg border p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 rounded-md px-3 py-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : recentDocs && recentDocs.length > 0 ? (
          <div className="rounded-lg border divide-y">
            {recentDocs.map((doc) => (
              <Link
                key={doc.id}
                to="/documents/$id"
                params={{ id: doc.id }}
                className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <span className="w-24 shrink-0 font-mono text-sm font-medium text-primary">
                  {doc.number === "DRAFT" || !doc.number
                    ? <span className="text-muted-foreground italic text-xs">مسودة</span>
                    : doc.number}
                </span>
                <DocumentTypeBadge type={doc.type} />
                <span className="flex-1 truncate text-sm">{doc.customer_name}</span>
                <span className="text-xs text-muted-foreground tabular-nums" dir="ltr">{formatDate(doc.date)}</span>
                <span className="w-24 text-end text-sm font-medium tabular-nums">{formatCurrency(doc.total)}</span>
                <DocumentStatusBadge status={doc.status} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-16 text-center">
            <FileText className="size-12 text-muted-foreground/30" />
            <div>
              <p className="font-semibold">لا توجد مستندات بعد</p>
              <p className="mt-1 text-sm text-muted-foreground">ابدأ بإنشاء أول فاتورتك الضريبية</p>
            </div>
            <Link to="/documents/new">
              <Button className="gap-2">
                <Plus className="size-4" />
                إنشاء فاتورة
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
