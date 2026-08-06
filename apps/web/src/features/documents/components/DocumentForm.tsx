import { useState } from "react"
import { useForm } from "react-hook-form"
import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { Save, Send } from "lucide-react"
import { db } from "@/lib/db"
import type { Document, DocumentType } from "@/lib/db"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select"
import { Textarea } from "@/shared/components/ui/textarea"
import { Separator } from "@/shared/components/ui/separator"
import { CustomerSelector } from "./CustomerSelector"
import { ItemsTable } from "./ItemsTable"
import { TotalsSection } from "./TotalsSection"
import { PaymentCollection, type CollectedPayment } from "./PaymentCollection"
import { DOCUMENT_TYPE_LABELS } from "../lib/calculations"
import { generateId } from "@/shared/utils"
import { toast } from "@/shared/hooks/useToast"
import { createDocumentDraft, fetchSettings, issueDocumentDraft, updateDocumentDraft, type DocumentDraftInput } from "@/lib/platform/api"

// ─── Schema ───────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  id: z.string(),
  description: z.string().min(1, "الوصف مطلوب"),
  unit: z.string().optional(),
  quantity: z.number().positive().default(1),
  unit_price: z.number().min(0).default(0),
  discount_percent: z.number().min(0).max(100).default(0),
  retention_percent: z.number().min(0).max(100).default(0),
  subtotal: z.number().default(0),
})

const docSchema = z.object({
  type: z.enum(["tax_invoice", "simplified_invoice", "quotation", "proforma", "receipt_voucher"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "اكتب التاريخ بصيغة YYYY/MM/DD"),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "اكتب التاريخ بصيغة YYYY/MM/DD").optional().or(z.literal("")),
  reference_number: z.string().optional(),
  purchase_order: z.string().optional(),
  customer_name: z.string().min(1, "اسم العميل مطلوب"),
  customer_id: z.string().min(1, "اختر عميلاً محفوظًا"),
  customer_vat_number: z.string().optional(),
  customer_phone: z.string().optional(),
  customer_email: z.string().optional(),
  customer_address: z.string().optional(),
  items: z.array(itemSchema).min(1, "أضف بنداً واحداً على الأقل"),
  vat_rate: z.number().default(15),
  vat_inclusive: z.boolean().default(false),
  discount_amount: z.number().min(0).default(0),
  retention_amount: z.number().min(0).default(0),
  notes: z.string().optional(),
  payment_method: z.string().optional(),
})

export type DocumentFormData = z.infer<typeof docSchema>

interface Props {
  initialType?: DocumentType
  draft?: Document
  initialAppearance?: { show_stamp: boolean; show_signature: boolean }
  initialPayments?: CollectedPayment[]
  initialTerms?: string[]
}

