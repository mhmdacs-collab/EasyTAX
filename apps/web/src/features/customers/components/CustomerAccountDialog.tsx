import { useCallback, useEffect, useState, type ReactNode } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { HandCoins, ReceiptText } from "lucide-react"
import { createReceipt, fetchCustomerAccount, fetchSettings, type CentralCustomer, type CustomerAccount } from "@/lib/platform/api"
import { Button } from "@/shared/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select"
import { Textarea } from "@/shared/components/ui/textarea"
import { toast } from "@/shared/hooks/useToast"
import { formatCurrency, formatDate } from "@/shared/utils"

const today = new Date().toISOString().split("T")[0] ?? ""

export function CustomerAccountDialog({customer,onClose}:{customer:CentralCustomer;onClose:()=>void}){
  const navigate=useNavigate()
  const[account,setAccount]=useState<CustomerAccount>(),[loading,setLoading]=useState(true),[receiving,setReceiving]=useState(false),[saving,setSaving]=useState(false)
  const[methods,setMethods]=useState<string[]>([]),[amount,setAmount]=useState(""),[method,setMethod]=useState(""),[date,setDate]=useState(today),[reference,setReference]=useState(""),[notes,setNotes]=useState("")
  const[showStamp,setShowStamp]=useState(false),[showSignature,setShowSignature]=useState(false)
  const[requestId]=useState(()=>crypto.randomUUID())
  const load=useCallback(async()=>{setLoading(true);try{setAccount(await fetchCustomerAccount(customer.id))}catch(error){toast({title:"تعذر تحميل حساب العميل",description:error instanceof Error?error.message:"حاول مرة أخرى",variant:"error"})}finally{setLoading(false)}},[customer.id,toast])
  useEffect(()=>{void load();void fetchSettings().then((settings)=>{setMethods(settings.payment_methods.filter((item)=>item.is_active).map((item)=>item.name));setShowStamp(Boolean(settings.organization.stamp_url&&settings.organization.stamp_on_receipt));setShowSignature(Boolean(settings.organization.signature_url&&settings.organization.signature_on_receipt))})},[load])
  const receive=async()=>{const value=Number(amount);if(value<=0||!method){toast({title:"أدخل المبلغ واختر طريقة السداد",variant:"error"});return}setSaving(true);try{const result=await createReceipt({customer_id:customer.id,amount:value,payment_method_name:method,receipt_date:date,reference_number:reference||undefined,notes:notes||undefined,show_stamp:showStamp,show_signature:showSignature,request_id:requestId});toast({title:`تم إصدار سند القبض رقم ${result.receipt.number}`,variant:"success"});onClose();await navigate({to:"/receipts/$id",params:{id:result.receipt.id}})}catch(error){toast({title:"تعذر تسجيل الدفعة",description:error instanceof Error?error.message:"حاول مرة أخرى",variant:"error"})}finally{setSaving(false)}}
  const summary=account?.summary
  return <Dialog open onOpenChange={(open)=>{if(!open)onClose()}}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl" dir="rtl"><DialogHeader><DialogTitle>حساب العميل — {customer.name}</DialogTitle></DialogHeader>
    {loading?<p className="py-16 text-center text-muted-foreground">جاري تحميل الحساب...</p>:account?<div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Card label="إجمالي الفواتير الصادرة" value={summary?.invoice_total??0}/><Card label="إجمالي ضمان الأعمال" value={summary?.retention_total??0}/><Card label="إجمالي المستلم" value={summary?.received_total??0}/><Card label="إجمالي المتبقي" value={summary?.balance??0} balance/></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">الموجب مستحق على العميل، والسالب دفعة مقدمة لصالحه.</p><Button className="gap-2" onClick={()=>{setReceiving((value)=>!value)}}><HandCoins className="size-4"/>استلام دفعة</Button></div>
      {receiving?<section className="space-y-4 rounded-xl border bg-muted/20 p-4"><h3 className="font-semibold">استلام دفعة وإصدار سند قبض</h3><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="المبلغ"><Input type="number" min="0.01" step="0.01" dir="ltr" value={amount} onChange={(event)=>{setAmount(event.target.value)}}/></Field><Field label="طريقة السداد"><Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue placeholder="اختر الطريقة"/></SelectTrigger><SelectContent>{methods.map((item)=><SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field><Field label="تاريخ الاستلام"><Input type="date" dir="ltr" value={date} onChange={(event)=>{setDate(event.target.value)}}/></Field><Field label="الرقم المرجعي — اختياري"><Input dir="ltr" value={reference} onChange={(event)=>{setReference(event.target.value)}}/></Field><div className="sm:col-span-2"><Field label="ملاحظة — اختيارية"><Textarea value={notes} onChange={(event)=>{setNotes(event.target.value)}}/></Field></div></div><div className="flex gap-2"><Button loading={saving} onClick={()=>{void receive()}}>حفظ وإصدار السند</Button><Button variant="outline" onClick={()=>{setReceiving(false)}}>إلغاء</Button></div></section>:null}
      <section className="overflow-hidden rounded-xl border"><div className="flex items-center gap-2 border-b bg-muted/40 p-3 font-semibold"><ReceiptText className="size-4"/>كشف حركة العميل</div>{account.movements.length?<div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b text-muted-foreground"><th className="p-3 text-start">التاريخ</th><th className="p-3 text-start">العملية</th><th>رقم المستند</th><th>قيمة الفاتورة</th><th>ضمان الأعمال</th><th>المستلم</th><th>الرصيد</th></tr></thead><tbody>{account.movements.map((row)=><tr key={`${row.kind}-${row.source_id}`} className="border-b last:border-0"><td className="p-3">{formatDate(row.event_date)}</td><td className="p-3">{row.kind==="invoice"?"فاتورة صادرة":row.kind==="receipt"?`سند قبض${row.payment_method_name?` — ${row.payment_method_name}`:""}`:`دفعة مستلمة${row.payment_method_name?` — ${row.payment_method_name}`:""}`}</td><td className="text-center font-mono">{row.kind==="receipt"?<Link className="text-primary underline" to="/receipts/$id" params={{id:row.source_id}}>{row.number}</Link>:row.kind==="invoice"?<Link className="text-primary underline" to="/documents/$id" params={{id:row.source_id}}>{row.number}</Link>:row.number}</td><Money value={row.invoice_total}/><Money value={row.retention_total}/><Money value={row.received}/><Money value={row.balance} balance/></tr>)}</tbody></table></div>:<p className="p-10 text-center text-muted-foreground">لا توجد حركات حتى الآن.</p>}</section>
    </div>:null}
  </DialogContent></Dialog>
}

function Card({label,value,balance=false}:{label:string;value:number;balance?:boolean}){return <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-2 text-xl font-bold ${balance&&value<0?"text-primary":""}`} dir="ltr">{formatCurrency(value)}</p></div>}
function Field({label,children}:{label:string;children:ReactNode}){return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>}
function Money({value,balance=false}:{value:number;balance?:boolean}){return <td className={`p-3 text-center tabular-nums ${balance&&value<0?"text-primary font-semibold":""}`} dir="ltr">{value?formatCurrency(value):"—"}</td>}
