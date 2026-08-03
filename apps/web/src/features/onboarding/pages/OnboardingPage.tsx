import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { StepIndicator } from "../components/StepIndicator"
import { Step1Business } from "../components/Step1Business"
import { Step2Contact } from "../components/Step2Contact"
import { Step3Confirm } from "../components/Step3Confirm"
import { db } from "@/lib/db"
import { generateId } from "@/shared/utils"
import type { Organization } from "@/lib/db"

const STEPS = ["معلومات المنشأة", "بيانات التواصل", "التأكيد"]

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
  const [saving, setSaving] = useState(false)

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
        business_name: data.business_name!,
        vat_number: data.vat_number!,
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
          {step === 0 && <Step1Business defaultValues={data} onNext={handleStep1} />}
          {step === 1 && <Step2Contact defaultValues={data} onBack={() => setStep(0)} onNext={handleStep2} />}
          {step === 2 && (
            <Step3Confirm
              data={data as OnboardingData}
              onBack={() => setStep(1)}
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
