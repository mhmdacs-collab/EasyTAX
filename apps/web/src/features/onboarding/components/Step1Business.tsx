import { useForm, type Resolver } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import type { OnboardingData } from "../pages/OnboardingPage"

const schema = z.object({
  business_name: z.string().min(2, "اسم المنشأة مطلوب"),
  vat_number: z
    .string()
    .length(15, "الرقم الضريبي يجب أن يكون 15 رقماً")
    .regex(/^\d+$/, "أرقام فقط"),
  commercial_registration: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const resolver: Resolver<FormData> = (values) => {
  const parsed = schema.safeParse(values)
  if (parsed.success) return { values: parsed.data, errors: {} }
  const errors: Record<string, { type: string; message: string }> = {}
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as keyof FormData
    if (!errors[field]) errors[field] = { type: "validate", message: issue.message }
  }
  return { values: {}, errors }
}

interface Props {
  defaultValues: Partial<OnboardingData>
  locked?: Array<"business_name" | "vat_number">
  onNext: (data: Pick<OnboardingData, "business_name" | "vat_number" | "commercial_registration">) => void
}

export function Step1Business({ defaultValues, locked = [], onNext }: Props) {
  const { register, handleSubmit, formState } = useForm<FormData>({
    resolver,
    defaultValues: {
      business_name: defaultValues.business_name ?? "",
      vat_number: defaultValues.vat_number ?? "",
      commercial_registration: defaultValues.commercial_registration ?? "",
    },
  })

  const isLocked = (field: "business_name" | "vat_number") => locked.includes(field)

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(onNext)(event)
      }}
      className="space-y-4"
    >
      <div>
        <h2 className="text-lg font-semibold">معلومات المنشأة</h2>
        <p className="text-sm text-muted-foreground">البيانات الأساسية المطلوبة للفواتير</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="business_name">اسم المنشأة *</Label>
        <Input
          id="business_name"
          placeholder="شركة الأمثال للخدمات"
          readOnly={isLocked("business_name")}
          tabIndex={isLocked("business_name") ? -1 : undefined}
          className={isLocked("business_name") ? "bg-muted/50 cursor-not-allowed" : undefined}
          {...register("business_name")}
        />
        {!isLocked("business_name") && formState.errors.business_name && (
          <p className="text-xs text-destructive">{formState.errors.business_name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="vat_number">الرقم الضريبي (VAT) *</Label>
        <Input
          id="vat_number"
          placeholder="300000000000000"
          dir="ltr"
          maxLength={15}
          readOnly={isLocked("vat_number")}
          tabIndex={isLocked("vat_number") ? -1 : undefined}
          className={isLocked("vat_number") ? "bg-muted/50 cursor-not-allowed" : undefined}
          {...register("vat_number")}
        />
        {!isLocked("vat_number") && formState.errors.vat_number && (
          <p className="text-xs text-destructive">{formState.errors.vat_number.message}</p>
        )}
        <p className="text-xs text-muted-foreground">15 رقماً — يبدأ بـ 3 وينتهي بـ 3</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="commercial_registration">السجل التجاري</Label>
        <Input id="commercial_registration" placeholder="1234567890" dir="ltr" {...register("commercial_registration")} />
      </div>

      <Button type="submit" className="w-full">التالي →</Button>
    </form>
  )
}

