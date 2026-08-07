import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Link } from "@tanstack/react-router"
import { Camera, CircleDollarSign, FileDown, History, X } from "lucide-react"
import {
  addTaxPurchasePayment,
  cancelTaxPurchasePayment,
  fetchTaxPurchase,
  listTaxPurchases,
  setTaxPurchaseStatus,
  type TaxPurchase,
  type TaxPurchasePaymentInput,
} from "@/lib/platform/api"
import { formatCurrency, formatDate } from "@/shared/utils"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select"
import { Textarea } from "@/shared/components/ui/textarea"
import { toast } from "@/shared/hooks/useToast"

type PaymentMethod = TaxPurchasePaymentInput["payment_method"]
const paymentMethods: Array<{ value: PaymentMethod; label: string }> = [
  { value: "cash", label: "نقدي" },
  { value: "bank_transfer", label: "تحويل بنكي" },
  { value: "card", label: "شبكة" },
  { value: "sadad", label: "سداد" },
]
const paymentMethodLabel = new Map(paymentMethods.map((method) => [method.value, method.label]))
const normalizeIban = (value: string) => value.replace(/\s+/g, "").toUpperCase()

export function PurchasesPage() {
  const [purchases, setPurchases] = useState<TaxPurchase[]>()
  const [settling, setSettling] = useState<TaxPurchase>()
  const [statusAction, setStatusAction] = useState<{ purchase: TaxPurchase; status: TaxPurchase["status"] }>()
  const [error, setError] = useState("")
  const load = useCallback(async () => {
    try {
      setPurchases((await listTaxPurchases()).purchases)
      setError("")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تحميل فواتير المشتريات")
    }
  }, [])
  useEffect(() => { void load() }, [load])

  function downloadCsv() {
    const rows = [["رقم EasyTAX", "رقم فاتورة المورد", "المورد", "الرقم الضريبي", "التاريخ", "قبل الضريبة", "الضريبة", "الإجمالي", "المدفوع", "المتبقي", "حالة الإقرار"],
      ...(purchases ?? []).map((purchase) => [purchase.internal_number, purchase.invoice_number, purchase.supplier_name, purchase.supplier_vat_number, purchase.invoice_date, purchase.subtotal, purchase.tax_total, purchase.total, purchase.paid_amount, Math.max(0, Number(purchase.total) - Number(purchase.paid_amount)), purchase.status])]
    const csv = "\uFEFF" + rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n")
    const link = document.createElement("a")
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    link.download = "كشف-المشتريات-الضريبية.csv"
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return <div className="space-y-6 p-4 sm:p-6" dir="rtl">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-bold">فواتير المشتريات الضريبية</h1><p className="mt-1 text-sm text-muted-foreground">فواتير QR تدخل سجل المشتريات ماليًا، ويمكن تحديد إدراجها في الإقرار وتتبع سدادها بشكل مستقل.</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={downloadCsv} disabled={!purchases?.length}><FileDown className="me-2 size-4" />تحميل الكشف</Button><Button asChild><Link to="/purchases/scan"><Camera className="me-2 size-4" />مسح فاتورة</Link></Button></div>
    </div>
    <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900"><strong>مهم:</strong> استبعاد الفاتورة من الإقرار يمنع خصم ضريبتها فقط، ولا يحذف تكلفة الشراء من القوائم المالية. الإلغاء هو الإجراء الوحيد الذي يلغيها محاسبيًا.</div>
    {error ? <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-destructive">{error}</div> : null}
    <Card><CardHeader><CardTitle className="text-lg">سجل المشتريات</CardTitle></CardHeader><CardContent className="overflow-x-auto">
      {!purchases ? <p className="py-10 text-center text-muted-foreground">جاري التحميل…</p> : purchases.length === 0 ? <div className="py-14 text-center"><Camera className="mx-auto mb-3 size-10 text-muted-foreground/40" /><p className="font-medium">لا توجد فواتير مشتريات ضريبية</p><p className="mt-1 text-sm text-muted-foreground">ابدأ بمسح QR من فاتورة المورد.</p></div> :
      <table className="w-full min-w-[1120px] text-sm"><thead><tr className="border-b text-muted-foreground"><th className="p-3 text-start">الرقم الداخلي</th><th className="p-3 text-start">المورد</th><th className="p-3 text-start">فاتورة المورد</th><th className="p-3 text-start">التاريخ</th><th className="p-3 text-end">الضريبة</th><th className="p-3 text-end">قيمة الفاتورة</th><th className="p-3 text-end">المدفوع</th><th className="p-3 text-end">المتبقي</th><th className="p-3 text-center">الإقرار</th><th className="p-3"></th></tr></thead>
        <tbody>{purchases.map((purchase) => {
          const remaining = Math.max(0, Number(purchase.total) - Number(purchase.paid_amount))
          return <tr key={purchase.id} className="border-b last:border-0"><td className="p-3 font-mono font-semibold text-primary">{purchase.internal_number}</td><td className="p-3"><div className="font-medium">{purchase.supplier_name}</div><div className="text-xs text-muted-foreground" dir="ltr">{purchase.supplier_vat_number}</div></td><td className="p-3">{purchase.invoice_number}</td><td className="p-3" dir="ltr">{formatDate(purchase.invoice_date)}</td><td className="p-3 text-end tabular-nums">{formatCurrency(Number(purchase.tax_total))}</td><td className="p-3 text-end font-medium tabular-nums">{formatCurrency(Number(purchase.total))}</td><td className="p-3 text-end tabular-nums">{formatCurrency(Number(purchase.paid_amount))}</td><td className={`p-3 text-end font-bold tabular-nums ${remaining > 0 ? "text-destructive" : "text-emerald-700"}`}>{formatCurrency(remaining)}</td><td className="p-3 text-center"><TaxStatus status={purchase.status} /></td><td className="p-3"><div className="flex items-center justify-end gap-2"><Button size="sm" variant={remaining > 0 && purchase.status !== "cancelled" ? "default" : "outline"} disabled={purchase.status === "cancelled"} onClick={() => { setSettling(purchase) }}><CircleDollarSign className="size-4" />{remaining > 0 ? "سداد" : "الدفعات"}</Button>{purchase.status === "cancelled" ? <span className="text-xs text-muted-foreground">مغلقة</span> : <select aria-label="إجراء على فاتورة المشتريات" className="rounded-md border bg-background px-2 py-1" value="" onChange={(event) => { const status = event.target.value; if (status !== "included" && status !== "excluded" && status !== "cancelled") return; if (status === "cancelled" && Number(purchase.paid_amount) > 0) { toast({ title: "اعكس الدفعات أولًا", description: "لا يمكن إلغاء فاتورة مدفوعة قبل عكس جميع دفعاتها. فُتح سجل الدفعات لتتمكن من مراجعتها.", variant: "error" }); setSettling(purchase); return } setStatusAction({ purchase, status }) }}><option value="">إجراء…</option>{purchase.status === "excluded" ? <option value="included">إعادة الإدراج في الإقرار</option> : <option value="excluded">استبعاد من الإقرار</option>}<option value="cancelled">{Number(purchase.paid_amount) > 0 ? "إلغاء — اعكس الدفعات أولًا" : "إلغاء الفاتورة"}</option></select>}</div></td></tr>
        })}</tbody>
      </table>}
    </CardContent></Card>
    {settling ? <PurchasePaymentDialog purchase={settling} onClose={() => { setSettling(undefined) }} onChanged={async () => { await load() }} /> : null}
    {statusAction ? <PurchaseStatusDialog purchase={statusAction.purchase} status={statusAction.status} onClose={() => { setStatusAction(undefined) }} onChanged={async () => { setStatusAction(undefined); await load() }} /> : null}
  </div>
}

function PurchaseStatusDialog({ purchase, status, onClose, onChanged }: { purchase: TaxPurchase; status: TaxPurchase["status"]; onClose: () => void; onChanged: () => Promise<void> }) {
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const needsReason = status !== "included"
  const titles = { included: "إعادة إدراج الفاتورة", excluded: "استبعاد الفاتورة من الإقرار", cancelled: "إلغاء فاتورة المشتريات" } as const
  const descriptions = {
    included: "ستعود ضريبة الفاتورة إلى سجل المشتريات في الإقرار الضريبي.",
    excluded: "لن تدخل ضريبة الفاتورة في الإقرار، لكن تكلفة الشراء ستبقى في القوائم المالية.",
    cancelled: "سيُعكس أثر الفاتورة محاسبيًا وتُغلق نهائيًا. لا يمكن التراجع عن الإلغاء.",
  } as const
  const submit = async () => {
    const cleanReason = reason.trim()
    if (needsReason && cleanReason.length < 3) {
      toast({ title: "اكتب سببًا واضحًا", description: "يجب أن يتكون السبب من ثلاثة أحرف على الأقل.", variant: "error" })
      return
    }
    setSaving(true)
    try {
      await setTaxPurchaseStatus(purchase.id, status, needsReason ? cleanReason : undefined)
      await onChanged()
      toast({ title: status === "excluded" ? "تم استبعاد الفاتورة من الإقرار" : status === "included" ? "تمت إعادة إدراج الفاتورة" : "تم إلغاء الفاتورة", description: status === "excluded" ? "بقيت تكلفة الشراء ضمن القوائم المالية." : undefined, variant: "success" })
    } catch (caught) {
      toast({ title: "تعذر تنفيذ الإجراء", description: caught instanceof Error ? caught.message : "حاول مرة أخرى", variant: "error" })
    } finally {
      setSaving(false)
    }
  }
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="purchase-status-title">
    <Card className="w-full max-w-lg"><CardHeader><CardTitle id="purchase-status-title" className="text-lg">{titles[status]}</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm leading-6 text-muted-foreground">{descriptions[status]}</p>{needsReason ? <div><Label htmlFor="purchase-status-reason">سبب الإجراء *</Label><Textarea id="purchase-status-reason" className="mt-1" value={reason} onChange={(event) => { setReason(event.target.value) }} placeholder={status === "cancelled" ? "مثال: أُدخلت الفاتورة بالخطأ" : "مثال: الفاتورة ليست باسم المنشأة"} /></div> : null}<div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose} disabled={saving}>رجوع</Button><Button variant={status === "cancelled" ? "destructive" : "default"} loading={saving} onClick={() => { void submit() }}>تأكيد الإجراء</Button></div></CardContent></Card>
  </div>
}

function TaxStatus({ status }: { status: TaxPurchase["status"] }) {
  if (status === "included") return <Badge variant="success">داخل الإقرار</Badge>
  if (status === "excluded") return <Badge variant="warning">مستبعد ضريبيًا</Badge>
  return <Badge variant="destructive">ملغاة</Badge>
}

function PurchasePaymentDialog({ purchase, onClose, onChanged }: { purchase: TaxPurchase; onClose: () => void; onChanged: () => Promise<void> }) {
  const [details, setDetails] = useState(purchase)
  const [amount, setAmount] = useState(String(Math.max(0, Number(purchase.total) - Number(purchase.paid_amount))))
  const [method, setMethod] = useState<PaymentMethod>(purchase.last_payment_method ?? "bank_transfer")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [iban, setIban] = useState(purchase.beneficiary_iban ?? "")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [reversing, setReversing] = useState<NonNullable<TaxPurchase["payments"]>[number]>()
  const [reverseReason, setReverseReason] = useState("")
  const [reverseSaving, setReverseSaving] = useState(false)

  const refresh = useCallback(async () => {
    const result = await fetchTaxPurchase(purchase.id)
    setDetails(result.purchase)
    setAmount(String(Math.max(0, Number(result.purchase.total) - Number(result.purchase.paid_amount))))
  }, [purchase.id])
  useEffect(() => { void refresh() }, [refresh])

  const remaining = Math.max(0, Number(details.total) - Number(details.paid_amount))
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      await addTaxPurchasePayment(details.id, { amount: Number(amount), payment_method: method, payment_date: date, beneficiary_name: details.supplier_name, beneficiary_iban: iban.trim() ? normalizeIban(iban) : undefined, reference_number: reference.trim() || undefined, notes: notes.trim() || undefined })
      await refresh()
      await onChanged()
      setReference("")
      setNotes("")
      toast({ title: "تم تسجيل دفعة المشتريات", description: "حُدّث المتبقي وذمم الموردين والتدفق النقدي.", variant: "success" })
    } catch (caught) {
      toast({ title: "تعذر تسجيل الدفعة", description: caught instanceof Error ? caught.message : "راجع البيانات", variant: "error" })
    } finally {
      setSaving(false)
    }
  }

  const cancelPayment = async () => {
    const reason = reverseReason.trim()
    if (!reversing || reason.length < 3) {
      toast({ title: "اكتب سببًا واضحًا", description: "يجب أن يتكون سبب العكس من ثلاثة أحرف على الأقل.", variant: "error" })
      return
    }
    setReverseSaving(true)
    try {
      await cancelTaxPurchasePayment(details.id, reversing.id, reason)
      await refresh()
      await onChanged()
      setReversing(undefined)
      setReverseReason("")
      toast({ title: "تم عكس الدفعة", description: "أعيد المبلغ إلى رصيد المورد مع الاحتفاظ بسجل المراجعة.", variant: "success" })
    } catch (caught) {
      toast({ title: "تعذر عكس الدفعة", description: caught instanceof Error ? caught.message : "حاول مرة أخرى", variant: "error" })
    } finally {
      setReverseSaving(false)
    }
  }

  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="purchase-payment-title">
    <div className="mx-auto my-6 max-w-2xl space-y-5 rounded-xl bg-background p-5 shadow-xl">
      <div className="flex items-start justify-between gap-4"><div><h2 id="purchase-payment-title" className="text-xl font-bold">سداد فاتورة مشتريات</h2><p className="mt-1 text-sm text-muted-foreground">{details.supplier_name} — {details.internal_number}</p></div><Button aria-label="إغلاق" type="button" size="icon" variant="ghost" onClick={onClose}><X className="size-4" /></Button></div>
      <div className="grid gap-3 sm:grid-cols-3"><Summary label="قيمة الفاتورة" value={Number(details.total)} /><Summary label="إجمالي المدفوع" value={Number(details.paid_amount)} /><Summary label="المتبقي" value={remaining} danger={remaining > 0} /></div>
      {remaining > 0 && details.status !== "cancelled" ? <form className="space-y-4 rounded-xl border p-4" onSubmit={(event) => { void submit(event) }}>
        <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="purchase-payment-amount">مبلغ الدفعة *</Label><Input id="purchase-payment-amount" className="mt-1" type="number" min="0.01" max={remaining} step="0.01" dir="ltr" value={amount} onChange={(event) => { setAmount(event.target.value) }} required /></div><div><Label htmlFor="purchase-payment-date">تاريخ السداد *</Label><Input id="purchase-payment-date" className="mt-1" type="date" value={date} onChange={(event) => { setDate(event.target.value) }} required /></div></div>
        <div><Label>طريقة السداد *</Label><Select value={method} onValueChange={(value) => { setMethod(value as PaymentMethod) }}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{paymentMethods.map((paymentMethod) => <SelectItem key={paymentMethod.value} value={paymentMethod.value}>{paymentMethod.label}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="purchase-payment-iban">آيبان المورد (اختياري)</Label><Input id="purchase-payment-iban" className="mt-1" dir="ltr" value={iban} onChange={(event) => { setIban(event.target.value) }} placeholder="SA0000000000000000000000" /><p className="mt-1 text-xs text-muted-foreground">يمكن حفظه للرجوع إليه عند تحويل دفعة لاحقة، ولا يصبح إلزاميًا بسبب اختيار التحويل البنكي.</p></div>
        <div><Label htmlFor="purchase-payment-reference">رقم المرجع{method === "sadad" ? " *" : ""}</Label><Input id="purchase-payment-reference" className="mt-1" value={reference} onChange={(event) => { setReference(event.target.value) }} required={method === "sadad"} /></div>
        <div><Label htmlFor="purchase-payment-notes">ملاحظات</Label><Textarea id="purchase-payment-notes" className="mt-1" value={notes} onChange={(event) => { setNotes(event.target.value) }} /></div>
        <div className="flex justify-end"><Button type="submit" loading={saving}>تسجيل الدفعة</Button></div>
      </form> : <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">الفاتورة مسددة بالكامل. يمكنك مراجعة الدفعات أو عكس دفعة خاطئة أدناه.</div>}
      <section className="space-y-2"><h3 className="flex items-center gap-2 font-semibold"><History className="size-4" />سجل الدفعات</h3>{details.payments?.length ? details.payments.map((payment) => <div key={payment.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm ${payment.status === "cancelled" ? "opacity-60" : ""}`}><div><p className="font-medium">{formatCurrency(Number(payment.amount))} — {paymentMethodLabel.get(payment.payment_method)}</p><p className="text-xs text-muted-foreground" dir="ltr">{payment.payment_date}{payment.reference_number ? ` · ${payment.reference_number}` : ""}</p></div>{payment.status === "cancelled" ? <Badge variant="outline">معكوسة</Badge> : <Button type="button" size="sm" variant="outline" onClick={() => { setReversing(payment); setReverseReason("") }}>عكس الدفعة</Button>}</div>) : <p className="rounded-lg bg-muted/30 p-4 text-center text-sm text-muted-foreground">لا توجد دفعات مسجلة.</p>}</section>
    </div>
    {reversing ? <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby="reverse-payment-title"><Card className="w-full max-w-md"><CardHeader><CardTitle id="reverse-payment-title" className="text-lg">عكس دفعة مشتريات</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">سيُعاد مبلغ {formatCurrency(Number(reversing.amount))} إلى رصيد المورد ويُحفظ قيد عكسي كامل.</p><div><Label htmlFor="purchase-reverse-reason">سبب العكس *</Label><Textarea id="purchase-reverse-reason" className="mt-1" value={reverseReason} onChange={(event) => { setReverseReason(event.target.value) }} placeholder="مثال: سُجلت الدفعة بالخطأ" /></div><div className="flex justify-end gap-2"><Button variant="outline" disabled={reverseSaving} onClick={() => { setReversing(undefined); setReverseReason("") }}>رجوع</Button><Button variant="destructive" loading={reverseSaving} onClick={() => { void cancelPayment() }}>تأكيد عكس الدفعة</Button></div></CardContent></Card></div> : null}
  </div>
}

function Summary({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 font-bold tabular-nums ${danger ? "text-destructive" : ""}`} dir="ltr">{formatCurrency(value)}</p></div>
}
