import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import type { OnboardingData } from "../pages/OnboardingPage"

const schema = z.object({
  city: z.string().optional(),
  district: z.string().optional(),
  street: z.string().optional(),
  building_number: z.string().optional(),
  postal_code: z.string().optional(),
  short_address: z.string().optional(),
  phone: z.string().optional(),
  email: z.email("بريد غير صالح").optional().or(z.literal("")),
})

type FormData = z.infer<typeof schema>

interface Props {
  defaultValues: Partial<OnboardingData>
  onBack: () => void
  onNext: (data: Pick<OnboardingData, "city" | "district" | "street" | "building_number" | "postal_code" | "short_address" | "phone" | "email">) => void
}

export function Step2Contact({ defaultValues, onBack, onNext }: Props) {
  const { register, handleSubmit, formState } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      city: defaultValues.city ?? "",
      district: defaultValues.district ?? "",
      street: defaultValues.street ?? "",
      building_number: defaultValues.building_number ?? "",
      postal_code: defaultValues.postal_code ?? "",
      short_address: defaultValues.short_address ?? "",
      phone: defaultValues.phone ?? "",
      email: defaultValues.email ?? "",
    },
  })

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(onNext)(event)
      }}
      className="space-y-4"
    >
      <div>
        <h2 className="text-lg font-semibold">بيانات التواصل والعنوان</h2>
        <p className="text-sm text-muted-foreground">اختيارية — تظهر في رأس المستندات</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">المدينة</Label>
          <Input id="city" placeholder="الرياض" {...register("city")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="district">الحي</Label>
          <Input id="district" placeholder="العليا" {...register("district")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="street">الشارع</Label>
        <Input id="street" placeholder="طريق الملك فهد" {...register("street")} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="building_number">رقم المبنى</Label>
          <Input id="building_number" placeholder="1234" dir="ltr" {...register("building_number")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="postal_code">الرمز البريدي</Label>
          <Input id="postal_code" placeholder="12345" dir="ltr" {...register("postal_code")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="short_address">العنوان الوطني المختصر (اختياري)</Label>
        <Input id="short_address" placeholder="مثال: RRRD2929" dir="ltr" {...register("short_address")} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">رقم الجوال</Label>
          <Input id="phone" type="tel" placeholder="0500000000" dir="ltr" {...register("phone")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">البريد الإلكتروني للمنشأة</Label>
        <Input id="email" type="email" placeholder="info@company.com" dir="ltr" {...register("email")} />
        {formState.errors.email && <p className="text-xs text-destructive">{formState.errors.email.message}</p>}
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">← رجوع</Button>
        <Button type="submit" className="flex-1">التالي →</Button>
      </div>
    </form>
  )
}
