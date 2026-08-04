import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createCustomer, updateCustomer, type CentralCustomer } from "@/lib/platform/api"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { toast } from "@/shared/hooks/useToast"

const schema=z.object({
  name:z.string().trim().min(2,"اسم العميل مطلوب"),
  vat_number:z.string().regex(/^3\d{13}3$/,"الرقم الضريبي 15 رقمًا ويبدأ وينتهي بالرقم 3"),
  commercial_registration:z.string().optional(),phone:z.string().optional(),email:z.string().email("البريد غير صحيح").optional().or(z.literal("")),notes:z.string().optional(),
  city:z.string().trim().min(1,"المدينة مطلوبة"),district:z.string().trim().min(1,"الحي مطلوب"),street:z.string().trim().min(1,"الشارع مطلوب"),
  building_number:z.string().regex(/^\d{4}$/,"رقم المبنى 4 أرقام"),postal_code:z.string().regex(/^\d{5}$/,"الرمز البريدي 5 أرقام"),
  additional_number:z.string().regex(/^\d{4}$/,"الرقم الإضافي 4 أرقام").optional().or(z.literal("")),short_address:z.string().optional(),
})
type FormData=z.infer<typeof schema>
const empty:FormData={name:"",vat_number:"",commercial_registration:"",phone:"",email:"",notes:"",city:"",district:"",street:"",building_number:"",postal_code:"",additional_number:"",short_address:""}

export function CustomerDialog({open,onClose,customer,onSaved}:{open:boolean;onClose:()=>void;customer?:CentralCustomer;onSaved:(customer:CentralCustomer)=>void}){
  const form=useForm<FormData>({resolver:zodResolver(schema),defaultValues:empty})
  useEffect(()=>{if(open)form.reset(customer?{...empty,...customer}:empty)},[open,customer])
  const submit=form.handleSubmit(async(data)=>{try{const result=customer?await updateCustomer(customer.id,data):await createCustomer(data);onSaved(result.customer);onClose();toast({title:customer?"تم تحديث العميل":"تمت إضافة العميل",variant:"success"})}catch(e){toast({title:"تعذر الحفظ",description:e instanceof Error?e.message:"حاول مرة أخرى",variant:"error"})}})
  const field=(key:keyof FormData,label:string,required=false,dir?:"ltr")=><div className="space-y-1.5"><Label htmlFor={key}>{label}{required?" *":""}</Label><Input id={key} dir={dir} {...form.register(key)}/>{form.formState.errors[key]&&<p className="text-xs text-destructive">{form.formState.errors[key]?.message}</p>}</div>
  return <Dialog open={open} onOpenChange={(v)=>{if(!v)onClose()}}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" dir="rtl"><DialogHeader><DialogTitle>{customer?"تعديل العميل":"عميل جديد"}</DialogTitle></DialogHeader>
    <form onSubmit={(e)=>void submit(e)} className="space-y-5"><section className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2">{field("name","اسم العميل",true)}</div>{field("vat_number","الرقم الضريبي",true,"ltr")}{field("commercial_registration","السجل التجاري",false,"ltr")}{field("phone","رقم الجوال",false,"ltr")}{field("email","البريد الإلكتروني",false,"ltr")}</section>
      <section className="space-y-3 border-t pt-4"><div><h3 className="font-semibold">العنوان الوطني السعودي</h3><p className="text-xs text-muted-foreground">مطلوب لإصدار فاتورة ضريبية B2B صحيحة.</p></div><div className="grid gap-4 sm:grid-cols-2">{field("city","المدينة",true)}{field("district","الحي",true)}{field("street","اسم الشارع",true)}{field("building_number","رقم المبنى",true,"ltr")}{field("postal_code","الرمز البريدي",true,"ltr")}{field("additional_number","الرقم الإضافي",false,"ltr")}{field("short_address","العنوان المختصر",false,"ltr")}</div></section>
      <DialogFooter className="gap-2"><Button type="button" variant="outline" onClick={onClose}>إلغاء</Button><Button type="submit" loading={form.formState.isSubmitting}>حفظ العميل</Button></DialogFooter></form>
  </DialogContent></Dialog>
}
