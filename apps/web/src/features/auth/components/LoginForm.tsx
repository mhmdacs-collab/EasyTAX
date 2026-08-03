import { useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { z } from "zod"
import { Link, useNavigate } from "@tanstack/react-router"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { useAuth } from "../hooks/useAuth"
import { db } from "@/lib/db"

const schema = z.object({
  vat_number: z
    .string()
    .length(15, "الرقم الضريبي يجب أن يكون 15 رقماً")
    .regex(/^\d+$/, "أرقام فقط"),
  password: z.string().min(8, "8 أحرف على الأقل"),
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
    if (field === "vat_number" || field === "password") {
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
      // VAT Number is stored as the Better Auth email using the @easytax.local domain
      await signIn(`${data.vat_number}@easytax.local`, data.password)
      const hasOrganization = (await db.organizations.count()) > 0
      await navigate({ to: hasOrganization ? "/" : "/onboarding" })
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
          placeholder="300000000000003"
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

      <p className="text-center text-sm text-muted-foreground">
        ليس لديك حساب؟{" "}
        <Link to="/register" className="font-medium text-primary hover:underline">
          تفعيل الاشتراك
        </Link>
      </p>
    </form>
  )
}
