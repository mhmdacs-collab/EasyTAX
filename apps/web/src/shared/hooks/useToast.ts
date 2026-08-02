import { useState, useCallback } from "react"
import type { ToastVariant } from "@/shared/components/ui/toast"

interface ToastItem {
  id: string
  title: string
  description?: string
  variant?: ToastVariant
  open: boolean
}

let externalDispatch: ((toast: Omit<ToastItem, "id" | "open">) => void) | null = null

/** Call from anywhere — no hook needed */
export function toast(options: Omit<ToastItem, "id" | "open">) {
  externalDispatch?.(options)
}

export function useToastState() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dispatch = useCallback((options: Omit<ToastItem, "id" | "open">) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev.slice(-4), { ...options, id, open: true }])
  }, [])

  // Register global dispatcher on mount
  const register = useCallback(() => {
    externalDispatch = dispatch
    return () => { externalDispatch = null }
  }, [dispatch])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, open: false } : t)))
  }, [])

  return { toasts, register, dismiss }
}
