import { authClient } from "@/lib/auth/client"

const WRONG_CREDENTIALS_MESSAGE = "الرقم الضريبي أو كلمة المرور غير صحيحة."
const SERVER_UNAVAILABLE_MESSAGE = "تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى."
const RATE_LIMIT_MESSAGE = "محاولات كثيرة. حاول مرة أخرى بعد قليل."
const ACCOUNT_DISABLED_MESSAGE = "الحساب موقوف أو محذوف. يرجى التواصل مع الإدارة."
const UNEXPECTED_LOGIN_ERROR_MESSAGE = "حدث خطأ غير متوقع. حاول مرة أخرى."

const KNOWN_ARABIC_MESSAGES = new Set([
  WRONG_CREDENTIALS_MESSAGE,
  SERVER_UNAVAILABLE_MESSAGE,
  RATE_LIMIT_MESSAGE,
  ACCOUNT_DISABLED_MESSAGE,
  UNEXPECTED_LOGIN_ERROR_MESSAGE,
])

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

  // Short-circuit: already a known Arabic message (prevents double-mapping in try/catch)
  if (KNOWN_ARABIC_MESSAGES.has(message)) return message

  const status = readStatus(error)
  const code = readCode(error)

  if (
    code === "ACCOUNT_DISABLED" ||
    status === 403 ||
    /account.*disabled|الحساب موقوف أو محذوف/i.test(message)
  ) {
    return ACCOUNT_DISABLED_MESSAGE
  }
  if (
    code === "INVALID_EMAIL_OR_PASSWORD" ||
    status === 401 ||
    /Invalid email or password|invalid credentials|user not found/i.test(message)
  ) {
    return WRONG_CREDENTIALS_MESSAGE
  }
  if (status === 429 || /Too many requests/i.test(message)) {
    return RATE_LIMIT_MESSAGE
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

  const signIn = async (email: string, password: string) => {
    await signInWithEmail(email, password)
  }

  const signUp = async (name: string, email: string, password: string) => {
    const result = await authClient.signUp.email({ name, email, password })
    if (result.error) throw new Error(result.error.message ?? "فشل إنشاء الحساب")
  }

  const signOut = async () => {
    await signOutCurrentUser()
    window.location.replace("/login")
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