// ─── Component ────────────────────────────────────────────────────────────────
export function DocumentForm({ initialType = "tax_invoice", draft, initialAppearance, initialPayments = [], initialTerms = [] }: Props) {
  const navigate = useNavigate()
  const [isSaving, setIsSaving] = useState(false)
  const [isIssuing, setIsIssuing] = useState(false)
  const [appearance, setAppearance] = useState(initialAppearance ?? { show_stamp: false, show_signature: false })
  const [availableAppearance, setAvailableAppearance] = useState({ stamp: false, signature: false })
  const [notesEnabled, setNotesEnabled] = useState(Boolean(draft?.notes))
  const [termsEnabled,setTermsEnabled]=useState(draft?.type==="quotation")
  const [quotationTerms,setQuotationTerms]=useState<string[]>(initialTerms)
  const [collectPayment,setCollectPayment]=useState(initialPayments.length>0)
  const [payments,setPayments]=useState<CollectedPayment[]>(initialPayments.length?initialPayments:[{payment_method_name:"",amount:0}])

  const org = useLiveQuery(() => db.organizations.toArray().then((r) => r[0]))

  const today = new Date().toISOString().split("T")[0]

  const form = useForm<DocumentFormData>({
    resolver: zodResolver(docSchema),
    defaultValues: draft
      ? {
          type: draft.type,
          date: draft.date,
          due_date: draft.due_date ?? "",
          reference_number: "",
          purchase_order: draft.purchase_order ?? "",
          customer_name: draft.customer_name,
          customer_id: draft.customer_id ?? "",
          customer_vat_number: draft.customer_vat_number ?? "",
          customer_phone: draft.customer_phone ?? "",
          customer_email: draft.customer_email ?? "",
          customer_address: draft.customer_address ?? "",
          items: draft.items.map((i) => ({ ...i, retention_percent:i.retention_percent??0, subtotal: i.subtotal })),
          vat_rate: draft.vat_rate,
          vat_inclusive: draft.vat_inclusive,
          discount_amount: draft.discount_amount,
          retention_amount: draft.retention_amount,
          notes: draft.notes ?? "",
          payment_method: draft.payment_method ?? "",
        }
      : {
          type: initialType,
          date: today,
          due_date: "",
          reference_number: "",
          purchase_order: "",
          customer_name: "",
          customer_id: "",
          customer_vat_number: "",
          customer_phone: "",
          customer_email: "",
          customer_address: "",
          items: [{ id: generateId(), description: "", unit: "", quantity: 1, unit_price: 0, discount_percent: 0, retention_percent:0, subtotal: 0 }],
          vat_rate: 15,
          vat_inclusive: false,
          discount_amount: 0,
          retention_amount: 0,
          notes: "",
          payment_method: "",
        },
  })

  const { register, watch, setValue } = form
  const docType = watch("type")
  const isQuotation = docType === "quotation"
  const [paymentMethods,setPaymentMethods]=useState<string[]>([])
  useEffect(()=>{void fetchSettings().then((settings)=>{
    setPaymentMethods(settings.payment_methods.filter((method)=>method.is_active).map((method)=>method.name))
    if(!draft)setQuotationTerms(settings.quotation_terms.filter((term)=>term.is_active).map((term)=>term.text))
    const organization=settings.organization
    const hasStamp=Boolean(organization.stamp_url)
    const hasSignature=Boolean(organization.signature_url)
    setAvailableAppearance({stamp:hasStamp,signature:hasSignature})
    if(!draft){const suffix=initialType==="quotation"?"quotation":"invoice";setAppearance({show_stamp:hasStamp&&Boolean(organization[`stamp_on_${suffix}`]),show_signature:hasSignature&&Boolean(organization[`signature_on_${suffix}`])});setValue("vat_inclusive",Boolean(organization.prices_include_tax))}
  })},[draft,setValue])

  const toCentralDraft = (data: DocumentFormData): DocumentDraftInput => ({
    type: data.type === "quotation" ? "quotation" : "invoice",
    customer_id: data.customer_id,
    issue_date: data.date,
    due_date: isQuotation ? undefined : data.due_date || undefined,
    prices_include_tax: data.vat_inclusive,
    retention_basis: !isQuotation && data.items.some((item)=>item.retention_percent>0) ? "before_tax" : undefined,
    discount_amount: isQuotation ? 0 : data.discount_amount,
    notes: !isQuotation && notesEnabled ? data.notes || undefined : undefined,
    show_bank_details: !isQuotation && (data.payment_method==="تحويل بنكي" || (collectPayment && payments.some((payment)=>payment.payment_method_name==="تحويل بنكي"))),
    show_stamp: appearance.show_stamp,
    show_signature: appearance.show_signature,
    reference_data: isQuotation ? {} : { purchase_order: data.purchase_order, reference_number: data.reference_number, payment_method: data.payment_method },
    payments: !isQuotation && collectPayment ? payments : [],
    terms: isQuotation && termsEnabled ? quotationTerms.filter((term)=>term.trim()) : [],
    items: data.items.map((item) => ({ description:item.description,unit:item.unit,quantity:item.quantity,unit_price:item.unit_price,discount_percent:isQuotation?0:item.discount_percent,retention_percent:isQuotation?0:item.retention_percent })),
  })

  const saveDraft = form.handleSubmit(async (data) => {
    setIsSaving(true)
    try {
      if(!isQuotation&&collectPayment&&payments.some((payment)=>!payment.payment_method_name||payment.amount<=0))throw new Error("اختر طريقة السداد وأدخل مبلغًا صحيحًا لكل دفعة")
      if (draft) await updateDocumentDraft(draft.id, toCentralDraft(data))
      else await createDocumentDraft(toCentralDraft(data))
      await navigate({ to: "/documents" })
      toast({ title: "تم الحفظ", description: "تم حفظ المسودة بنجاح", variant: "success" })
    } catch (error) {
      toast({ title: "تعذر حفظ المسودة", description: error instanceof Error ? error.message : "حاول مرة أخرى", variant: "error" })
    } finally {
      setIsSaving(false)
    }
  })

  const issueDocument = form.handleSubmit(async (data) => {
    setIsIssuing(true)
    try {
      if(!isQuotation&&collectPayment&&payments.some((payment)=>!payment.payment_method_name||payment.amount<=0))throw new Error("اختر طريقة السداد وأدخل مبلغًا صحيحًا لكل دفعة")
      const saved = draft ? await updateDocumentDraft(draft.id, toCentralDraft(data)) : await createDocumentDraft(toCentralDraft(data))
      await issueDocumentDraft(saved.document_id)
      await navigate({ to: "/documents/$id", params: { id: saved.document_id } })
    } catch (error) {
      toast({ title: "تعذر إصدار الفاتورة", description: error instanceof Error ? error.message : "حاول مرة أخرى", variant: "error" })
    } finally {
      setIsIssuing(false)
    }
  })

  const changePaymentCollection = (enabled: boolean) => {
    setCollectPayment(enabled)
    const method = watch("payment_method")
    const firstPayment = payments[0]
    if (enabled && method && firstPayment && !firstPayment.payment_method_name) {
      setPayments([{ ...firstPayment, payment_method_name: method }])
    }
    if (enabled) setValue("payment_method", "")
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* ── Top bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={docType} onValueChange={(v) => { setValue("type", v as DocumentType) }}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tax_invoice">{DOCUMENT_TYPE_LABELS.tax_invoice}</SelectItem>
            <SelectItem value="quotation">{DOCUMENT_TYPE_LABELS.quotation}</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              void saveDraft()
            }}
            loading={isSaving}
            disabled={isIssuing}
            className="gap-2"
          >
            <Save className="size-4" />
            حفظ مسودة
          </Button>
          <Button
            onClick={() => {
              void issueDocument()
            }}
            loading={isIssuing}
            disabled={isSaving}
            className="gap-2"
          >
            <Send className="size-4" />
            إصدار المستند
          </Button>
        </div>
      </div>

      <Separator />

      {/* ── From / To ── */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* From (organization) */}
        <div className="space-y-1 rounded-lg border bg-muted/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">من</p>
          {org ? (
            <>
              <p className="font-semibold">{org.business_name}</p>
              {org.vat_number && <p className="text-sm text-muted-foreground" dir="ltr">{org.vat_number}</p>}
              {org.phone && <p className="text-sm text-muted-foreground">{org.phone}</p>}
              {org.city && <p className="text-sm text-muted-foreground">{[org.city, org.district].filter(Boolean).join("، ")}</p>}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">جاري التحميل...</p>
          )}
        </div>

        {/* To (customer) */}
        <div className="rounded-lg border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">إلى</p>
          <CustomerSelector
            values={{
              customer_id: watch("customer_id"),
              customer_name: watch("customer_name"),
              customer_vat_number: watch("customer_vat_number") ?? "",
              customer_phone: watch("customer_phone") ?? "",
              customer_email: watch("customer_email") ?? "",
              customer_address: watch("customer_address") ?? "",
            }}
            onChange={(fields) => {
              Object.entries(fields).forEach(([k, v]) => { setValue(k as keyof DocumentFormData, v) })
            }}
          />
          {form.formState.errors.customer_name && (
            <p className="mt-1 text-xs text-destructive">{form.formState.errors.customer_name.message}</p>
          )}
        </div>
      </div>

      {/* ── Document meta ── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="date">تاريخ المستند *</Label>
          <Input id="date" type="date" dir="ltr" {...register("date")} />
          <p className="text-xs text-muted-foreground">يظهر في المستند بصيغة YYYY/MM/DD</p>
        </div>
        {!isQuotation&&<div className="space-y-1.5">
          <Label htmlFor="due_date">تاريخ الاستحقاق</Label>
          <Input id="due_date" type="date" dir="ltr" {...register("due_date")} />
        </div>}
        {!isQuotation&&<div className="space-y-1.5">
          <Label htmlFor="reference_number">رقم المرجع</Label>
          <Input id="reference_number" placeholder="REF-001" dir="ltr" {...register("reference_number")} />
        </div>}
        {!isQuotation&&<div className="space-y-1.5">
          <Label htmlFor="purchase_order">أمر الشراء</Label>
          <Input id="purchase_order" placeholder="PO-001" dir="ltr" {...register("purchase_order")} />
        </div>}
      </div>

      <Separator />

      {/* ── Items ── */}
      <div>
        <p className="mb-3 text-sm font-semibold">البنود</p>
        <ItemsTable form={form} isQuotation={isQuotation} />
        {form.formState.errors.items?.root && (
          <p className="mt-1 text-xs text-destructive">{form.formState.errors.items.root.message}</p>
        )}
      </div>

      <Separator />

      {/* ── Totals + Notes ── */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          {!isQuotation?<div className="space-y-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notesEnabled} onChange={(event)=>{setNotesEnabled(event.target.checked);if(!event.target.checked)setValue("notes","")}}/>إضافة ملاحظات</label>{notesEnabled&&<Textarea placeholder="ملاحظات تظهر في المستند..." rows={4} {...register("notes")} />}</div>:<div className="space-y-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={termsEnabled} onChange={(event)=>{ setTermsEnabled(event.target.checked); }}/>إضافة الشروط والأحكام</label>{termsEnabled&&<div className="space-y-2">{quotationTerms.map((term,index)=><Textarea key={index} rows={2} value={term} onChange={(event)=>{ setQuotationTerms(quotationTerms.map((item,i)=>i===index?event.target.value:item)); }}/>)}<Button type="button" size="sm" variant="outline" onClick={()=>{ setQuotationTerms([...quotationTerms,""]); }}>إضافة شرط</Button></div>}</div>}
          {!isQuotation&&!collectPayment&&<div className="space-y-1.5"><Label>طريقة السداد</Label><Select value={watch("payment_method")||"none"} onValueChange={(value)=>{const method=value==="none"?"":value;setValue("payment_method",method);if(method){setCollectPayment(false);setPayments([{payment_method_name:"",amount:0}])}}}><SelectTrigger><SelectValue placeholder="اختر طريقة السداد"/></SelectTrigger><SelectContent><SelectItem value="none">غير محددة</SelectItem>{paymentMethods.map((method)=><SelectItem key={method} value={method}>{method}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">طريقة السداد المتفق عليها مع العميل، سواء تم استلام دفعة الآن أم لا.</p></div>}
          {(availableAppearance.stamp||availableAppearance.signature)&&<div className="space-y-2 rounded-lg border p-3"><Label>مظهر هذه الفاتورة</Label>{availableAppearance.stamp&&<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={appearance.show_stamp} onChange={(event)=>{setAppearance((current)=>({...current,show_stamp:event.target.checked}))}}/>إظهار ختم المنشأة</label>}{availableAppearance.signature&&<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={appearance.show_signature} onChange={(event)=>{setAppearance((current)=>({...current,show_signature:event.target.checked}))}}/>إظهار توقيع المنشأة</label>}<p className="text-xs text-muted-foreground">يمكن إخفاؤهما لهذه الفاتورة فقط دون تغيير الإعدادات العامة.</p></div>}
        </div>
        <TotalsSection form={form} isQuotation={isQuotation}>{!isQuotation&&!watch("payment_method")?<PaymentCollection form={form} methods={paymentMethods} enabled={collectPayment} onEnabled={changePaymentCollection} payments={payments} onPayments={setPayments}/>:null}</TotalsSection>
      </div>
    </div>
  )
}
