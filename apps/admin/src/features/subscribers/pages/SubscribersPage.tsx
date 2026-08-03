import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { apiRequest } from "@/lib/api/client"
import type { SubscriptionItem } from "../types"

type SubscriptionsResponse = {
  ok: true
  data: SubscriptionItem[]
}

const statusLabel: Record<SubscriptionItem["derived_status"], string> = {
  active: "نشط",
  expired: "منتهي",
  suspended: "موقوف",
  inactive: "غير نشط",
}

const formatDate = (value: string | null) => {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("ar-SA")
}

export default function SubscribersPage() {
  const [search, setSearch] = useState("")
  const queryValue = search.trim()

  const subscribersQuery = useQuery({
    queryKey: ["admin-subscriptions", queryValue],
    queryFn: async () => {
      const params = queryValue ? `?q=${encodeURIComponent(queryValue)}` : ""
      const response = await apiRequest<SubscriptionsResponse>(`/api/v1/admin/subscriptions${params}`)
      return response.data
    },
  })

  const items = useMemo(() => subscribersQuery.data ?? [], [subscribersQuery.data])

  return (
    <section className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">المشتركين</h2>
        <Link to="/subscribers/new" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          + مشترك جديد
        </Link>
      </div>

      <div className="rounded-lg border bg-card p-3">
        <input
          type="text"
          className="w-full rounded-md border bg-background px-3 py-2 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="ابحث باسم المنشأة أو الرقم الضريبي"
          value={search}
          onChange={(event) => { setSearch(event.target.value) }}
        />
      </div>

      {subscribersQuery.isLoading && (
        <div className="rounded-lg border bg-card p-6 text-center">جاري تحميل المشتركين...</div>
      )}

      {subscribersQuery.isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-destructive">
          {subscribersQuery.error instanceof Error ? subscribersQuery.error.message : "تعذر تحميل المشتركين"}
        </div>
      )}

      {!subscribersQuery.isLoading && !subscribersQuery.isError && items.length === 0 && (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">لا توجد اشتراكات مطابقة.</div>
      )}

      {!subscribersQuery.isLoading && !subscribersQuery.isError && items.length > 0 && (
        <>
          <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-right">
                <tr>
                  <th className="px-3 py-2">اسم المنشأة</th>
                  <th className="px-3 py-2">الرقم الضريبي</th>
                  <th className="px-3 py-2">رقم الجوال</th>
                  <th className="px-3 py-2">الباقة</th>
                  <th className="px-3 py-2">الحالة</th>
                  <th className="px-3 py-2">بداية الاشتراك</th>
                  <th className="px-3 py-2">نهاية الاشتراك</th>
                  <th className="px-3 py-2">الأيام المتبقية</th>
                  <th className="px-3 py-2">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{item.business_name}</td>
                    <td className="px-3 py-2" dir="ltr">{item.vat_number}</td>
                    <td className="px-3 py-2" dir="ltr">{item.phone}</td>
                    <td className="px-3 py-2">{item.plan}</td>
                    <td className="px-3 py-2">{statusLabel[item.derived_status]}</td>
                    <td className="px-3 py-2">{formatDate(item.starts_at)}</td>
                    <td className="px-3 py-2">{formatDate(item.expires_at)}</td>
                    <td className="px-3 py-2">{item.remaining_days ?? "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <Link
                          to="/subscriptions/renew"
                          search={{ vat: item.vat_number }}
                          className="rounded px-2 py-1 text-xs bg-primary/10 text-primary hover:bg-primary/20"
                        >
                          تجديد
                        </Link>
                        <Link
                          to="/subscriptions/status"
                          search={{ vat: item.vat_number }}
                          className="rounded px-2 py-1 text-xs bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        >
                          الحالة
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {items.map((item) => (
              <article key={item.id} className="rounded-lg border bg-card p-4">
                <p className="font-semibold">{item.business_name}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">الرقم الضريبي</span>
                  <span dir="ltr">{item.vat_number}</span>
                  <span className="text-muted-foreground">رقم الجوال</span>
                  <span dir="ltr">{item.phone}</span>
                  <span className="text-muted-foreground">الباقة</span>
                  <span>{item.plan}</span>
                  <span className="text-muted-foreground">الحالة</span>
                  <span>{statusLabel[item.derived_status]}</span>
                  <span className="text-muted-foreground">نهاية الاشتراك</span>
                  <span>{formatDate(item.expires_at)}</span>
                  <span className="text-muted-foreground">الأيام المتبقية</span>
                  <span>{item.remaining_days ?? "—"}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Link
                    to="/subscriptions/renew"
                    search={{ vat: item.vat_number }}
                    className="flex-1 rounded-md bg-primary/10 px-3 py-1.5 text-center text-sm text-primary"
                  >
                    تجديد
                  </Link>
                  <Link
                    to="/subscriptions/status"
                    search={{ vat: item.vat_number }}
                    className="flex-1 rounded-md bg-secondary px-3 py-1.5 text-center text-sm"
                  >
                    الحالة
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

