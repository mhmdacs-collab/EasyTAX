import * as React from "react"
import * as ToastPrimitive from "@radix-ui/react-toast"
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react"
import { cn } from "@/shared/utils"

const ToastProvider = ToastPrimitive.Provider
const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      "fixed bottom-4 start-4 z-[100] flex max-h-screen w-full max-w-sm flex-col gap-2",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitive.Viewport.displayName

type ToastVariant = "default" | "success" | "error" | "warning"

const toastVariants: Record<ToastVariant, string> = {
  default: "border bg-background text-foreground",
  success: "border-green-200 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100",
  error: "border-red-200 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100",
  warning: "border-yellow-200 bg-yellow-50 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-100",
}

const toastIcons: Record<ToastVariant, React.ReactNode> = {
  default: <Info className="size-4 text-muted-foreground" />,
  success: <CheckCircle2 className="size-4 text-green-600" />,
  error: <AlertCircle className="size-4 text-red-600" />,
  warning: <AlertTriangle className="size-4 text-yellow-600" />,
}

interface ToastProps extends React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> {
  variant?: ToastVariant
  title?: string
  description?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const Toast = React.forwardRef<React.ElementRef<typeof ToastPrimitive.Root>, ToastProps>(
  ({ className, variant = "default", title, description, open, onOpenChange, ...props }, ref) => (
    <ToastPrimitive.Root
      ref={ref}
      open={open}
      onOpenChange={onOpenChange}
      className={cn(
        "group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-lg border p-4 shadow-lg transition-all",
        "data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-bottom-full",
        toastVariants[variant],
        className
      )}
      {...props}
    >
      <span className="mt-0.5 shrink-0">{toastIcons[variant]}</span>
      <div className="flex-1 space-y-1">
        {title && <ToastPrimitive.Title className="text-sm font-semibold leading-none">{title}</ToastPrimitive.Title>}
        {description && <ToastPrimitive.Description className="text-xs opacity-80">{description}</ToastPrimitive.Description>}
      </div>
      <ToastPrimitive.Close className="shrink-0 rounded-sm opacity-0 transition-opacity group-hover:opacity-70 hover:!opacity-100">
        <X className="size-4" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  )
)
Toast.displayName = "Toast"

export { ToastProvider, ToastViewport, Toast, type ToastVariant }
