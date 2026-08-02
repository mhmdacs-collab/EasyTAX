import { useLiveQuery } from "dexie-react-hooks"
import { FileText, Users, ShieldCheck } from "lucide-react"
import { db } from "@/lib/db"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Badge } from "@/shared/components/ui/badge"
import { formatCurrency } from "@/shared/utils"

export default function DashboardPage() {
  const { user } = useAuth()

  const org = useLiveQuery(() => db.organizations.toArray().then((r) => r[0]))
  const customerCount = useLiveQuery(() => db.customers.where("deleted_at").equals("").count())
  const documentCount = useLiveQuery(() => db.documents.count())
  const issuedDocs = useLiveQuery(() => db.documents.where("status").equals("issued").toArray())

  const totalRevenue = issuedDocs?.reduce((sum, d) => sum + d.total, 0) ?? 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          مرحباً{user?.name ? `، ${user.name}` : ""}
        </h1>
        {org && <p className="mt-0.5 text-sm text-muted-foreground">{org.business_name}</p>}
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">المستندات</CardTitle>
            <FileText className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documentCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">إجمالي المستندات</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">العملاء</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customerCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">عملاء نشطون</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">الاشتراك</CardTitle>
            <ShieldCheck className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge variant={org?.subscription_status === "active" ? "success" : "destructive"}>
              {org?.subscription_status === "active" ? "فعّال" : "منتهي"}
            </Badge>
            <p className="mt-1 text-xs text-muted-foreground">
              الإيرادات الصادرة: {formatCurrency(totalRevenue)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Empty state */}
      {documentCount === 0 && (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <FileText className="mx-auto mb-4 size-10 text-muted-foreground/50" />
          <h3 className="font-semibold">لا توجد مستندات بعد</h3>
          <p className="mt-1 text-sm text-muted-foreground">ابدأ بإنشاء أول فاتورة ضريبية</p>
        </div>
      )}
    </div>
  )
}
