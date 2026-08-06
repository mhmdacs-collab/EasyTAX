import { type ReactNode } from "react"
import { type UseFormReturn, useWatch } from "react-hook-form"
import { useState } from "react"
import { Input } from "@/shared/components/ui/input"
import { Separator } from "@/shared/components/ui/separator"
import { calcDocumentTotals, calcItemSubtotal } from "../lib/calculations"
import { formatCurrency } from "@/shared/utils"
import type { DocumentFormData } from "./DocumentForm"

interface Props {
  form: UseFormReturn<DocumentFormData>
  children?: ReactNode
  isQuotation?: boolean
  hideTotals?: boolean
}

function TotalRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-1 text-sm ${bold ? "font-bold text-base" : ""}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums" dir="ltr">{formatCurrency(value)}</span>
    </div>
  )
}

export function TotalsSection({ form, children, isQuotation = false, hideTotals = false }: Props) {
  const { register, control, setValue } = form
  const [watchedItems, vatRate, vatInclusive, discountAmount] = useWatch({ control, name: ["items", "vat_rate", "vat_inclusive", "discount_amount"] })
  const [discountEnabled, setDiscountEnabled] = useState(() => (discountAmount || 0) > 0)
  const grossItemsTotal = watchedItems.reduce((sum, item) => sum + (item.unit_price || 0) * (item.quantity || 0), 0)
  const discountedItemsTotal = watchedItems.reduce((sum,item)=>sum+calcItemSubtotal(item.unit_price||0,item.quantity||0,item.discount_percent||0),0)
  const lineDiscountTotal = Math.max(0, grossItemsTotal - discountedItemsTotal)
  const retentionAmount = watchedItems.reduce((sum,item)=>sum+calcItemSubtotal(item.unit_price||0,item.quantity||0,item.discount_percent||0)*(item.retention_percent||0)/100,0)

  const totals = (() => {
    const items = watchedItems.map((item) => ({
      subtotal: calcItemSubtotal(
        item.unit_price || 0,
        item.quantity || 0,
        item.discount_percent || 0
      ),
    }))
    return calcDocumentTotals(items, vatRate, vatInclusive, discountAmount || 0, retentionAmount || 0)
  })()

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{hideTotals?"إعداد الضريبة":"المجاميع"}</p>

      {!hideTotals&&<TotalRow label="المجموع الفرعي" value={grossItemsTotal} />}
      {!hideTotals&&lineDiscountTotal > 0 ? <TotalRow label="خصومات البنود" value={lineDiscountTotal} /> : null}

      {/* Optional discount */}
      {!hideTotals&&!isQuotation?<div className="space-y-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={discountEnabled} onChange={(event)=>{const enabled=event.target.checked;setDiscountEnabled(enabled);if(!enabled)setValue("discount_amount",0,{shouldDirty:true,shouldValidate:true})}} />
          خصم على الإجمالي (ر.س)
        </label>
        {discountEnabled?<Input type="number" min="0" step="0.01" placeholder="قيمة الخصم" aria-label="قيمة خصم الفاتورة" dir="ltr" className="h-9 text-sm" {...register("discount_amount", { valueAsNumber: true })} />:null}
      </div>:null}

      {!hideTotals&&<Separator />}

      {/* VAT settings */}
      <div className="space-y-2">
        <div className="flex items-center gap-3"><span className="text-sm text-muted-foreground">ضريبة القيمة المضافة</span><span className="rounded bg-muted px-3 py-1 font-medium">15% ثابتة</span></div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded border bg-background p-2 text-sm"><input type="radio" name="tax-mode" checked={!vatInclusive} onChange={()=>{ setValue("vat_inclusive",false,{shouldDirty:true}); }}/>الأسعار غير شاملة</label>
          <label className="flex cursor-pointer items-center gap-2 rounded border bg-background p-2 text-sm"><input type="radio" name="tax-mode" checked={vatInclusive} onChange={()=>{ setValue("vat_inclusive",true,{shouldDirty:true}); }}/>الأسعار شاملة</label>
        </div>
      </div>

      {!hideTotals&&<Separator />}

      {!hideTotals&&(totals.discount_amount > 0 || totals.retention_amount > 0) && (
        <>
          {totals.discount_amount > 0 && <TotalRow label="خصم على الإجمالي" value={totals.discount_amount} />}
          <TotalRow label="الوعاء الضريبي" value={totals.taxable_amount} />
          <Separator />
        </>
      )}

      {!hideTotals&&<TotalRow label={`ضريبة القيمة المضافة (${vatRate}%)`} value={totals.vat_amount} />}

      {!hideTotals&&<Separator />}
      {!hideTotals&&<TotalRow label="الإجمالي شامل الضريبة" value={totals.total} bold />}
      {!hideTotals&&totals.retention_amount > 0 && <><TotalRow label="حجز ضمان الأعمال" value={totals.retention_amount} /><TotalRow label="المبلغ المستحق" value={totals.payable_amount} bold /></>}
      {children ? <><Separator />{children}</> : null}
    </div>
  )
}
