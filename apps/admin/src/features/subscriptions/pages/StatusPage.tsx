import { useState } from "react"
import { apiRequest } from "@/lib/api/client"
import type { SubscriptionItem } from "@/features/subscribers/types"

type LookupResponse = { ok: true; data: SubscriptionItem }
type ActionResponse = { ok: true; data: { message: string } }

type PendingAction = "suspend" | "reactivate"

const derivedStatusLabel: Record<SubscriptionItem["derived_status"], string> = {
  active: "نشط",
  expired: "منتهي",
  suspended: "موقوف",
  inactive: "غير نشط",
}

const formatDate = (value: string | null) => {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("ar-SA")
}

const getInitialVat = () => new URLSearchParams(window.location.search).get("vat") ?? ""

export default function StatusPage() {
  const [vatInput, setVatInput] = useState(getInitialVat)
  const [subscription, setSubscription] = useState<SubscriptionItem | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    const vat = vatInput.trim()
    if (!/^\d{15}$/.test(vat)) {
      setError("الرقم الضريبي يجب أن يكون 15 رقماً")
      return
    }
    setError(null)
    setSuccessMsg(null)
    setSubscription(null)
    setPendingAction(null)
    setLookupLoading(true)
    try {
      const res = await apiRequest<LookupResponse>(`/api/v1/admin/subscriptions/${vat}`)
      setSubscription(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر العثور على الاشتراك")
    } finally {
      setLookupLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!subscription || !pendingAction) return
    setError(null)
    setSuccessMsg(null)
    setActionLoading(true)
    try {
      const res = await apiRequest<ActionResponse>(
        `/api/v1/admin/subscriptions/${subscription.vat_number}/${pendingAction}`,
        { method: "POST" },
      )
      setSuccessMsg(res.data.message)
      // Refresh the subscription data
      const updated = await apiRequest<LookupResponse>(
        `/api/v1/admin/subscriptions/${subscription.vat_number}`,
      )
      setSubscription(updated.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تنفيذ العملية")
    } finally {
      setActionLoading(false)
      setPendingAction(null)
    }
  }

  const canSuspend = subscription?.status === "active"
  const canReactivate = subscription
    ? subscription.status === "suspended" || subscription.status === "inactive"
    : false

  return (
    <section className="mx-auto w-full max-w-2xl space-y-4" dir="rtl">
      <h2 className="text-xl font-semibold">إيقاف / إعادة تفعيل الاشتراك</h2>

      {/* Search */}
      <form
        onSubmit={(e) => { void handleLookup(e) }}
        className="flex gap-2"
      >
        <input
          type="text"
          className="flex-1 rounded-md border bg-background px-3 py-2 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="الرقم الضريبي (15 رقمًا)"
          dir="ltr"
          maxLength={15}
          value={vatInput}
          onChange={(e) => { setVatInput(e.target.value) }}
          disabled={lookupLoading}
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60"
          disabled={lookupLoading}
        >
          {lookupLoading ? "جاري البحث..." : "بحث"}
        </button>
      </form>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          {successMsg}
        </div>
      )}

      {/* Subscription details */}
      {subscription && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h3 className="font-semibold">{subscription.business_name}</h3>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">الرقم الضريبي</dt>
            <dd dir="ltr">{subscription.vat_number}</dd>

            <dt className="text-muted-foreground">رقم الجوال</dt>
            <dd dir="ltr">{subscription.phone}</dd>

            <dt className="text-muted-foreground">حالة الاشتراك</dt>
            <dd>{derivedStatusLabel[subscription.derived_status]}</dd>

            <dt className="text-muted-foreground">تاريخ البداية</dt>
            <dd>{formatDate(subscription.starts_at)}</dd>

            <dt className="text-muted-foreground">تاريخ الانتهاء</dt>
            <dd>{formatDate(subscription.expires_at)}</dd>

            <dt className="text-muted-foreground">الأيام المتبقية</dt>
            <dd>{subscription.remaining_days ?? "—"}</dd>
          </dl>

          {/* Show notice for active-but-expired after reactivation */}
          {subscription.status === "active" && subscription.derived_status === "expired" && (
            <p className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
              الاشتراك نشط لكن منتهي الصلاحية. يُنصح بالتجديد.
            </p>
          )}

          {/* Action buttons — always shown, enable/disable based on state */}
          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="button"
              className="rounded-md bg-destructive px-4 py-2 text-sm text-white disabled:opacity-40"
              disabled={!canSuspend || actionLoading}
              onClick={() => { setPendingAction("suspend") }}
            >
              إيقاف الاشتراك
            </button>
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-40"
              disabled={!canReactivate || actionLoading}
              onClick={() => { setPendingAction("reactivate") }}
            >
              إعادة تفعيل الاشتراك
            </button>
          </div>
        </div>
      )}

      {/* Confirmation dialog */}
      {pendingAction && subscription && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" dir="rtl">
          <div className="mx-4 w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold">
              {pendingAction === "suspend" ? "تأكيد إيقاف الاشتراك" : "تأكيد إعادة التفعيل"}
            </h3>
            <p className="mb-6 text-sm text-muted-foreground">
              {pendingAction === "suspend"
                ? `هل أنت متأكد من إيقاف اشتراك "${subscription.business_name}"؟`
                : `هل أنت متأكد من إعادة تفعيل اشتراك "${subscription.business_name}"؟`}
            </p>
            {pendingAction === "reactivate" &&
              subscription.status === "suspended" &&
              subscription.derived_status === "expired" && (
                <p className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                  الاشتراك منتهي الصلاحية. سيكون نشطًا لكن يحتاج إلى تجديد.
                </p>
              )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="rounded-md border px-4 py-2 text-sm disabled:opacity-60"
                disabled={actionLoading}
                onClick={() => { setPendingAction(null) }}
              >
                إلغاء
              </button>
              <button
                type="button"
                className={`rounded-md px-4 py-2 text-sm text-white disabled:opacity-60 ${
                  pendingAction === "suspend" ? "bg-destructive" : "bg-primary"
                }`}
                disabled={actionLoading}
                onClick={() => { void handleConfirm() }}
              >
                {actionLoading ? "جاري التنفيذ..." : "تأكيد"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
