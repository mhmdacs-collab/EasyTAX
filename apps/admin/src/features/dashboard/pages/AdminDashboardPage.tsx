import { useQuery } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api/client"
import type { AdminSummary } from "@/features/subscribers/types"

type SummaryResponse = {
  ok: true
  data: AdminSummary
}

export default function AdminDashboardPage() {
  const summaryQuery = useQuery({
    queryKey: ["admin-summary"],
    queryFn: async () => {
      const response = await apiRequest<SummaryResponse>("/api/v1/admin/summary")
      return response.data
    },
  })

  if (summaryQuery.isLoading) {
    return <div className="rounded-lg border bg-card p-6 text-center">جاري تحميل الإحصائيات...</div>
  }

  if (summaryQuery.isError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-destructive">
        {summaryQuery.error instanceof Error ? summaryQuery.error.message : "تعذر تحميل الإحصائيات"}
      </div>
    )
  }

  const summary = summaryQuery.data
  if (!summary) {
    return <div className="rounded-lg border bg-card p-6 text-center">لا توجد بيانات حالياً.</div>
  }
  const cards = [
    { title: "إجمالي المشتركين", value: summary.total_subscribers },
    { title: "الاشتراكات النشطة", value: summary.active_subscriptions },
    { title: "الاشتراكات المنتهية", value: summary.expired_subscriptions },
    { title: "تنتهي خلال 30 يومًا", value: summary.expiring_in_30_days },
  ]

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">لوحة التحكم</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <article key={card.title} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">{card.title}</p>
            <p className="mt-2 text-2xl font-bold">{card.value}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
