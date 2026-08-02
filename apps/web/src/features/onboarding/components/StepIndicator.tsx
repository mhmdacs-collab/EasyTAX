import { Check } from "lucide-react"
import { cn } from "@/shared/utils"

interface StepIndicatorProps {
  steps: string[]
  currentStep: number
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-start justify-between">
      {steps.map((step, index) => {
        const done = index < currentStep
        const active = index === currentStep
        return (
          <div key={index} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex w-full items-center">
              {index > 0 && <div className={cn("h-px flex-1", done ? "bg-primary" : "bg-border")} />}
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary text-primary",
                  !done && !active && "border-border text-muted-foreground"
                )}
              >
                {done ? <Check className="size-4" /> : index + 1}
              </div>
              {index < steps.length - 1 && <div className={cn("h-px flex-1", done ? "bg-primary" : "bg-border")} />}
            </div>
            <span className={cn("text-xs", active ? "font-semibold text-primary" : "text-muted-foreground")}>
              {step}
            </span>
          </div>
        )
      })}
    </div>
  )
}
