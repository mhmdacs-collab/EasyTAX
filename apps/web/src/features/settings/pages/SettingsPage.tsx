import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useLiveQuery } from "dexie-react-hooks"
import { Save, Building2 } from "lucide-react"
import { db } from "@/lib/db"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { Separator } from "@/shared/components/ui/separator"

const schema = z.object({
  business_name: z.string().min(2, "اسم المنشأة مطلوب"),
  vat_number: z.string().regex(/^\d{15}$/, "يجب أن يكون الرقم الضريبي 15 رقماً"),
  commercial_registration: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("بريد إلكتروني غير صحيح").optional().or(z.literal("")),
  city: z.string().optional(),
  district: z.string().optional(),
  street: z.string().optional(),
  postal_code: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function SettingsPage() {
  const org = useLiveQuery(() => db.organizations.toArray().then((r) => r[0]))

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      business_name: "",
      vat_number: "",
      commercial_registration: "",
      phone: "",
      email: "",
      city: "",
      district: "",
      street: "",
      postal_code: "",
    },
  })

  // Populate form when org loads
  useEffect(() => {
    if (org) {
      form.reset({
        business_name: org.business_name,
        vat_number: org.vat_number,
        commercial_registration: org.commercial_registration ?? "",
        phone: org.phone ?? "",
        email: org.email ?? "",
        city: org.city ?? "",
        district: org.district ?? "",
        street: org.street ?? "",
        postal_code: org.postal_code ?? "",
      })
    }
  }, [org])

  const onSubmit = form.handleSubmit(async (data) => {
    if (!org) return
    await db.organizations.update(org.id, {
      ...data,
      updated_at: new Date().toISOString(),
      sync_status: "pending",
      version: org.version + 1,
    })
    form.reset(data) // clear dirty state
  })

  if (!org) return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      جاري التحميل...
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold">الإعدادات</h1>
        <p className="mt-1 text-sm text-muted-foreground">بيانات المنشأة التي تظهر في المستندات</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* ── Business identity ── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-muted-foreground" />
            <h2 className="font-semibold">بيانات المنشأة</h2>
          </div>
          <Separator />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="business_name">اسم المنشأة *</Label>
              <Input id="business_name" placeholder="شركة النجوم للتجارة" {...form.register("business_name")} />
              {form.formState.errors.business_name && (
                <p className="text-xs text-destructive">{form.formState.errors.business_name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vat_number">الرقم الضريبي *</Label>
              <Input id="vat_number" placeholder="300000000000000" dir="ltr" maxLength={15} {...form.register("vat_number")} />
              {form.formState.errors.vat_number && (
                <p className="text-xs text-destructive">{form.formState.errors.vat_number.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cr">السجل التجاري</Label>
              <Input id="cr" placeholder="1234567890" dir="ltr" {...form.register("commercial_registration")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">رقم الجوال</Label>
              <Input id="phone" type="tel" placeholder="0500000000" dir="ltr" {...form.register("phone")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input id="email" type="email" placeholder="info@company.sa" dir="ltr" {...form.register("email")} />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
          </div>
        </section>

        {/* ── Address ── */}
        <section className="space-y-4">
          <h2 className="font-semibold">العنوان الوطني</h2>
          <Separator />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="city">المدينة</Label>
              <Input id="city" placeholder="الرياض" {...form.register("city")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="district">الحي</Label>
              <Input id="district" placeholder="العليا" {...form.register("district")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="street">الشارع</Label>
              <Input id="street" placeholder="شارع العروبة" {...form.register("street")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="postal_code">الرمز البريدي</Label>
              <Input id="postal_code" placeholder="12345" dir="ltr" {...form.register("postal_code")} />
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <Button type="submit" loading={form.formState.isSubmitting} disabled={!form.formState.isDirty} className="gap-2">
            <Save className="size-4" />
            حفظ التعديلات
          </Button>
        </div>
      </form>
    </div>
  )
}
