import { useState } from "react"
import { useForm } from "react-hook-form"
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
import { calcItemSubtotal, calcDocumentTotals, DOCUMENT_TYPE_LABELS } from "../lib/calculations"
import { nextDocumentNumber } from "../lib/numbering"
import { generateId } from "@/shared/utils"
import { toast } from "@/shared/hooks/useToast"

// ─── Schema ───────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  id: z.string(),
  description: z.string().min(1, "الوصف مطلوب"),
  unit: z.string().optional(),
  quantity: z.number().positive().default(1),
  unit_price: z.number().min(0).default(0),
  discount_percent: z.number().min(0).max(100).default(0),
  subtotal: z.number().default(0),
})

const docSchema = z.object({
  type: z.enum(["tax_invoice", "simplified_invoice", "quotation", "proforma", "receipt_voucher"]),
  date: z.string().min(1, "التاريخ مطلوب"),
  due_date: z.string().optional(),
  reference_number: z.string().optional(),
  purchase_order: z.string().optional(),
  customer_name: z.string().min(1, "اسم العميل مطلوب"),
  customer_id: z.string().optional(),
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
  terms_and_conditions: z.string().optional(),
  payment_method: z.string().optional(),
})

export type DocumentFormData = z.infer<typeof docSchema>

interface Props {
  initialType?: DocumentType
  draft?: Document
}

// ─── Component ────────────────────────────────────────────────────────────────
export function DocumentForm({ initialType = "tax_invoice", draft }: Props) {
  const navigate = useNavigate()
  const [isSaving, setIsSaving] = useState(false)
  const [isIssuing, setIsIssuing] = useState(false)

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
          items: draft.items.map((i) => ({ ...i, subtotal: i.subtotal })),
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
          items: [{ id: generateId(), description: "", unit: "", quantity: 1, unit_price: 0, discount_percent: 0, subtotal: 0 }],
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

  const buildDocument = (data: DocumentFormData, status: "draft" | "issued", number: string, orgId: string): Document => {
    const items = data.items.map((item) => ({
      ...item,
      subtotal: calcItemSubtotal(item.unit_price, item.quantity, item.discount_percent),
    }))
    const totals = calcDocumentTotals(
      items,
      data.vat_rate,
      data.vat_inclusive,
      data.discount_amount,
      data.retention_amount
    )
    const now = new Date().toISOString()
    return {
      id: draft?.id ?? generateId(),
      organization_id: orgId,
      type: data.type,
      status,
      number,
      date: data.date,
      due_date: data.due_date || undefined,
      customer_id: data.customer_id || undefined,
      customer_name: data.customer_name,
      customer_vat_number: data.customer_vat_number || undefined,
      customer_phone: data.customer_phone || undefined,
      customer_email: data.customer_email || undefined,
      customer_address: data.customer_address || undefined,
      operation_type: "service",
      purchase_order: data.purchase_order || undefined,
      items,
      subtotal: totals.subtotal,
      discount_amount: totals.discount_amount,
      retention_amount: totals.retention_amount,
      vat_amount: totals.vat_amount,
      total: totals.total,
      vat_rate: data.vat_rate,
      vat_inclusive: data.vat_inclusive,
      notes: data.notes || undefined,
      terms_and_conditions: data.terms_and_conditions || undefined,
      payment_method: data.payment_method || undefined,
      issued_at: status === "issued" ? now : undefined,
      created_at: draft?.created_at ?? now,
      updated_at: now,
      sync_status: "pending",
      version: (draft?.version ?? 0) + 1,
    }
  }

  const saveDraft = form.handleSubmit(async (data) => {
    if (!org) return
    setIsSaving(true)
    try {
      const number = draft?.number ?? "DRAFT"
      const doc = buildDocument(data, "draft", number, org.id)
      if (draft) await db.documents.put(doc)
      else await db.documents.add(doc)
      await navigate({ to: "/documents" })
      toast({ title: "تم الحفظ", description: "تم حفظ المسودة بنجاح", variant: "success" })
    } finally {
      setIsSaving(false)
    }
  })

  const issueDocument = form.handleSubmit(async (data) => {
    if (!org) return
    setIsIssuing(true)
    try {
      const number = draft?.status === "draft" && draft.number !== "DRAFT"
        ? draft.number
        : await nextDocumentNumber(org.id, data.type)
      const doc = buildDocument(data, "issued", number, org.id)
      if (draft) await db.documents.put(doc)
      else await db.documents.add(doc)
      await navigate({ to: "/documents/$id", params: { id: doc.id } })
    } finally {
      setIsIssuing(false)
    }
  })

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* ── Top bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={docType} onValueChange={(v) => { setValue("type", v as DocumentType) }}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(DOCUMENT_TYPE_LABELS) as [DocumentType, string][]).map(([val, label]) => (
              <SelectItem key={val} value={val}>{label}</SelectItem>
            ))}
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
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="due_date">تاريخ الاستحقاق</Label>
          <Input id="due_date" type="date" dir="ltr" {...register("due_date")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reference_number">رقم المرجع</Label>
          <Input id="reference_number" placeholder="REF-001" dir="ltr" {...register("reference_number")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="purchase_order">أمر الشراء</Label>
          <Input id="purchase_order" placeholder="PO-001" dir="ltr" {...register("purchase_order")} />
        </div>
      </div>

      <Separator />

      {/* ── Items ── */}
      <div>
        <p className="mb-3 text-sm font-semibold">البنود</p>
        <ItemsTable form={form} />
        {form.formState.errors.items?.root && (
          <p className="mt-1 text-xs text-destructive">{form.formState.errors.items.root.message}</p>
        )}
      </div>

      <Separator />

      {/* ── Totals + Notes ── */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>ملاحظات</Label>
            <Textarea placeholder="ملاحظات تظهر في المستند..." rows={4} {...register("notes")} />
          </div>
          <div className="space-y-1.5">
            <Label>الشروط والأحكام</Label>
            <Textarea placeholder="شروط الدفع والتسليم..." rows={3} {...register("terms_and_conditions")} />
          </div>
        </div>
        <TotalsSection form={form} />
      </div>
    </div>
  )
}
