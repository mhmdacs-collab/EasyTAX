import { useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { z } from "zod"
import { Link, useNavigate } from "@tanstack/react-router"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { authClient } from "@/lib/auth/client"

// ─── Step 1 ───────────────────────────────────────────────────────────────────
const step1Schema = z.object({
  vat_number: z
    .string()
    .length(15, "الرقم الضريبي يجب أن يكون 15 رقماً")
    .regex(/^\d+$/, "أرقام فقط"),
  phone: z.string().min(9, "أدخل رقم جوال صالح"),
})
type Step1Data = z.infer<typeof step1Schema>

const step1Resolver: Resolver<Step1Data> = (values) => {
  const parsed = step1Schema.safeParse(values)
  if (parsed.success) return { values: parsed.data, errors: {} }
  const errors: Record<string, { type: string; message: string }> = {}
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as keyof Step1Data
    if (!errors[field]) errors[field] = { type: "validate", message: issue.message }
  }
  return { values: {}, errors }
}

// ─── Step 2 ───────────────────────────────────────────────────────────────────
const step2Schema = z
  .object({
    phone: z.string().min(9, "أدخل رقم جوال صالح"),
    password: z.string().min(8, "8 أحرف على الأقل"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "كلمات المرور غير متطابقة",
    path: ["confirmPassword"],
  })
type Step2Data = z.infer<typeof step2Schema>

const step2Resolver: Resolver<Step2Data> = (values) => {
  const parsed = step2Schema.safeParse(values)
  if (parsed.success) return { values: parsed.data, errors: {} }
  const errors: Record<string, { type: string; message: string }> = {}
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as keyof Step2Data
    if (!errors[field]) errors[field] = { type: "validate", message: issue.message }
  }
  return { values: {}, errors }
}

// ─── Subscription response from API ───────────────────────────────────────────
interface SubscriptionResult {
  vat_number: string
  phone: string
  business_name: string
}

const API_URL = (() => {
  const v: unknown = Reflect.get(import.meta.env, "VITE_API_URL")
  return typeof v === "string" && v.length > 0 ? v : "http://localhost:3000"
})()

export function SubscriptionActivationForm() {
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2>(1)
  const [subscription, setSubscription] = useState<SubscriptionResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // ── Step 1 form ─────────────────────────────────────────────────────────────
  const step1Form = useForm<Step1Data>({
    resolver: step1Resolver,
    defaultValues: { vat_number: "", phone: "" },
  })

  const onStep1Submit = async (data: Step1Data) => {
    setErrorMessage(null)
    try {
      const res = await fetch(`${API_URL}/api/v1/subscription/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vat_number: data.vat_number, phone: data.phone }),
        credentials: "include",
      })
      const json = (await res.json()) as
        | { active: true; vat_number: string; phone: string; business_name: string }
        | { active: false; message: string }

      if (!json.active) {
        setErrorMessage(json.message)
        return
      }

      const result = { vat_number: json.vat_number, phone: json.phone, business_name: json.business_name }
      setSubscription(result)
      step2Form.reset({ phone: result.phone, password: "", confirmPassword: "" })
      setStep(2)
    } catch {
      setErrorMessage("تعذر الاتصال بالخادم، حاول مجدداً.")
    }
  }

  // ── Step 2 form ─────────────────────────────────────────────────────────────
  const step2Form = useForm<Step2Data>({
    resolver: step2Resolver,
    defaultValues: { phone: "", password: "", confirmPassword: "" },
  })

  const onStep2Submit = async (data: Step2Data) => {
    if (!subscription) return
    setErrorMessage(null)
    try {
      const email = `${subscription.vat_number}@easytax.local`
      const result = await authClient.signUp.email({
        name: subscription.business_name,
        email,
        password: data.password,
      })
      if (result.error) {
        setErrorMessage(result.error.message ?? "فشل إنشاء الحساب")
        return
      }

      // Store subscription data for onboarding pre-fill (consumed once)
      try {
        sessionStorage.setItem(
          "easytax_subscription",
          JSON.stringify({
            business_name: subscription.business_name,
            vat_number: subscription.vat_number,
            phone: data.phone,
          }),
        )
      } catch {
        // sessionStorage unavailable — onboarding will start blank
      }

      await navigate({ to: "/onboarding" })
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "حدث خطأ، حاول مجدداً")
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <form
        onSubmit={(event) => {
          void step1Form.handleSubmit(onStep1Submit)(event)
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="vat_number">الرقم الضريبي (VAT)</Label>
          <Input
            id="vat_number"
            placeholder="300000000000003"
            dir="ltr"
            maxLength={15}
            autoComplete="off"
            {...step1Form.register("vat_number")}
          />
          {step1Form.formState.errors.vat_number && (
            <p className="text-xs text-destructive">{step1Form.formState.errors.vat_number.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">رقم الجوال</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="0500000000"
            dir="ltr"
            autoComplete="tel"
            {...step1Form.register("phone")}
          />
          {step1Form.formState.errors.phone && (
            <p className="text-xs text-destructive">{step1Form.formState.errors.phone.message}</p>
          )}
        </div>

        {errorMessage && (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{errorMessage}</div>
        )}

        <Button type="submit" className="w-full" loading={step1Form.formState.isSubmitting}>
          التحقق من الاشتراك
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          لديك حساب بالفعل؟{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            تسجيل الدخول
          </Link>
        </p>
      </form>
    )
  }

  // Step 2
  return (
    <form
      onSubmit={(event) => {
        void step2Form.handleSubmit(onStep2Submit)(event)
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label>اسم المنشأة</Label>
        <Input value={subscription?.business_name ?? ""} readOnly disabled className="bg-muted/50" />
      </div>

      <div className="space-y-2">
        <Label>الرقم الضريبي (VAT)</Label>
        <Input value={subscription?.vat_number ?? ""} readOnly disabled dir="ltr" className="bg-muted/50" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone2">رقم الجوال</Label>
        <Input
          id="phone2"
          type="tel"
          dir="ltr"
          autoComplete="tel"
          {...step2Form.register("phone")}
        />
        {step2Form.formState.errors.phone && (
          <p className="text-xs text-destructive">{step2Form.formState.errors.phone.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">كلمة المرور</Label>
        <Input
          id="password"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          {...step2Form.register("password")}
        />
        {step2Form.formState.errors.password && (
          <p className="text-xs text-destructive">{step2Form.formState.errors.password.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
        <Input
          id="confirmPassword"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          {...step2Form.register("confirmPassword")}
        />
        {step2Form.formState.errors.confirmPassword && (
          <p className="text-xs text-destructive">{step2Form.formState.errors.confirmPassword.message}</p>
        )}
      </div>

      {errorMessage && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{errorMessage}</div>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => {
            setStep(1)
            setErrorMessage(null)
          }}
        >
          ← رجوع
        </Button>
        <Button type="submit" className="flex-1" loading={step2Form.formState.isSubmitting}>
          إنشاء الحساب
        </Button>
      </div>
    </form>
  )
}
