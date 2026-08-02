import { authClient } from "@/lib/auth/client"
import { useNavigate } from "@tanstack/react-router"

export function useAuth() {
  const { data: sessionData, isPending } = authClient.useSession()
  const navigate = useNavigate()

  const signIn = async (email: string, password: string) => {
    const result = await authClient.signIn.email({ email, password })
    if (result.error) throw new Error(result.error.message ?? "فشل تسجيل الدخول")
  }

  const signUp = async (name: string, email: string, password: string) => {
    const result = await authClient.signUp.email({ name, email, password })
    if (result.error) throw new Error(result.error.message ?? "فشل إنشاء الحساب")
  }

  const signOut = async () => {
    await authClient.signOut()
    await navigate({ to: "/login" })
  }

  return {
    user: sessionData?.user ?? null,
    session: sessionData?.session ?? null,
    isLoading: isPending,
    isAuthenticated: !!sessionData?.user,
    signIn,
    signUp,
    signOut,
  }
}
