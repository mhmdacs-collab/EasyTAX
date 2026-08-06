import { Plus, Trash2 } from "lucide-react"
import { useWatch, type UseFormReturn } from "react-hook-form"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select"
import { formatCurrency } from "@/shared/utils"
import { calcDocumentTotals, calcItemSubtotal } from "../lib/calculations"
import type { DocumentFormData } from "./DocumentForm"

export type CollectedPayment = { payment_method_name:string; amount:number }

export function PaymentCollection({form,methods,enabled,onEnabled,payments,onPayments}:{form:UseFormReturn<DocumentFormData>;methods:string[];enabled:boolean;onEnabled:(value:boolean)=>void;payments:CollectedPayment[];onPayments:(value:CollectedPayment[])=>void}){
  const [items,vatRate,vatInclusive,discountAmount]=useWatch({control:form.control,name:["items","vat_rate","vat_inclusive","discount_amount"]})
  const retention=items.reduce((sum,item)=>sum+calcItemSubtotal(item.unit_price||0,item.quantity||0,item.discount_percent||0)*(item.retention_percent||0)/100,0)
  const total=calcDocumentTotals(items.map((item)=>({subtotal:calcItemSubtotal(item.unit_price||0,item.quantity||0,item.discount_percent||0)})),vatRate,vatInclusive,discountAmount||0,retention).total
  const collected=payments.reduce((sum,payment)=>sum+(payment.amount||0),0)
  const update=(index:number,patch:Partial<CollectedPayment>)=>{ onPayments(payments.map((payment,i)=>i===index?{...payment,...patch}:payment)); }
  return <div className="space-y-3">
    <label className="flex cursor-pointer items-center gap-2 font-medium"><input type="checkbox" checked={enabled} onChange={(event)=>{ onEnabled(event.target.checked); }}/>تم استلام دفعة</label>
    {enabled?<div className="space-y-2">
      {payments.map((payment,index)=><div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
        <Select value={payment.payment_method_name} onValueChange={(value)=>{ update(index,{payment_method_name:value}); }}><SelectTrigger><SelectValue placeholder="طريقة السداد"/></SelectTrigger><SelectContent>{methods.map((method)=><SelectItem key={method} value={method}>{method}</SelectItem>)}</SelectContent></Select>
        <Input type="number" min="0.01" step="0.01" dir="ltr" placeholder="المبلغ" value={payment.amount||""} onChange={(event)=>{ update(index,{amount:Number(event.target.value)}); }}/>
        <Button type="button" size="icon" variant="ghost" disabled={payments.length===1} onClick={()=>{ onPayments(payments.filter((_,i)=>i!==index)); }}><Trash2 className="size-4"/></Button>
      </div>)}
      <Button type="button" size="sm" variant="outline" onClick={()=>{ onPayments([...payments,{payment_method_name:"",amount:0}]); }}><Plus className="size-4"/>إضافة دفعة</Button>
      <div className="grid grid-cols-2 gap-2 rounded bg-background p-3 text-sm"><span>إجمالي الدفعات: <strong dir="ltr">{formatCurrency(collected)}</strong></span><span>المبلغ المستحق: <strong dir="ltr" className={collected>total?"text-destructive":""}>{formatCurrency(Math.max(0,total-collected))}</strong></span></div>
      {collected>total?<p className="text-sm text-destructive">لا يمكن أن يتجاوز المبلغ المحصل إجمالي الفاتورة.</p>:null}
    </div>:null}
  </div>
}
