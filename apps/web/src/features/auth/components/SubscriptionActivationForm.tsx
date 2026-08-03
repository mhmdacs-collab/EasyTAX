import { useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { z } from "zod"
import { Link, useNavigate } from "@tanstack/react-router"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { authClient } from "@/lib/auth/client"
import { clearTenantStateIfVatDiff, ensureTenantContextForUser } from "@/lib/session/customerSession"
import { mapLoginError, signInWithEmail, signOutCurrentUser } from "../hooks/useAuth"

// Step 1
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

// Step 2
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

interface CheckResult {
  token: string
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
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [alreadyActivated, setAlreadyActivated] = useState(false)

  const step1Form = useForm<Step1Data>({
    resolver: step1Resolver,
    defaultValues: { vat_number: "", phone: "" },
  })

  const onStep1Submit = async (data: Step1Data) => {
    setErrorMessage(null)
    setAlreadyActivated(false)
    try {
      const res = await fetch(`${API_URL}/api/v1/subscription/check`, {
        method: "POST",
        body: JSON.stringify({ vat_number: data.vat_number, phone: data.phone }),
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      })
      const json = (await res.json()) as
        | { active: true; token: string; vat_number: string; phone: string; business_name: string }
        | { active: false; already_activated?: boolean; message: string }

      if (!json.active) {
        if (json.already_activated) {
          setAlreadyActivated(true)
        } else {
          setErrorMessage(json.message)
        }
        return
      }

      const result: CheckResult = {
        token: json.token,
        vat_number: json.vat_number,
        phone: json.phone,
        business_name: json.business_name,
      }
      setCheckResult(result)
      step2Form.reset({ phone: result.phone, password: "", confirmPassword: "" })
      setStep(2)
    } catch {
      setErrorMessage("الخادم غير متاح حالياً. حاول مرة أخرى لاحقًا.")
    }
  }

  const step2Form = useForm<Step2Data>({
    resolver: step2Resolver,
    defaultValues: { phone: "", password: "", confirmPassword: "" },
  })

  const onStep2Submit = async (data: Step2Data) => {
    if (!checkResult) return
    setErrorMessage(null)
    try {
      const currentSession = await authClient.getSession()
      if (currentSession.data?.user) {
        await signOutCurrentUser()
      }

      const res = await fetch(`${API_URL}/api/v1/subscription/activate`, {
        method: "POST",
        body: JSON.stringify({ token: checkResult.token, phone: data.phone, password: data.password }),
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      })
      const json = (await res.json()) as { success: true; email: string } | { error: string }

      if (!res.ok || "error" in json) {
        setErrorMessage("error" in json ? json.error : "فشل التفعيل")
        return
      }

      await clearTenantStateIfVatDiff(checkResult.vat_number)
      await signInWithEmail(json.email, data.password)
      const session = await authClient.getSession()
      const userId = session.data?.user.id
      if (!userId) {
        throw new Error("تم إنشاء الحساب ولكن تعذر تسجيل الدخول تلقائيًا. يرجى تسجيل الدخول.")
      }
      await ensureTenantContextForUser(userId)
      await navigate({ to: "/onboarding" })
    } catch (err) {
      const currentMessage = err instanceof Error ? err.message : ""
      if (currentMessage === "تم إنشاء الحساب ولكن تعذر تسجيل الدخول تلقائيًا. يرجى تسجيل الدخول.") {
        setErrorMessage(currentMessage)
        return
      }
      setErrorMessage(mapLoginError(err))
    }
  }

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

        {alreadyActivated && (
          <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            تم تفعيل هذا الاشتراك مسبقاً. يرجى{" "}
            <Link to="/login" className="font-medium underline">
              تسجيل الدخول
            </Link>
            .
          </div>
        )}

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

  return (
    <form
      onSubmit={(event) => {
        void step2Form.handleSubmit(onStep2Submit)(event)
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label>اسم المنشأة</Label>
        <Input value={checkResult?.business_name ?? ""} readOnly tabIndex={-1} className="bg-muted/50 cursor-not-allowed" />
      </div>

      <div className="space-y-2">
        <Label>الرقم الضريبي (VAT)</Label>
        <Input value={checkResult?.vat_number ?? ""} readOnly tabIndex={-1} dir="ltr" className="bg-muted/50 cursor-not-allowed" />
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
          رجوع ←
        </Button>
        <Button type="submit" className="flex-1" loading={step2Form.formState.isSubmitting}>
          إنشاء الحساب
        </Button>
      </div>
    </form>
  )
}
