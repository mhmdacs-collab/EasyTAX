import { LoginForm } from "../components/LoginForm"

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground text-lg font-bold select-none">
            ET
          </div>
          <h1 className="text-2xl font-bold">EasyTAX</h1>
          <p className="mt-1 text-sm text-muted-foreground">تسجيل الدخول إلى حسابك</p>
        </div>
        <div className="rounded-xl border bg-card p-8 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
