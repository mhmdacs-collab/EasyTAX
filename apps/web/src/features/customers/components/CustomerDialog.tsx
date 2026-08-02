import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { db, type Customer } from "@/lib/db"
import { generateId } from "@/shared/utils"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/shared/components/ui/dialog"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"

const schema = z.object({
  name: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل"),
  vat_number: z.string().optional(),
  commercial_registration: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("بريد إلكتروني غير صحيح").optional().or(z.literal("")),
  address: z.string().optional(),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  organizationId: string
  customer?: Customer
}

export function CustomerDialog({ open, onClose, organizationId, customer }: Props) {
  const isEdit = !!customer

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: customer?.name ?? "",
      vat_number: customer?.vat_number ?? "",
      commercial_registration: customer?.commercial_registration ?? "",
      phone: customer?.phone ?? "",
      email: customer?.email ?? "",
      address: customer?.address ?? "",
      notes: customer?.notes ?? "",
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        name: customer?.name ?? "",
        vat_number: customer?.vat_number ?? "",
        commercial_registration: customer?.commercial_registration ?? "",
        phone: customer?.phone ?? "",
        email: customer?.email ?? "",
        address: customer?.address ?? "",
        notes: customer?.notes ?? "",
      })
    }
  }, [open, customer])

  const onSubmit = form.handleSubmit(async (data) => {
    const now = new Date().toISOString()
    if (isEdit && customer) {
      await db.customers.update(customer.id, {
        ...data,
        updated_at: now,
        sync_status: "pending",
        version: customer.version + 1,
      })
    } else {
      await db.customers.add({
        id: generateId(),
        organization_id: organizationId,
        name: data.name,
        vat_number: data.vat_number || undefined,
        commercial_registration: data.commercial_registration || undefined,
        phone: data.phone || undefined,
        email: data.email || undefined,
        address: data.address || undefined,
        notes: data.notes || undefined,
        is_active: true,
        created_at: now,
        updated_at: now,
        sync_status: "pending",
        version: 1,
      })
    }
    onClose()
  })

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل العميل" : "عميل جديد"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name">اسم العميل *</Label>
              <Input id="name" placeholder="شركة النجوم للتجارة" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vat_number">الرقم الضريبي</Label>
              <Input id="vat_number" placeholder="300000000000000" dir="ltr" {...form.register("vat_number")} />
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

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="address">العنوان</Label>
              <Input id="address" placeholder="الرياض — العليا — شارع العروبة" {...form.register("address")} />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              {isEdit ? "حفظ التعديلات" : "إضافة العميل"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
