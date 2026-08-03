import { useState, type FormEvent } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api/client"

type CreateSubscriptionResponse = {
  ok: true
  data: {
    message: string
    subscription: unknown
  }
}

const durationOptions = [
  { value: 30, label: "30 يومًا" },
  { value: 90, label: "90 يومًا" },
  { value: 180, label: "180 يومًا" },
  { value: 365, label: "365 يومًا" },
] as const

export default function NewSubscriberPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [businessName, setBusinessName] = useState("")
  const [vatNumber, setVatNumber] = useState("")
  const [phone, setPhone] = useState("")
  const [plan, setPlan] = useState("basic")
  const [durationDays, setDurationDays] = useState<30 | 90 | 180 | 365>(30)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    const normalizedVat = vatNumber.trim()
    const normalizedPhone = phone.trim()
    if (!/^\d{15}$/.test(normalizedVat)) {
      setError("الرقم الضريبي يجب أن يكون 15 رقماً")
      return
    }
    if (!/^\d{9,15}$/.test(normalizedPhone)) {
      setError("رقم الجوال غير صالح")
      return
    }

    setLoading(true)
    try {
      const response = await apiRequest<CreateSubscriptionResponse>("/api/v1/admin/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          business_name: businessName.trim(),
          vat_number: normalizedVat,
          phone: normalizedPhone,
          plan: plan.trim(),
          duration_days: durationDays,
        }),
      })
      setSuccess(response.data.message)
      await queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] })
      await navigate({ to: "/subscribers" })
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إنشاء الاشتراك")
      setLoading(false)
      return
    }
    setLoading(false)
  }

  return (
    <section className="mx-auto w-full max-w-2xl space-y-4" dir="rtl">
      <h2 className="text-xl font-semibold">إضافة مشترك جديد</h2>
      <form onSubmit={(event) => { void handleSubmit(event) }} className="space-y-4 rounded-xl border bg-card p-5">
        <div className="space-y-2">
          <label htmlFor="business_name" className="text-sm font-medium">اسم المنشأة</label>
          <input
            id="business_name"
            value={businessName}
            onChange={(event) => { setBusinessName(event.target.value) }}
            className="w-full rounded-md border bg-background px-3 py-2 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="vat_number" className="text-sm font-medium">الرقم الضريبي</label>
          <input
            id="vat_number"
            value={vatNumber}
            onChange={(event) => { setVatNumber(event.target.value) }}
            className="w-full rounded-md border bg-background px-3 py-2 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            dir="ltr"
            maxLength={15}
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="phone" className="text-sm font-medium">رقم الجوال</label>
          <input
            id="phone"
            value={phone}
            onChange={(event) => { setPhone(event.target.value) }}
            className="w-full rounded-md border bg-background px-3 py-2 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            dir="ltr"
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="plan" className="text-sm font-medium">الباقة</label>
          <input
            id="plan"
            value={plan}
            onChange={(event) => { setPlan(event.target.value) }}
            className="w-full rounded-md border bg-background px-3 py-2 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="duration" className="text-sm font-medium">مدة الاشتراك</label>
          <select
            id="duration"
            value={durationDays}
            onChange={(event) => { setDurationDays(Number(event.target.value) as 30 | 90 | 180 | 365) }}
            className="w-full rounded-md border bg-background px-3 py-2 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          >
            {durationOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {error && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
        {success && <div className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{success}</div>}

        <button
          type="submit"
          className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "جاري الحفظ..." : "حفظ الاشتراك"}
        </button>
      </form>
    </section>
  )
}
