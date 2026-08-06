import { useEffect, useState, type ReactNode } from "react"
import { useNavigate } from "@tanstack/react-router"
import { ArrowRight, Save } from "lucide-react"
import { createReceipt, fetchSettings, listCustomers, type CentralCustomer } from "@/lib/platform/api"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select"
import { Textarea } from "@/shared/components/ui/textarea"
import { toast } from "@/shared/hooks/useToast"

const today = new Date().toISOString().split("T")[0] ?? ""

export function NewReceiptPage() {
  const navigate = useNavigate()
  const [customers,setCustomers]=useState<CentralCustomer[]>([])
  const [methods,setMethods]=useState<string[]>([])
  const [registered,setRegistered]=useState(true)
  const [customerId,setCustomerId]=useState("")
  const [payerName,setPayerName]=useState("")
  const [payerPhone,setPayerPhone]=useState("")
  const [payerEmail,setPayerEmail]=useState("")
  const [payerVat,setPayerVat]=useState("")
  const [amount,setAmount]=useState("")
  const [method,setMethod]=useState("")
  const [date,setDate]=useState(today)
  const [reference,setReference]=useState("")
  const [notes,setNotes]=useState("")
  const [showStamp,setShowStamp]=useState(false)
  const [showSignature,setShowSignature]=useState(false)
  const [hasStamp,setHasStamp]=useState(false)
  const [hasSignature,setHasSignature]=useState(false)
  const [saving,setSaving]=useState(false)
  const [requestId]=useState(()=>crypto.randomUUID())

  useEffect(()=>{void Promise.all([listCustomers(),fetchSettings()]).then(([customerResult,settings])=>{
    setCustomers(customerResult.customers)
    setMethods(settings.payment_methods.filter((item)=>item.is_active).map((item)=>item.name))
    const stamp=Boolean(settings.organization.stamp_url),signature=Boolean(settings.organization.signature_url)
    setHasStamp(stamp);setHasSignature(signature)
    setShowStamp(stamp&&Boolean(settings.organization.stamp_on_receipt))
    setShowSignature(signature&&Boolean(settings.organization.signature_on_receipt))
    setNotes(String(settings.organization.receipt_default_notes??""))
  }).catch((error:unknown)=>{toast({title:"تعذر تحميل بيانات سند القبض",description:error instanceof Error?error.message:"حاول مرة أخرى",variant:"error"})})},[])

  const submit=async()=>{
    const value=Number(amount)
    if((registered&&!customerId)||(!registered&&!payerName.trim())||value<=0||!method||!date){toast({title:"أكمل الحقول المطلوبة",description:"حدد الدافع والمبلغ وطريقة السداد والتاريخ.",variant:"error"});return}
    setSaving(true)
    try{
      const result=await createReceipt({customer_id:registered?customerId:undefined,payer_name:registered?undefined:payerName,payer_phone:registered?undefined:payerPhone,payer_email:registered?undefined:payerEmail,payer_vat_number:registered?undefined:payerVat,amount:value,payment_method_name:method,receipt_date:date,reference_number:reference||undefined,notes:notes||undefined,show_stamp:showStamp,show_signature:showSignature,request_id:requestId})
      toast({title:`تم إصدار سند القبض رقم ${result.receipt.number}`,variant:"success"})
      await navigate({to:"/receipts/$id",params:{id:result.receipt.id}})
    }catch(error){toast({title:"تعذر إصدار سند القبض",description:error instanceof Error?error.message:"حاول مرة أخرى",variant:"error"})}finally{setSaving(false)}
  }

  return <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6" dir="rtl">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">سند قبض جديد</h1><p className="text-sm text-muted-foreground">سجّل المبلغ المستلم وأصدر سندًا رسميًا مباشرة.</p></div><Button variant="ghost" onClick={()=>{void navigate({to:"/documents"})}}><ArrowRight className="size-4"/>عودة</Button></div>
    <section className="space-y-5 rounded-xl border bg-card p-4 sm:p-6">
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1"><Button type="button" variant={registered?"default":"ghost"} onClick={()=>{setRegistered(true)}}>عميل مسجل</Button><Button type="button" variant={!registered?"default":"ghost"} onClick={()=>{setRegistered(false)}}>مستلم غير مسجل</Button></div>
      {registered?<Field label="العميل *"><Select value={customerId} onValueChange={setCustomerId}><SelectTrigger><SelectValue placeholder="اختر العميل"/></SelectTrigger><SelectContent>{customers.map((customer)=><SelectItem key={customer.id} value={customer.id}>{customer.name} — {customer.vat_number}</SelectItem>)}</SelectContent></Select></Field>:<div className="grid gap-4 sm:grid-cols-2"><Field label="اسم الدافع *"><Input value={payerName} onChange={(event)=>{setPayerName(event.target.value)}}/></Field><Field label="رقم الجوال — اختياري"><Input dir="ltr" value={payerPhone} onChange={(event)=>{setPayerPhone(event.target.value)}}/></Field><Field label="البريد الإلكتروني — اختياري"><Input type="email" dir="ltr" value={payerEmail} onChange={(event)=>{setPayerEmail(event.target.value)}}/></Field><Field label="الرقم الضريبي — اختياري"><Input dir="ltr" inputMode="numeric" maxLength={15} value={payerVat} onChange={(event)=>{setPayerVat(event.target.value.replace(/\D/g,""))}}/></Field></div>}
      <div className="grid gap-4 sm:grid-cols-2"><Field label="المبلغ المستلم *"><Input type="number" min="0.01" step="0.01" dir="ltr" value={amount} onChange={(event)=>{setAmount(event.target.value)}}/></Field><Field label="طريقة السداد *"><Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue placeholder="اختر طريقة السداد"/></SelectTrigger><SelectContent>{methods.map((item)=><SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field><Field label="تاريخ الاستلام *"><Input type="date" dir="ltr" value={date} onChange={(event)=>{setDate(event.target.value)}}/></Field><Field label="الرقم المرجعي — اختياري"><Input dir="ltr" value={reference} onChange={(event)=>{setReference(event.target.value)}}/></Field></div>
      <Field label="ملاحظات — اختيارية"><Textarea rows={3} value={notes} onChange={(event)=>{setNotes(event.target.value)}}/></Field>
      {(hasStamp||hasSignature)?<div className="space-y-2 border-t pt-4"><p className="text-sm font-medium">مظهر السند</p>{hasStamp?<Toggle checked={showStamp} label="إظهار ختم المنشأة" onChange={setShowStamp}/>:null}{hasSignature?<Toggle checked={showSignature} label="إظهار توقيع المنشأة" onChange={setShowSignature}/>:null}</div>:null}
      <Button className="w-full gap-2" loading={saving} onClick={()=>{void submit()}}><Save className="size-4"/>حفظ وإصدار سند القبض</Button>
    </section>
  </div>
}

function Field({label,children}:{label:string;children:ReactNode}){return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>}
function Toggle({checked,label,onChange}:{checked:boolean;label:string;onChange:(value:boolean)=>void}){return <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checked} onChange={(event)=>{onChange(event.target.checked)}}/>{label}</label>}
