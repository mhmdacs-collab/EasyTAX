import { useState } from "react"
import { apiRequest } from "@/lib/api/client"
import type { SubscriptionItem } from "@/features/subscribers/types"

type LookupResponse = { ok: true; data: SubscriptionItem }
type RenewResponse = {
  ok: true
  data: {
    message: string
    previous_expires_at: string | null
    new_expires_at: string
    remaining_days: number | null
    duration_days: number
  }
}

const DURATION_OPTIONS = [
  { value: 30, label: "30 يومًا" },
  { value: 90, label: "90 يومًا" },
  { value: 180, label: "180 يومًا" },
  { value: 365, label: "365 يومًا" },
] as const

type DurationDays = 30 | 90 | 180 | 365

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

// Read initial VAT from URL search param (pre-filled from subscribers page)
const getInitialVat = () => new URLSearchParams(window.location.search).get("vat") ?? ""

export default function RenewPage() {
  const [vatInput, setVatInput] = useState(getInitialVat)
  const [subscription, setSubscription] = useState<SubscriptionItem | null>(null)
  const [durationDays, setDurationDays] = useState<DurationDays>(30)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [renewLoading, setRenewLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [renewResult, setRenewResult] = useState<RenewResponse["data"] | null>(null)

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    const vat = vatInput.trim()
    if (!/^\d{15}$/.test(vat)) {
      setError("الرقم الضريبي يجب أن يكون 15 رقماً")
      return
    }
    setError(null)
    setSubscription(null)
    setRenewResult(null)
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

  const handleRenew = async () => {
    if (!subscription) return
    setError(null)
    setRenewResult(null)
    setRenewLoading(true)
    try {
      const res = await apiRequest<RenewResponse>(
        `/api/v1/admin/subscriptions/${subscription.vat_number}/renew`,
        { method: "POST", body: JSON.stringify({ duration_days: durationDays }) },
      )
      setRenewResult(res.data)
      // Refresh subscription display with updated data
      const updated = await apiRequest<LookupResponse>(
        `/api/v1/admin/subscriptions/${subscription.vat_number}`,
      )
      setSubscription(updated.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تجديد الاشتراك")
    } finally {
      setRenewLoading(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-2xl space-y-4" dir="rtl">
      <h2 className="text-xl font-semibold">تجديد الاشتراك</h2>

      {/* Search form */}
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

      {/* Renewal result banner */}
      {renewResult && (
        <div className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm space-y-1">
          <p className="font-semibold text-green-800">{renewResult.message}</p>
          <p className="text-green-700">
            تاريخ الانتهاء السابق: {formatDate(renewResult.previous_expires_at)}
          </p>
          <p className="text-green-700">
            المدة المضافة: {renewResult.duration_days} يومًا
          </p>
          <p className="font-medium text-green-800">
            تاريخ الانتهاء الجديد: {formatDate(renewResult.new_expires_at)}
          </p>
          <p className="text-green-700">
            الأيام المتبقية: {renewResult.remaining_days ?? "—"}
          </p>
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

            <dt className="text-muted-foreground">تاريخ بداية الاشتراك</dt>
            <dd>{formatDate(subscription.starts_at)}</dd>

            <dt className="text-muted-foreground">تاريخ انتهاء الاشتراك</dt>
            <dd>{formatDate(subscription.expires_at)}</dd>

            <dt className="text-muted-foreground">الأيام المتبقية</dt>
            <dd>{subscription.remaining_days ?? "—"}</dd>
          </dl>

          {subscription.derived_status === "suspended" && (
            <p className="rounded-md bg-yellow-50 border border-yellow-200 px-3 py-2 text-sm text-yellow-800">
              الاشتراك موقوف. يمكن تجديد تاريخ الانتهاء ولكنه سيظل موقوفًا حتى إعادة التفعيل.
            </p>
          )}

          {/* Duration selection */}
          <div className="space-y-2">
            <p className="text-sm font-medium">مدة التجديد</p>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`rounded-md border px-4 py-2 text-sm transition-colors ${
                    durationDays === opt.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-secondary"
                  }`}
                  onClick={() => { setDurationDays(opt.value) }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-60"
            disabled={renewLoading}
            onClick={() => { void handleRenew() }}
          >
            {renewLoading ? "جاري التجديد..." : "تجديد الاشتراك"}
          </button>
        </div>
      )}
    </section>
  )
}
