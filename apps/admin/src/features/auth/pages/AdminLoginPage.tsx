import { useState, type FormEvent } from "react"
import { useNavigate } from "@tanstack/react-router"
import { authClient } from "@/lib/auth/client"
import { apiRequest } from "@/lib/api/client"

type SummaryResponse = {
  ok: true
  data: {
    total_subscribers: number
    active_subscriptions: number
    expired_subscriptions: number
    expiring_in_30_days: number
  }
}

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const normalizedUsername = username.trim()
      const email = `${normalizedUsername}@easytax.local`
      const result = await authClient.signIn.email({ email, password })
      if (result.error) {
        setError(result.error.message ?? "فشل تسجيل الدخول")
        setLoading(false)
        return
      }

      await apiRequest<SummaryResponse>("/api/v1/admin/summary")
      await navigate({ to: "/" })
    } catch (err) {
      setError(err instanceof Error ? err.message : "غير مصرح كمدير")
      setLoading(false)
      return
    }

    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">بوابة إدارة EasyTAX</h1>
          <p className="mt-2 text-sm text-muted-foreground">تسجيل دخول المدير</p>
        </div>

        <form dir="rtl" onSubmit={(event) => { void handleLogin(event) }} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium">اسم المستخدم</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(event) => { setUsername(event.target.value) }}
              className="w-full rounded-md border bg-background px-3 py-2 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="أدخل اسم المستخدم"
              dir="ltr"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">كلمة المرور</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => { setPassword(event.target.value) }}
              className="w-full rounded-md border bg-background px-3 py-2 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              dir="ltr"
              required
            />
          </div>

          {error && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

          <button
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "جاري الدخول..." : "تسجيل الدخول"}
          </button>
        </form>
      </div>
    </div>
  )
}
