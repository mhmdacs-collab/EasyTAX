import { cn } from "@/shared/utils"

interface SpinnerProps {
  className?: string
  size?: "sm" | "md" | "lg"
}

const sizeMap = { sm: "size-4", md: "size-6", lg: "size-8" }

export function Spinner({ className, size = "md" }: SpinnerProps) {
  return (
    <svg
      className={cn("animate-spin text-muted-foreground", sizeMap[size], className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-label="جاري التحميل"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
