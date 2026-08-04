export function resolveApiUrl(): string {
  if (typeof window !== "undefined" && !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return window.location.origin
  }
  const configured: unknown = Reflect.get(import.meta.env, "VITE_API_URL")
  return typeof configured === "string" && configured.length > 0 ? configured : "http://localhost:3000"
}
