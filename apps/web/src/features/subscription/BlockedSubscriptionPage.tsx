import { MessageCircle, AlertCircle, Clock, ShieldOff } from "lucide-react"
import type { EffectiveStatus } from "@/lib/subscription/useSubscriptionStatus"

const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER as string

const STATUS_CONFIG: Record<
  Exclude<EffectiveStatus, "active">,
  { icon: React.FC<{ className?: string }>; message: string; description: string }
> = {
  suspended: {
    icon: ShieldOff,
    message: "تم إيقاف اشتراكك مؤقتًا.",
    description: "اشتراكك موقوف حاليًا. تواصل معنا لإعادة التفعيل.",
  },
  expired: {
    icon: Clock,
    message: "انتهى اشتراكك. يرجى تجديد الاشتراك للمتابعة.",
    description: "انتهت صلاحية اشتراكك. تواصل معنا لتجديده.",
  },
  inactive: {
    icon: AlertCircle,
    message: "لا يوجد لديك اشتراك فعال.",
    description: "لم يتم ربط اشتراك فعال بحسابك. تواصل معنا للمساعدة.",
  },
}

interface Props {
  status: EffectiveStatus
  vatNumber?: string | null
}

export function BlockedSubscriptionPage({ status, vatNumber }: Props) {
  const safeStatus: Exclude<EffectiveStatus, "active"> =
    status === "active" ? "inactive" : status
  const config = STATUS_CONFIG[safeStatus]

  const Icon = config.icon
  const whatsappText = `مرحبًا، أحتاج المساعدة بخصوص اشتراك EasyTAX للرقم الضريبي: ${vatNumber ?? ""}`
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappText)}`

  return (
    <div
      className="flex min-h-screen w-full flex-col items-center justify-center gap-8 bg-background px-6 py-12 text-center"
      dir="rtl"
    >
      {/* Icon */}
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-destructive/10">
        <Icon className="size-12 text-destructive" />
      </div>

      {/* Message */}
      <div className="max-w-md space-y-3">
        <h1 className="text-2xl font-bold text-foreground">{config.message}</h1>
        <p className="text-base text-muted-foreground">{config.description}</p>
      </div>

      {/* WhatsApp button */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-6 py-3 text-base font-semibold text-white shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2"
      >
        <MessageCircle className="size-5" />
        تواصل معنا عبر واتساب
      </a>
    </div>
  )
}
