import { useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { z } from "zod"
import { useNavigate } from "@tanstack/react-router"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { useAuth } from "../hooks/useAuth"
import { authClient } from "@/lib/auth/client"
import { clearTenantStateIfVatDiff, ensureTenantContextForUser, hydrateOrganizationFromBootstrap } from "@/lib/session/customerSession"
import { fetchCustomerBootstrap } from "@/lib/subscription/api"

const schema = z.object({
  vat_number: z
    .string()
    .trim()
    .min(1, "الرقم الضريبي مطلوب.")
    .length(15, "يجب أن يتكون الرقم الضريبي من 15 رقمًا.")
    .regex(/^\d+$/, "يجب أن يتكون الرقم الضريبي من 15 رقمًا."),
  password: z
    .string()
    .min(1, "كلمة المرور مطلوبة.")
    .min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
})

type FormData = z.infer<typeof schema>

const resolver: Resolver<FormData> = (values) => {
  const parsed = schema.safeParse(values)
  if (parsed.success) {
    return { values: parsed.data, errors: {} }
  }

  const errors: Record<string, { type: string; message: string }> = {}
  for (const issue of parsed.error.issues) {
    const field = issue.path[0]
    if ((field === "vat_number" || field === "password") && !errors[field]) {
      errors[field] = {
        type: "validate",
        message: issue.message,
      }
    }
  }

  return { values: {}, errors }
}

export function LoginForm() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { register, handleSubmit, formState } = useForm<FormData>({
    resolver,
    defaultValues: { vat_number: "", password: "" },
  })

  const onSubmit = async (data: FormData) => {
    try {
      setErrorMessage(null)
      // Normalize VAT: trim spaces and ensure @easytax.local is not doubled
      const normalizedVat = data.vat_number.trim()
      const email = normalizedVat.includes("@")
        ? normalizedVat
        : `${normalizedVat}@easytax.local`
      await signIn(email, data.password)
      await clearTenantStateIfVatDiff(normalizedVat)
      const session = await authClient.getSession()
      const userId = session.data?.user.id
      if (!userId) {
        throw new Error("حدث خطأ غير متوقع. حاول مرة أخرى.")
      }
      try {
        const bootstrap = await fetchCustomerBootstrap()
        if (!bootstrap.organization.onboarding_completed_at) {
          await navigate({ to: "/onboarding" })
          return
        }
        await hydrateOrganizationFromBootstrap(bootstrap.organization, userId)
        await navigate({ to: "/" })
      } catch {
        const hasOrganization = await ensureTenantContextForUser(userId)
        await navigate({ to: hasOrganization ? "/" : "/onboarding" })
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "حدث خطأ، حاول مجدداً")
    }
  }

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(onSubmit)(event)
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="vat_number">الرقم الضريبي (VAT)</Label>
        <Input
          id="vat_number"
          placeholder="أدخل الرقم الضريبي"
          dir="ltr"
          autoComplete="username"
          maxLength={15}
          {...register("vat_number")}
        />
        {formState.errors.vat_number && (
          <p className="text-xs text-destructive">{formState.errors.vat_number.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">كلمة المرور</Label>
        <Input id="password" type="password" dir="ltr" autoComplete="current-password" {...register("password")} />
        {formState.errors.password && <p className="text-xs text-destructive">{formState.errors.password.message}</p>}
      </div>

      {errorMessage && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{errorMessage}</div>
      )}

      <Button type="submit" className="w-full" loading={formState.isSubmitting}>
        تسجيل الدخول
      </Button>

    </form>
  )
}
