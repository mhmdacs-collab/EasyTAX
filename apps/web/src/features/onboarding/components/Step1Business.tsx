import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
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

interface Props {
  defaultValues: Partial<OnboardingData>
  onNext: (data: Pick<OnboardingData, "business_name" | "vat_number" | "commercial_registration">) => void
}

export function Step1Business({ defaultValues, onNext }: Props) {
  const { register, handleSubmit, formState } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      business_name: defaultValues.business_name ?? "",
      vat_number: defaultValues.vat_number ?? "",
      commercial_registration: defaultValues.commercial_registration ?? "",
    },
  })

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">معلومات المنشأة</h2>
        <p className="text-sm text-muted-foreground">البيانات الأساسية المطلوبة للفواتير</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="business_name">اسم المنشأة *</Label>
        <Input id="business_name" placeholder="شركة الأمثال للخدمات" {...register("business_name")} />
        {formState.errors.business_name && (
          <p className="text-xs text-destructive">{formState.errors.business_name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="vat_number">الرقم الضريبي (VAT) *</Label>
        <Input id="vat_number" placeholder="300000000000000" dir="ltr" maxLength={15} {...register("vat_number")} />
        {formState.errors.vat_number && (
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
