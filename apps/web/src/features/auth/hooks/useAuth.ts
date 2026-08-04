import { authClient } from "@/lib/auth/client"
import { useNavigate } from "@tanstack/react-router"

const WRONG_CREDENTIALS_MESSAGE = "الرقم الضريبي أو كلمة المرور غير صحيحة."
const SERVER_UNAVAILABLE_MESSAGE = "الخادم غير متاح حالياً. حاول مرة أخرى لاحقًا."
const UNEXPECTED_LOGIN_ERROR_MESSAGE = "حدث خطأ غير متوقع أثناء تسجيل الدخول. حاول مرة أخرى."

const isNetworkMessage = (message: string) =>
  /Failed to fetch|fetch failed|NetworkError|Load failed|ERR_NETWORK|ECONNREFUSED/i.test(message)

const readMessage = (error: unknown): string => {
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message
  if (!error || typeof error !== "object") return ""
  const record = error as Record<string, unknown>
  return typeof record.message === "string" ? record.message : ""
}

const readStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== "object") return undefined
  const record = error as Record<string, unknown>
  return typeof record.status === "number" ? record.status : undefined
}

const readCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object") return undefined
  const record = error as Record<string, unknown>
  return typeof record.code === "string" ? record.code : undefined
}

export function mapLoginError(error: unknown): string {
  const message = readMessage(error)
  const status = readStatus(error)
  const code = readCode(error)

  if (message === WRONG_CREDENTIALS_MESSAGE) return message
  if (
    code === "INVALID_EMAIL_OR_PASSWORD" ||
    status === 401 ||
    /Invalid email or password|invalid credentials|user not found/i.test(message)
  ) {
    return WRONG_CREDENTIALS_MESSAGE
  }
  if (isNetworkMessage(message)) {
    return SERVER_UNAVAILABLE_MESSAGE
  }
  return UNEXPECTED_LOGIN_ERROR_MESSAGE
}

export async function signInWithEmail(email: string, password: string) {
  try {
    const result = await authClient.signIn.email({ email, password })
    if (result.error) {
      throw new Error(mapLoginError(result.error))
    }
    return result
  } catch (error) {
    throw new Error(mapLoginError(error))
  }
}

export async function signOutCurrentUser() {
  await authClient.signOut()
}

export function useAuth() {
  const { data: sessionData, isPending } = authClient.useSession()
  const navigate = useNavigate()

  const signIn = async (email: string, password: string) => {
    await signInWithEmail(email, password)
  }

  const signUp = async (name: string, email: string, password: string) => {
    const result = await authClient.signUp.email({ name, email, password })
    if (result.error) throw new Error(result.error.message ?? "فشل إنشاء الحساب")
  }

  const signOut = async () => {
    await signOutCurrentUser()
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
