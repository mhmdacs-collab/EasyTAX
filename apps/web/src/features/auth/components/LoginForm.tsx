import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Link, useNavigate } from "@tanstack/react-router"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { useAuth } from "../hooks/useAuth"
import { db } from "@/lib/db"

const schema = z.object({
  email: z.email("بريد إلكتروني غير صالح"),
  password: z.string().min(8, "8 أحرف على الأقل"),
})

type FormData = z.infer<typeof schema>

export function LoginForm() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [error, setErrorMessage] = useState<string | null>(null)

  const { register, handleSubmit, setError, formState } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  })

  const onSubmit = async (data: FormData) => {
    try {
      setErrorMessage(null)
      await signIn(data.email, data.password)
      const hasOrganization = (await db.organizations.count()) > 0
      await navigate({ to: hasOrganization ? "/" : "/onboarding" })
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "حدث خطأ، حاول مجدداً")
    }
  }

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(onSubmit)(event).catch((err: unknown) => {
          if (err instanceof z.ZodError) {
            for (const issue of err.issues) {
              const field = issue.path[0]
              if (field === "email" || field === "password") {
                setError(field, { type: "validate", message: issue.message })
              }
            }
            return
          }
          throw err
        })
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="email">البريد الإلكتروني</Label>
        <Input id="email" type="email" placeholder="name@company.com" dir="ltr" autoComplete="email" {...register("email")} />
        {formState.errors.email && <p className="text-xs text-destructive">{formState.errors.email.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">كلمة المرور</Label>
        <Input id="password" type="password" dir="ltr" autoComplete="current-password" {...register("password")} />
        {formState.errors.password && <p className="text-xs text-destructive">{formState.errors.password.message}</p>}
      </div>

      {error && <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      <Button type="submit" className="w-full" loading={formState.isSubmitting}>تسجيل الدخول</Button>

      <p className="text-center text-sm text-muted-foreground">
        ليس لديك حساب؟{" "}
        <Link to="/register" className="font-medium text-primary hover:underline">أنشئ حساباً</Link>
      </p>
    </form>
  )
}
