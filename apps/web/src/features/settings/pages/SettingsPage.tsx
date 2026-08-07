import { useEffect, useState } from "react"
import { Building2, CreditCard, FileText, Landmark, Palette, Save, ChartNoAxesCombined } from "lucide-react"
import { BrandingSettings } from "../components/BrandingSettings"
import { fetchSettings, saveSettings, type SettingsPayload } from "@/lib/platform/api"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { Textarea } from "@/shared/components/ui/textarea"
import { toast } from "@/shared/hooks/useToast"

export type Form = { [key: string]: unknown; payment_methods: SettingsPayload["payment_methods"]; quotation_terms: string[]; invoice: number; quotation: number; receipt: number }
const tabs = [
  ["organization", "بيانات المنشأة", Building2], ["address", "العنوان والتواصل", Landmark],
  ["bank", "الحساب البنكي", CreditCard], ["documents", "إعدادات المستندات", FileText],
  ["branding", "الهوية البصرية", Palette],
  ["financial", "القوائم المالية", ChartNoAxesCombined],
] as const

export default function SettingsPage() {
  const [active, setActive] = useState<(typeof tabs)[number][0]>("organization")
  const [form, setForm] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => { void fetchSettings().then((data) => {
    const o=data.organization, seq=Object.fromEntries(data.sequences.map((s) => [s.document_type, s.next_number]))
    setForm({ ...o, payment_methods:data.payment_methods, quotation_terms:data.quotation_terms.map((t)=>t.text), invoice:Number(seq.invoice)||1, quotation:Number(seq.quotation)||1, receipt:Number(seq.receipt)||1 })
  }).catch((error:unknown)=>{ toast({title:"تعذر تحميل الإعدادات",description:error instanceof Error?error.message:"حاول مرة أخرى",variant:"error"}); }) }, [])
  if (!form) return <div className="p-6 text-muted-foreground">جاري تحميل الإعدادات...</div>
  const set=(key:string,value:string|boolean|number)=>{ setForm((current)=>current ? ({...current,[key]:value}) : current); }
  const financialEnabled=form.financial_reporting_enabled === true
  const legalForm=typeof form.legal_form === "string" ? form.legal_form : "sole_establishment"
  const field=(key:string,label:string, options?:{readOnly?:boolean;required?:boolean;dir?:"ltr"})=>{const value=form[key];return <div className="space-y-1.5">
    <Label htmlFor={key}>{label}{options?.required ? " *" : ""}</Label>
    <Input id={key} value={typeof value==="string"||typeof value==="number"?String(value):""} readOnly={options?.readOnly} required={options?.required} dir={options?.dir} className={options?.readOnly?"bg-muted":""} onChange={(e)=>{ set(key,["invoice","quotation","receipt"].includes(key)?Number(e.target.value):e.target.value); }} />
  </div>}
  const submit=async()=>{setSaving(true);try{await saveSettings({
    commercial_registration:form.commercial_registration,phone:form.phone,email:form.email,
    show_phone_on_documents:Boolean(form.show_phone_on_documents),show_email_on_documents:Boolean(form.show_email_on_documents),
    city:form.city,district:form.district,street:form.street,building_number:form.building_number,postal_code:form.postal_code,
    additional_number:form.additional_number,short_address:form.short_address,bank_enabled:Boolean(form.bank_enabled),
    bank_name:form.bank_name,bank_account_name:form.bank_account_name,iban:form.iban,prices_include_tax:Boolean(form.prices_include_tax),
    retention_enabled:Boolean(form.retention_enabled),invoice_default_notes:form.invoice_default_notes,
    quotation_default_notes:form.quotation_default_notes,receipt_default_notes:form.receipt_default_notes,
    receipt_default_phrase:form.receipt_default_phrase,payment_methods:form.payment_methods,quotation_terms:form.quotation_terms,
    stamp_on_invoice:Boolean(form.stamp_on_invoice),stamp_on_quotation:Boolean(form.stamp_on_quotation),stamp_on_receipt:Boolean(form.stamp_on_receipt),
    signature_on_invoice:Boolean(form.signature_on_invoice),signature_on_quotation:Boolean(form.signature_on_quotation),signature_on_receipt:Boolean(form.signature_on_receipt),
    sequences:{invoice:form.invoice,quotation:form.quotation,receipt:form.receipt},
    financial_reporting_enabled:Boolean(form.financial_reporting_enabled),legal_form:form.legal_form || "sole_establishment",fiscal_year_start_month:Number(form.fiscal_year_start_month)||1,
  });toast({title:"تم الحفظ",description:"حُفظت الإعدادات مركزيًا",variant:"success"})}catch(e){toast({title:"تعذر الحفظ",description:e instanceof Error?e.message:"حاول مرة أخرى",variant:"error"})}finally{setSaving(false)}}
  return <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6" dir="rtl">
    <div><h1 className="text-2xl font-bold">الإعدادات</h1><p className="text-sm text-muted-foreground">كل ما يظهر في مستندات منشأتك ويُحفظ مركزيًا.</p></div>
    <div className="grid gap-5 lg:grid-cols-[230px_1fr]">
      <nav className="flex gap-2 overflow-x-auto lg:flex-col">{tabs.map(([id,label,Icon])=><button key={id} onClick={()=>{ setActive(id); }} className={`flex min-w-max items-center gap-2 rounded-lg px-3 py-2 text-sm ${active===id?"bg-primary text-primary-foreground":"border bg-card"}`}><Icon className="size-4"/>{label}</button>)}</nav>
      <form onSubmit={(e)=>{e.preventDefault();void submit()}} className="space-y-5 rounded-xl border bg-card p-4 sm:p-6">
        {active==="organization"&&<><h2 className="text-lg font-semibold">بيانات المنشأة</h2><div className="grid gap-4 sm:grid-cols-2">
          {field("id","معرف النظام",{readOnly:true,dir:"ltr"})}{field("country","الدولة",{readOnly:true})}
          {field("business_name","اسم المنشأة",{readOnly:true})}{field("vat_number","الرقم الضريبي",{readOnly:true,dir:"ltr"})}
          {field("commercial_registration","رقم السجل التجاري",{required:true,dir:"ltr"})}
        </div><p className="text-xs text-muted-foreground">اسم المنشأة والرقم الضريبي ومعرف النظام بيانات تأسيس ثابتة لا تُعدّل من هنا.</p></>}
        {active==="address"&&<><h2 className="text-lg font-semibold">العنوان الوطني والتواصل</h2><div className="grid gap-4 sm:grid-cols-2">
          {field("city","المدينة",{required:true})}{field("district","الحي",{required:true})}{field("street","اسم الشارع",{required:true})}
          {field("building_number","رقم المبنى (اختياري - 4 أرقام)",{dir:"ltr"})}{field("postal_code","الرمز البريدي (اختياري - 5 أرقام)",{dir:"ltr"})}
          {field("additional_number","الرقم الإضافي (اختياري)",{dir:"ltr"})}{field("short_address","العنوان الوطني المختصر (اختياري)",{dir:"ltr"})}
          {field("phone","رقم الجوال",{dir:"ltr"})}{field("email","البريد الإلكتروني",{dir:"ltr"})}
        </div><div className="grid gap-2 sm:grid-cols-2"><Check label="إظهار رقم الجوال في المستندات" checked={Boolean(form.show_phone_on_documents)} onChange={(v)=>{ set("show_phone_on_documents",v); }}/><Check label="إظهار البريد في المستندات" checked={Boolean(form.show_email_on_documents)} onChange={(v)=>{ set("show_email_on_documents",v); }}/></div></>}
        {active==="bank"&&<><h2 className="text-lg font-semibold">الحساب البنكي للمنشأة</h2><Check label="إضافة حساب بنكي للمنشأة" checked={Boolean(form.bank_enabled)} onChange={(v)=>{ set("bank_enabled",v); }}/>{Boolean(form.bank_enabled)&&<div className="grid gap-4 sm:grid-cols-2">{field("bank_name","اسم البنك",{required:true})}{field("bank_account_name","اسم المستفيد",{required:true})}<div className="sm:col-span-2">{field("iban","رقم الآيبان",{required:true,dir:"ltr"})}</div></div>}<p className="text-xs text-muted-foreground">يمكن استبدال بيانات الحساب الحالي وحفظ الحساب الجديد. نعتمد حسابًا واحدًا فقط.</p></>}
        {active==="documents"&&<><h2 className="text-lg font-semibold">الضريبة والمستندات</h2><div className="grid gap-3 sm:grid-cols-2"><button type="button" className={`rounded-lg border p-3 text-start ${!form.prices_include_tax?"border-primary bg-primary/5":""}`} onClick={()=>{set("prices_include_tax",false)}}>الأسعار غير شاملة الضريبة <span className="block text-xs text-muted-foreground">تُضاف ضريبة 15% إلى السعر</span></button><button type="button" className={`rounded-lg border p-3 text-start ${form.prices_include_tax?"border-primary bg-primary/5":""}`} onClick={()=>{set("prices_include_tax",true)}}>الأسعار شاملة الضريبة <span className="block text-xs text-muted-foreground">يُستخرج مقدار الضريبة من السعر</span></button><Check label="تفعيل حجز ضمان الأعمال" checked={Boolean(form.retention_enabled)} onChange={(v)=>{ set("retention_enabled",v); }}/></div>
          <div><h3 className="mb-3 font-medium">عدادات المستندات</h3><div className="grid gap-4 sm:grid-cols-3">{field("invoice","عداد الفاتورة",{required:true,dir:"ltr"})}{field("quotation","عداد عرض السعر",{required:true,dir:"ltr"})}{field("receipt","عداد سند القبض / الاستلام",{required:true,dir:"ltr"})}</div><p className="mt-2 text-xs text-muted-foreground">القيمة الافتراضية 00001، ويُحجز الرقم النهائي عند الإصدار فقط.</p></div>
          <div className="space-y-2"><Label>قالب عام لشروط عروض الأسعار</Label><Textarea rows={6} value={form.quotation_terms.join("\n")} onChange={(e)=>{ setForm({...form,quotation_terms:e.target.value.split("\n").filter(Boolean)}); }}/><p className="text-xs text-muted-foreground">كل سطر بند مستقل ويمكن تعديله داخل العرض دون تغيير القالب.</p></div></>}
        {active==="branding"&&<BrandingSettings form={form} setForm={setForm} />}
        {active==="financial"&&<><h2 className="text-lg font-semibold">القوائم المالية</h2><Check label="تفعيل المصروفات والتقارير والقوائم المالية" checked={financialEnabled} onChange={(value)=>{set("financial_reporting_enabled",value)}}/><p className="text-sm text-muted-foreground">بعد التفعيل يسجل النظام المصروفات بتصنيفات بسيطة، ثم يرتبها خلفيًا لإعداد تقارير الربح والخسارة ومعالج نهاية السنة.</p>{financialEnabled?<div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label>الشكل القانوني</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={legalForm} onChange={(e)=>{set("legal_form",e.target.value)}}><option value="sole_establishment">مؤسسة فردية</option><option value="limited_liability">شركة ذات مسؤولية محدودة</option><option value="simplified_joint_stock">شركة مساهمة مبسطة</option><option value="joint_stock">شركة مساهمة</option><option value="partnership">شركة تضامن</option><option value="limited_partnership">شركة توصية بسيطة</option></select></div>{field("fiscal_year_start_month","شهر بداية السنة المالية",{required:true,dir:"ltr"})}<p className="text-xs text-muted-foreground sm:col-span-2">القيمة 1 تعني يناير. سيستخدمها معالج نهاية السنة لتحديد فترة القوائم والمقارنة السنوية.</p></div>:null}</>}
        <div className="flex justify-end border-t pt-4"><Button type="submit" loading={saving} className="gap-2"><Save className="size-4"/>حفظ التعديلات</Button></div>
      </form>
    </div>
  </div>
}

function Check({label,checked,onChange}:{label:string;checked:boolean;onChange:(value:boolean)=>void}){return <label className="flex items-center gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" checked={checked} onChange={(e)=>{ onChange(e.target.checked); }}/><span>{label}</span></label>}
