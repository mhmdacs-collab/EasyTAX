const resolveApiUrl = (): string => {
  const value: unknown = Reflect.get(import.meta.env, "VITE_API_URL")
  return typeof value === "string" && value.length > 0 ? value : "http://localhost:3000"
}

export const API_URL = resolveApiUrl()

export type ApiError = {
  ok: false
  error: {
    code: string
    message: string
  }
}

const isApiError = (data: unknown): data is ApiError => {
  if (typeof data !== "object" || data === null) return false
  const r = data as Record<string, unknown>
  if (r.ok !== false) return false
  const error = r.error
  if (typeof error !== "object" || error === null) return false
  const e = error as Record<string, unknown>
  return typeof e.code === "string" && typeof e.message === "string"
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  })

  const data = await response.json() as unknown
  if (!response.ok) {
    if (isApiError(data)) {
      throw new Error(data.error.message)
    }
    throw new Error("حدث خطأ غير متوقع")
  }

  return data as T
}
