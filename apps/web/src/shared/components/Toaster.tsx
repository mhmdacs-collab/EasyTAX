import { useEffect } from "react"
import { ToastProvider, ToastViewport, Toast } from "@/shared/components/ui/toast"
import { useToastState } from "@/shared/hooks/useToast"

export function Toaster() {
  const { toasts, register, dismiss } = useToastState()

  useEffect(() => register(), [register])

  return (
    <ToastProvider swipeDirection="left" duration={4000}>
      {toasts.map((t) => (
        <Toast
          key={t.id}
          open={t.open}
          onOpenChange={(open: boolean) => { if (!open) dismiss(t.id) }}
          variant={t.variant}
          title={t.title}
          description={t.description}
        />
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
