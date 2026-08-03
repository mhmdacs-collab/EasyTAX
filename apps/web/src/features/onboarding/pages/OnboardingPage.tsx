import { useState, useEffect } from "react"
import { useNavigate } from "@tanstack/react-router"
import { StepIndicator } from "../components/StepIndicator"
import { Step1Business } from "../components/Step1Business"
import { Step2Contact } from "../components/Step2Contact"
import { Step3Confirm } from "../components/Step3Confirm"
import { Spinner } from "@/shared/components/ui/spinner"
import { db } from "@/lib/db"
import { generateId } from "@/shared/utils"
import type { Organization } from "@/lib/db"

const STEPS = ["معلومات المنشأة", "بيانات التواصل", "التأكيد"]

const API_URL = (() => {
  const v: unknown = Reflect.get(import.meta.env, "VITE_API_URL")
  return typeof v === "string" && v.length > 0 ? v : "http://localhost:3000"
})()

export interface OnboardingData {
  business_name: string
  vat_number: string
  commercial_registration?: string
  city?: string
  district?: string
  street?: string
  postal_code?: string
  phone?: string
  email?: string
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [data, setData] = useState<Partial<OnboardingData>>({})
  const [lockedFields, setLockedFields] = useState<Array<"business_name" | "vat_number">>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/subscription/me`, { credentials: "include" })
        if (res.ok) {
          const json = (await res.json()) as {
            subscription: { business_name: string; vat_number: string; phone: string } | null
          }
          if (json.subscription) {
            setData({
              business_name: json.subscription.business_name,
              vat_number: json.subscription.vat_number,
              phone: json.subscription.phone,
            })
            setLockedFields(["business_name", "vat_number"])
          }
        }
      } catch {
        // Network error — proceed with blank data
      } finally {
        setLoading(false)
      }
    }
    void fetchSubscription()
  }, [])

  const handleStep1 = (values: Pick<OnboardingData, "business_name" | "vat_number" | "commercial_registration">) => {
    setData((prev) => ({ ...prev, ...values }))
    setStep(1)
  }

  const handleStep2 = (values: Pick<OnboardingData, "city" | "district" | "street" | "postal_code" | "phone" | "email">) => {
    setData((prev) => ({ ...prev, ...values }))
    setStep(2)
  }

  const handleConfirm = async () => {
    setSaving(true)
    try {
      const now = new Date().toISOString()
      const org: Organization = {
        id: generateId(),
        business_name: data.business_name ?? "",
        vat_number: data.vat_number ?? "",
        commercial_registration: data.commercial_registration,
        city: data.city,
        district: data.district,
        street: data.street,
        postal_code: data.postal_code,
        phone: data.phone,
        email: data.email,
        subscription_status: "active",
        created_at: now,
        updated_at: now,
        sync_status: "pending",
        version: 1,
      }
      await db.organizations.add(org)
      await navigate({ to: "/" })
    } catch (err) {
      console.error("Failed to save organization:", err)
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground text-lg font-bold select-none">
            ET
          </div>
          <h1 className="text-2xl font-bold">إعداد المنشأة</h1>
          <p className="mt-1 text-sm text-muted-foreground">أدخل بيانات منشأتك لبدء إصدار المستندات</p>
        </div>

        <StepIndicator steps={STEPS} currentStep={step} />

        <div className="rounded-xl border bg-card p-8 shadow-sm">
          {step === 0 && <Step1Business defaultValues={data} locked={lockedFields} onNext={handleStep1} />}
          {step === 1 && <Step2Contact defaultValues={data} onBack={() => { setStep(0) }} onNext={handleStep2} />}
          {step === 2 && (
            <Step3Confirm
              data={data as OnboardingData}
              onBack={() => { setStep(1) }}
              onConfirm={() => {
                void handleConfirm()
              }}
              saving={saving}
            />
          )}
        </div>
      </div>
    </div>
  )
}
