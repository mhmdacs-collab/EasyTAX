export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-6 rounded-lg border p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold">EasyTAX</h1>
          <p className="mt-1 text-sm text-muted-foreground">تسجيل الدخول إلى حسابك</p>
        </div>
        {/* Auth form will be implemented in Phase 1 */}
        <div className="rounded-md bg-muted p-4 text-center text-sm text-muted-foreground">
          صفحة تسجيل الدخول — ستُنفَّذ في المرحلة الأولى
        </div>
      </div>
    </div>
  );
}
