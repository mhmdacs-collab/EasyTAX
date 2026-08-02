import { Button } from "@/shared/components/ui/button"
import { Separator } from "@/shared/components/ui/separator"
import type { OnboardingData } from "../pages/OnboardingPage"

interface Props {
  data: OnboardingData
  onBack: () => void
  onConfirm: () => void
  saving: boolean
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium" dir="auto">{value}</span>
    </div>
  )
}

export function Step3Confirm({ data, onBack, onConfirm, saving }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">مراجعة البيانات</h2>
        <p className="text-sm text-muted-foreground">تأكد من صحة المعلومات قبل الحفظ</p>
      </div>

      <div className="rounded-lg border p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">معلومات المنشأة</p>
        <Row label="اسم المنشأة" value={data.business_name} />
        <Row label="الرقم الضريبي" value={data.vat_number} />
        <Row label="السجل التجاري" value={data.commercial_registration} />

        {(data.city || data.phone || data.email) && (
          <>
            <Separator className="my-3" />
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">التواصل</p>
            <Row label="المدينة" value={[data.city, data.district].filter(Boolean).join(" - ")} />
            <Row label="الشارع" value={data.street} />
            <Row label="الجوال" value={data.phone} />
            <Row label="البريد" value={data.email} />
          </>
        )}
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} disabled={saving} className="flex-1">← رجوع</Button>
        <Button type="button" onClick={onConfirm} loading={saving} className="flex-1">حفظ وبدء الاستخدام ✓</Button>
      </div>
    </div>
  )
}
