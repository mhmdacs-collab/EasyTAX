import { type UseFormReturn } from "react-hook-form"
import { useMemo } from "react"
import { Input } from "@/shared/components/ui/input"
import { Separator } from "@/shared/components/ui/separator"
import { calcDocumentTotals, calcItemSubtotal } from "../lib/calculations"
import { formatCurrency } from "@/shared/utils"
import type { DocumentFormData } from "./DocumentForm"

interface Props {
  form: UseFormReturn<DocumentFormData>
}

function TotalRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-1 text-sm ${bold ? "font-bold text-base" : ""}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums" dir="ltr">{formatCurrency(value)}</span>
    </div>
  )
}

export function TotalsSection({ form }: Props) {
  const { register, watch } = form
  const watchedItems = watch("items")
  const vatRate = watch("vat_rate")
  const vatInclusive = watch("vat_inclusive")
  const discountAmount = watch("discount_amount")
  const retentionAmount = watchedItems.reduce((sum,item)=>sum+calcItemSubtotal(item.unit_price||0,item.quantity||0,item.discount_percent||0)*(item.retention_percent||0)/100,0)

  const totals = useMemo(() => {
    const items = watchedItems.map((item) => ({
      subtotal: calcItemSubtotal(
        item.unit_price || 0,
        item.quantity || 0,
        item.discount_percent || 0
      ),
    }))
    return calcDocumentTotals(items, vatRate, vatInclusive, discountAmount || 0, retentionAmount || 0)
  }, [watchedItems, vatRate, vatInclusive, discountAmount, retentionAmount])

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">المجاميع</p>

      <TotalRow label="المجموع الفرعي" value={totals.subtotal} />

      {/* Optional discount */}
      <div className="flex items-center gap-3">
        <span className="shrink-0 text-sm text-muted-foreground">خصم (ر.س)</span>
        <Input
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          dir="ltr"
          className="h-8 text-sm"
          {...register("discount_amount", { valueAsNumber: true })}
        />
      </div>

      <Separator />

      {/* VAT settings */}
      <div className="flex items-center gap-3">
        <span className="shrink-0 text-sm text-muted-foreground">ضريبة%</span>
        <span className="rounded bg-muted px-3 py-1 font-medium">15% ثابتة</span>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" className="rounded" {...register("vat_inclusive")} />
          شاملة الضريبة
        </label>
      </div>

      <Separator />

      {(totals.discount_amount > 0 || totals.retention_amount > 0) && (
        <>
          {totals.discount_amount > 0 && <TotalRow label="الخصم" value={-totals.discount_amount} />}
          {totals.retention_amount > 0 && <TotalRow label="الاستقطاع" value={-totals.retention_amount} />}
          <TotalRow label="الوعاء الضريبي" value={totals.taxable_amount} />
          <Separator />
        </>
      )}

      <TotalRow label={`ضريبة القيمة المضافة (${vatRate}%)`} value={totals.vat_amount} />

      <Separator />
      <TotalRow label="الإجمالي الكلي" value={totals.total} bold />
    </div>
  )
}
