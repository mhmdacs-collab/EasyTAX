import { useCallback, useEffect, useState } from "react"
import { Download, LockKeyhole, Printer, UnlockKeyhole } from "lucide-react"
import { closeTaxReturn, fetchTaxReturnSummary, listDocuments, listTaxPurchases, unlockPeriod, type TaxReturnSummary } from "@/lib/platform/api"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { formatCurrency, formatDate } from "@/shared/utils"
import { dateWithinPeriod } from "../lib/period"
import { toast } from "@/shared/hooks/useToast"

const quarterNames = ["الأول", "الثاني", "الثالث", "الرابع"]

export function TaxReturnPage() {
  const [summary, setSummary] = useState<TaxReturnSummary>()
  const [error, setError] = useState("")
  const load=useCallback(async()=>{try{setSummary(await fetchTaxReturnSummary());setError("")}catch(caught){setError(caught instanceof Error?caught.message:"تعذر تحميل بيانات الإقرار")}},[])
  useEffect(()=>{void load()},[load])

  async function downloadSales() {
    if(!summary)return
    const documents=(await listDocuments()).documents.filter((item)=>["invoice","credit_note","debit_note"].includes(item.type)&&["issued","paid","partially_paid"].includes(item.status)&&dateWithinPeriod(item.issue_date,summary.period.starts_on,summary.period.ends_on))
    downloadCsv("كشف-المبيعات.csv",["نوع المستند","رقم المستند","التاريخ","العميل","الرقم الضريبي","قبل الضريبة","الضريبة","الإجمالي","الفاتورة الأصلية"],documents.map((item)=>{const sign=item.type==="credit_note"?-1:1;return[item.type==="credit_note"?"إشعار دائن":item.type==="debit_note"?"إشعار مدين":"فاتورة",item.number,item.issue_date,item.customer_snapshot.name,item.customer_snapshot.vat_number,sign*(Number(item.total)-Number(item.tax_total)),sign*Number(item.tax_total),sign*Number(item.total),item.reference_data.source_invoice_number]}))
  }
  async function downloadPurchases() {
    if(!summary)return
    const purchases=(await listTaxPurchases()).purchases.filter((item)=>item.status==="included"&&dateWithinPeriod(item.invoice_date,summary.period.starts_on,summary.period.ends_on))
    downloadCsv("كشف-المشتريات.csv",["رقم EasyTAX","فاتورة المورد","التاريخ","المورد","الرقم الضريبي","قبل الضريبة","الضريبة","الإجمالي"],purchases.map((item)=>[item.internal_number,item.invoice_number,item.invoice_date,item.supplier_name,item.supplier_vat_number,item.subtotal,item.tax_total,item.total]))
  }
  async function toggleLock(){
    if(!summary)return
    try{
      if(summary.period.status==="closed"&&summary.period.lock_id){
        const reason=window.prompt("سبب إعادة فتح الإقرار (سيحفظ في سجل التدقيق):")?.trim();if(!reason)return
        await unlockPeriod(summary.period.lock_id,reason)
        toast({title:"تمت إعادة فتح الإقرار",variant:"success"})
      }else{
        if(!window.confirm("سيتم حفظ أرقام الإقرار الحالية وقفل جميع الحركات داخل هذه الفترة. هل تريد المتابعة؟"))return
        await closeTaxReturn(summary.period.year,summary.period.quarter)
        toast({title:"تم اعتماد الإقرار وقفل الفترة",description:"لن يقبل النظام مستندًا أو دفعة داخلها حتى إعادة فتحها بسبب موثق.",variant:"success"})
      }
      await load()
    }catch(error){toast({title:"تعذر تغيير حالة الإقرار",description:error instanceof Error?error.message:"حاول مرة أخرى",variant:"error"})}
  }
  if(error)return <div className="m-6 rounded-lg border border-destructive/40 bg-destructive/5 p-5 text-destructive">{error}</div>
  if(!summary)return <div className="p-10 text-center text-muted-foreground">جاري إعداد الإقرار…</div>
  const netLabel=summary.net_tax>0?"المستحق للهيئة":summary.net_tax<0?"رصيد دائن للمنشأة":"لا يوجد مبلغ مستحق"
  return <div className="space-y-6 p-4 sm:p-6 print:p-0">
    <div className="flex flex-wrap items-start justify-between gap-3 print:hidden"><div><h1 className="text-2xl font-bold">الإقرار الضريبي</h1><p className="mt-1 text-sm text-muted-foreground">تقرير مساعد مبني على المبيعات وفواتير المشتريات المشمولة.</p></div><Badge variant={summary.period.status==="closed"?"success":"warning"}>{summary.period.status==="closed"?"مقفل":summary.period.status==="open"?"جاري":"بانتظار المراجعة"}</Badge></div>
    <Card className="print:border-0 print:shadow-none"><CardHeader className="border-b"><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>الإقرار الضريبي للقيمة المضافة</CardTitle><p className="mt-2 text-sm text-muted-foreground">الربع {quarterNames[summary.period.quarter-1]} {summary.period.year}</p></div><div className="text-sm"><p className="font-medium">{summary.organization.business_name}</p><p className="mt-1 font-mono text-muted-foreground" dir="ltr">{summary.organization.vat_number}</p></div></div></CardHeader><CardContent className="space-y-6 pt-6">
      <div className="grid gap-4 sm:grid-cols-3"><Metric title="إجمالي المبيعات شامل الضريبة" value={summary.sales.total} detail={`قبل الضريبة: ${formatCurrency(summary.sales.taxable)}`}/><Metric title="إجمالي المشتريات شامل الضريبة" value={summary.purchases.total} detail={`قبل الضريبة: ${formatCurrency(summary.purchases.taxable)}`}/><Metric title={netLabel} value={Math.abs(summary.net_tax)} emphasized negative={summary.net_tax<0}/></div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 print:hidden">⏳ {summary.period.days_remaining} يومًا متبقيًا للموعد النهائي ({formatDate(summary.period.deadline)})</div>
      <ReturnSection title="ضريبة القيمة المضافة على المبيعات" rows={[
        ["المبيعات الخاضعة للضريبة الأساسية (15%)",summary.sales.taxable,summary.sales.adjustments,summary.sales.tax],
        ["المبيعات التي تتحمل الدولة ضريبتها",0,0,0],["المبيعات المحلية الخاضعة للنسبة الصفرية",0,0,0],["الصادرات",0,0,0],["المبيعات المعفاة من الضريبة",0,0,0],
      ]} total={[summary.sales.taxable,summary.sales.adjustments,summary.sales.tax]}/>
      <ReturnSection title="ضريبة القيمة المضافة على المشتريات" rows={[
        ["المشتريات الخاضعة للضريبة الأساسية (15%)",summary.purchases.taxable,summary.purchases.adjustments,summary.purchases.tax],
        ["الاستيرادات الخاضعة للضريبة والمدفوعة عند الاستيراد",0,0,0],["الاستيرادات التي تطبق عليها آلية الاحتساب العكسي",0,0,0],["المشتريات الخاضعة للنسبة الصفرية",0,0,0],["المشتريات المعفاة من الضريبة",0,0,0],
      ]} total={[summary.purchases.taxable,summary.purchases.adjustments,summary.purchases.tax]}/>
      <div className="overflow-hidden rounded-lg border"><SummaryRow label="إجمالي ضريبة القيمة المضافة المستحقة عن الفترة الحالية" value={summary.net_tax}/><SummaryRow label="تصحيحات عن الفترات السابقة" value={0}/><SummaryRow label="ضريبة القيمة المضافة المرحلة من الفترات السابقة" value={0}/><SummaryRow label="صافي الضريبة المستحقة" value={summary.net_tax} final/></div>
      <div><h3 className="mb-3 font-semibold">ملخص العمليات</h3><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Count label="فواتير مبيعات" value={summary.counts.sales}/><Count label="فواتير مشتريات" value={summary.counts.purchases}/><Count label="مرتجع مبيعات" value={summary.counts.sales_returns}/><Count label="مرتجع مشتريات" value={summary.counts.purchase_returns}/></div></div>
      <p className="text-center text-xs text-muted-foreground">{summary.notice}</p>
    </CardContent></Card>
    <div className="flex flex-wrap gap-2 print:hidden"><Button onClick={()=>{window.print()}}><Printer className="me-2 size-4"/>طباعة / حفظ التقرير المؤقت PDF</Button><Button variant="outline" onClick={()=>void downloadSales()}><Download className="me-2 size-4"/>تحميل كشف المبيعات</Button><Button variant="outline" onClick={()=>void downloadPurchases()}><Download className="me-2 size-4"/>تحميل كشف المشتريات</Button><Button variant={summary.period.status==="closed"?"outline":"default"} onClick={()=>void toggleLock()}>{summary.period.status==="closed"?<UnlockKeyhole className="me-2 size-4"/>:<LockKeyhole className="me-2 size-4"/>}{summary.period.status==="closed"?"إعادة فتح الفترة":"اعتماد وقفل الفترة"}</Button></div>
  </div>
}

