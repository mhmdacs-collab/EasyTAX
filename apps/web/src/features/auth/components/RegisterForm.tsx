import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Link, useNavigate } from "@tanstack/react-router"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { useAuth } from "../hooks/useAuth"

const schema = z
  .object({
    name: z.string().min(2, "الاسم مطلوب"),
    email: z.string().email("بريد إلكتروني غير صالح"),
    password: z.string().min(8, "8 أحرف على الأقل"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "كلمات المرور غير متطابقة",
    path: ["confirmPassword"],
  })

type FormData = z.infer<typeof schema>

export function RegisterForm() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  })

  const onSubmit = async (data: FormData) => {
    try {
      setError(null)
      await signUp(data.name, data.email, data.password)
      await navigate({ to: "/onboarding" })
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ، حاول مجدداً")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">الاسم الكامل</Label>
        <Input id="name" placeholder="محمد أحمد" autoComplete="name" {...register("name")} />
        {formState.errors.name && <p className="text-xs text-destructive">{formState.errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">البريد الإلكتروني</Label>
        <Input id="email" type="email" placeholder="name@company.com" dir="ltr" autoComplete="email" {...register("email")} />
        {formState.errors.email && <p className="text-xs text-destructive">{formState.errors.email.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">كلمة المرور</Label>
        <Input id="password" type="password" dir="ltr" autoComplete="new-password" {...register("password")} />
        {formState.errors.password && <p className="text-xs text-destructive">{formState.errors.password.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
        <Input id="confirmPassword" type="password" dir="ltr" autoComplete="new-password" {...register("confirmPassword")} />
        {formState.errors.confirmPassword && <p className="text-xs text-destructive">{formState.errors.confirmPassword.message}</p>}
      </div>

      {error && <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      <Button type="submit" className="w-full" loading={formState.isSubmitting}>إنشاء الحساب</Button>

      <p className="text-center text-sm text-muted-foreground">
        لديك حساب؟{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">تسجيل الدخول</Link>
      </p>
    </form>
  )
}