function Metric({title,value,detail,emphasized=false,negative=false}:{title:string;value:number;detail?:string;emphasized?:boolean;negative?:boolean}) { return <div className={`rounded-lg border p-4 ${emphasized?negative?"border-emerald-300 bg-emerald-50":"border-primary/30 bg-primary/5":""}`}><p className="text-sm text-muted-foreground">{title}</p><p className="mt-2 text-xl font-bold tabular-nums">{formatCurrency(value)}</p>{detail?<p className="mt-1 text-xs text-muted-foreground">{detail}</p>:null}</div> }
function ReturnSection({title,rows,total}:{title:string;rows:Array<[string,number,number,number]>;total:[number,number,number]}) { return <section><h3 className="rounded-t-lg bg-cyan-600 px-4 py-2 font-semibold text-white">{title}</h3><div className="overflow-x-auto border border-t-0"><table className="w-full min-w-[650px] text-sm"><thead><tr className="bg-muted/50"><th className="p-2 text-start">البيان</th><th className="p-2 text-end">المبلغ</th><th className="p-2 text-end">مبلغ التعديل</th><th className="p-2 text-end">مبلغ الضريبة</th></tr></thead><tbody>{rows.map(([label,amount,adjustment,tax])=><tr key={label} className="border-t"><td className="p-2">{label}</td><td className="p-2 text-end tabular-nums">{amount.toFixed(2)}</td><td className="p-2 text-end tabular-nums">{adjustment.toFixed(2)}</td><td className="p-2 text-end tabular-nums">{tax.toFixed(2)}</td></tr>)}<tr className="border-t bg-cyan-50 font-bold"><td className="p-2">الإجمالي</td>{total.map((value,index)=><td key={index} className="p-2 text-end tabular-nums">{value.toFixed(2)}</td>)}</tr></tbody></table></div></section> }
function SummaryRow({label,value,final=false}:{label:string;value:number;final?:boolean}) { return <div className={`flex items-center justify-between gap-4 border-b px-4 py-2 last:border-0 ${final?"bg-cyan-600 font-bold text-white":""}`}><span>{label}</span><span className="tabular-nums">{value.toFixed(2)}</span></div> }
function Count({label,value}:{label:string;value:number}) { return <div className="rounded-lg border p-3 text-center"><p className="text-xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div> }
function downloadCsv(filename:string,headers:string[],rows:Array<Array<string|number|boolean|null|undefined>>) { const csv="\uFEFF"+[headers,...rows].map((row)=>row.map((value)=>`"${String(value??"").replace(/"/g,'""')}"`).join(",")).join("\n");const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));link.download=filename;link.click();URL.revokeObjectURL(link.href) }
