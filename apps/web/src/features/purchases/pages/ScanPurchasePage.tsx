import { useEffect, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser"
import { Camera, CheckCircle2, ImagePlus, ShieldAlert } from "lucide-react"
import { createTaxPurchase, type TaxPurchaseInput } from "@/lib/platform/api"
import { decodePurchaseQr, type PurchaseQrData } from "../lib/zatcaQr"
import { readQrFromInvoiceImage } from "../lib/imageQrReader"
import { Button } from "@/shared/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select"
import { formatCurrency, formatDate } from "@/shared/utils"

type PaymentStatus = TaxPurchaseInput["payment_status"]
type PaymentMethod = NonNullable<TaxPurchaseInput["initial_payment"]>["payment_method"]

const paymentMethods: Array<{ value: PaymentMethod; label: string }> = [
  { value: "cash", label: "نقدي" },
  { value: "bank_transfer", label: "تحويل بنكي" },
  { value: "card", label: "شبكة / بطاقة" },
  { value: "sadad", label: "سداد" },
]

const paymentStatuses: Array<{ value: PaymentStatus; label: string; description: string }> = [
  { value: "paid", label: "مدفوعة بالكامل", description: "سُدد كامل مبلغ الفاتورة." },
  { value: "partially_paid", label: "مدفوعة جزئيًا", description: "سُدد جزء وبقي مبلغ للمورد." },
  { value: "unpaid", label: "غير مدفوعة", description: "كامل المبلغ ما زال مستحقًا." },
]

export function ScanPurchasePage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls>()
  const navigate = useNavigate()
  const [scanning, setScanning] = useState(false)
  const [decoded, setDecoded] = useState<PurchaseQrData>()
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "">("")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("")
  const [paidAmount, setPaidAmount] = useState("")
  const [paymentReference, setPaymentReference] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState(false)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [readingImage, setReadingImage] = useState(false)
  useEffect(() => () => controlsRef.current?.stop(), [])

  function acceptRaw(raw: string) {
    try {
      const data = decodePurchaseQr(raw)
      controlsRef.current?.stop()
      setScanning(false)
      setDecoded(data)
      setError("")
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر قراءة QR")
    }
  }

  async function startCamera() {
    setError("")
    setScanning(true)
    try {
      const reader = new BrowserQRCodeReader()
      const video = videoRef.current
      if (!video) throw new Error("VIDEO_NOT_READY")
      controlsRef.current = await reader.decodeFromVideoDevice(undefined, video, (result) => {
        if (result) acceptRaw(result.getText())
      })
    } catch {
      setScanning(false)
      setError("تعذر فتح الكاميرا. اسمح للمتصفح باستخدامها أو ارفع صورة الفاتورة.")
    }
  }

  async function scanImage(file?: File) {
    if (!file) return
    setReadingImage(true)
    setError("")
    try {
      acceptRaw(await readQrFromInvoiceImage(file))
    } catch {
      setError("لم نتمكن من العثور على QR واضح في الصورة")
    } finally {
      setReadingImage(false)
    }
  }

  function choosePaymentStatus(status: PaymentStatus) {
    setPaymentStatus(status)
    setPaymentMethod("")
    setPaidAmount("")
    setPaymentReference("")
  }

  function resetScan() {
    setDecoded(undefined)
    setInvoiceNumber("")
    setPaymentStatus("")
    setPaymentMethod("")
    setPaidAmount("")
    setPaymentReference("")
    setConfirmed(false)
    setDuplicateWarning(false)
    setError("")
  }

  const numericPaidAmount = paymentStatus === "paid" ? decoded?.total ?? 0 : Number(paidAmount)
  const validPartialAmount = Boolean(decoded && numericPaidAmount > 0 && numericPaidAmount < decoded.total)
  const validPayment = paymentStatus === "unpaid" || Boolean(
    paymentStatus && paymentMethod &&
    (paymentStatus === "paid" || validPartialAmount) &&
    (paymentMethod !== "sadad" || paymentReference.trim()),
  )
  const canSave = Boolean(decoded && invoiceNumber.trim() && paymentStatus && validPayment && confirmed)

  async function save(override = false) {
    if (!decoded || !invoiceNumber.trim() || !paymentStatus || !validPayment || !confirmed) return
    setSaving(true)
    setError("")
    try {
      const initialPayment = paymentStatus === "unpaid" ? undefined : {
        amount: numericPaidAmount,
        payment_method: paymentMethod as PaymentMethod,
        reference_number: paymentReference.trim() || undefined,
      }
      await createTaxPurchase({
        supplier_name: decoded.sellerName,
        supplier_vat_number: decoded.sellerVatNumber,
        invoice_number: invoiceNumber.trim(),
        invoice_timestamp: decoded.timestamp,
        total: decoded.total,
        tax_total: decoded.taxTotal,
        qr_payload: decoded.raw,
        qr_fields: decoded.fields,
        duplicate_override: override,
        responsibility_confirmed: true,
        payment_status: paymentStatus,
        initial_payment: initialPayment,
      })
      await navigate({ to: "/purchases" })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "تعذر حفظ الفاتورة"
      if (message === "DUPLICATE_WARNING") setDuplicateWarning(true)
      else setError(message)
    } finally {
      setSaving(false)
    }
  }

  return <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
    <div><h1 className="text-2xl font-bold">مسح فاتورة مشتريات</h1><p className="mt-1 text-sm text-muted-foreground">وجّه الكاميرا نحو رمز QR في فاتورة المشتريات.</p></div>
    {error ? <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</div> : null}
    {!decoded ? <Card><CardContent className="space-y-5 pt-6">
      <div className="overflow-hidden rounded-xl bg-black"><video ref={videoRef} className={`aspect-video w-full object-cover ${scanning ? "block" : "hidden"}`} muted playsInline />{!scanning ? <div className="flex aspect-video items-center justify-center"><Camera className="size-16 text-white/40" /></div> : null}</div>
      <div className="grid gap-2 sm:grid-cols-2"><Button size="lg" onClick={() => void startCamera()} disabled={scanning || readingImage}><Camera className="me-2 size-5" />{scanning ? "جاري المسح…" : "بدء المسح"}</Button><Button size="lg" variant="outline" asChild disabled={readingImage}><label className="cursor-pointer"><ImagePlus className="me-2 size-5" />{readingImage ? "جاري تحليل الصورة…" : "اختيار صورة"}<input type="file" accept="image/*" className="hidden" onChange={(event) => void scanImage(event.target.files?.[0])} /></label></Button></div>
    </CardContent></Card> : <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><CheckCircle2 className="size-5 text-green-600" />تمت قراءة QR</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 rounded-lg bg-muted/40 p-4 sm:grid-cols-2"><Field label="اسم المورد" value={decoded.sellerName} /><Field label="الرقم الضريبي" value={decoded.sellerVatNumber} ltr /><Field label="تاريخ الفاتورة" value={formatDate(decoded.timestamp)} ltr /><Field label="الإجمالي" value={formatCurrency(decoded.total)} /><Field label="الضريبة" value={formatCurrency(decoded.taxTotal)} /><Field label="قبل الضريبة" value={formatCurrency(decoded.total - decoded.taxTotal)} /></div>
        <div className="space-y-2"><Label htmlFor="invoice-number">رقم فاتورة المورد *</Label><Input id="invoice-number" value={invoiceNumber} onChange={(event) => { setInvoiceNumber(event.target.value) }} placeholder="أدخل الرقم الظاهر على الفاتورة" /></div>

        <section className="space-y-3 rounded-xl border p-4" aria-labelledby="purchase-payment-status-title">
          <div><h3 id="purchase-payment-status-title" className="font-semibold">هل تم سداد الفاتورة؟ *</h3><p className="mt-1 text-sm text-muted-foreground">رمز QR لا يحدد حالة السداد؛ اختر الحالة الفعلية لتسجيل حساب المورد بصورة صحيحة.</p></div>
          <div className="grid gap-2 sm:grid-cols-3">{paymentStatuses.map((status) => <label key={status.value} className={`cursor-pointer rounded-lg border p-3 transition-colors ${paymentStatus === status.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/40"}`}><input type="radio" name="purchase-payment-status" value={status.value} checked={paymentStatus === status.value} onChange={() => { choosePaymentStatus(status.value) }} className="sr-only" /><span className="block font-medium">{status.label}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{status.description}</span></label>)}</div>

          {paymentStatus && paymentStatus !== "unpaid" ? <div className="space-y-4 border-t pt-4">
            {paymentStatus === "partially_paid" ? <div className="space-y-2"><Label htmlFor="purchase-paid-amount">المبلغ المدفوع *</Label><Input id="purchase-paid-amount" type="number" min="0.01" max={decoded.total} step="0.01" dir="ltr" value={paidAmount} onChange={(event) => { setPaidAmount(event.target.value) }} placeholder="0.00" />{paidAmount && !validPartialAmount ? <p className="text-xs text-destructive">أدخل مبلغًا أكبر من صفر وأقل من إجمالي الفاتورة.</p> : null}{validPartialAmount ? <p className="text-sm text-muted-foreground">المتبقي للمورد: <strong className="text-destructive">{formatCurrency(decoded.total - numericPaidAmount)}</strong></p> : null}</div> : <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">سيُسجل كامل المبلغ، {formatCurrency(decoded.total)}، كدفعة مسددة.</div>}
            <div className="space-y-2"><Label>طريقة الدفع *</Label><Select value={paymentMethod} onValueChange={(value) => { setPaymentMethod(value as PaymentMethod); setPaymentReference("") }}><SelectTrigger><SelectValue placeholder="اختر طريقة الدفع" /></SelectTrigger><SelectContent>{paymentMethods.map((method) => <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>)}</SelectContent></Select></div>
            {paymentMethod === "sadad" ? <div className="space-y-2"><Label htmlFor="purchase-payment-reference">رقم سداد أو رقم الفاتورة *</Label><Input id="purchase-payment-reference" value={paymentReference} onChange={(event) => { setPaymentReference(event.target.value) }} /></div> : null}
            <p className="text-xs text-muted-foreground">تُسجل الدفعة الأولى بتاريخ الفاتورة. وأي دفعة لاحقة تُسجل من سجل المشتريات بتاريخ سدادها الفعلي.</p>
          </div> : null}
        </section>

        <label className="flex items-start gap-3 rounded-lg border p-4 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} onChange={(event) => { setConfirmed(event.target.checked) }} /><span>أقر بأنني راجعت الفاتورة وأن البيانات صحيحة، وأتحمل مسؤولية إدراجها ضمن سجلات منشأتي وإقرارها الضريبي.</span></label>
        <div className="flex flex-wrap gap-2"><Button onClick={() => void save()} disabled={saving || !canSave}>{saving ? "جاري الحفظ…" : "حفظ وإدراج في الإقرار"}</Button><Button variant="outline" onClick={resetScan}>إعادة المسح</Button></div>
      </CardContent>
    </Card>}
    <Card className="border-amber-200 bg-amber-50/60"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="size-5 text-amber-700" />تعليمات مهمة</CardTitle></CardHeader><CardContent><ul className="list-disc space-y-2 pe-5 text-sm text-amber-950"><li>تأكد أن الفاتورة باسم نشاطك التجاري ورقمك الضريبي.</li><li>يمكنك التحقق من صحة الفاتورة عبر تطبيق هيئة الزكاة والضريبة والجمارك.</li><li>هذه الخدمة لضبط حساباتك وإعداد إقرارك الضريبي فقط.</li><li>أنت مسؤول عن صحة البيانات المدخلة وفقًا لتعليمات الهيئة.</li></ul></CardContent></Card>
    {duplicateWarning ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><Card className="max-w-md"><CardHeader><CardTitle className="text-lg">فاتورة مشابهة مسجلة</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">توجد فاتورة تحمل رقم المورد أو QR نفسه. راجع الفاتورة قبل المتابعة.</p><div className="flex gap-2"><Button variant="destructive" onClick={() => void save(true)} disabled={saving}>الحفظ على مسؤوليتي</Button><Button variant="outline" onClick={() => { setDuplicateWarning(false) }}>العودة والمراجعة</Button></div></CardContent></Card></div> : null}
  </div>
}

function Field({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-medium" dir={ltr ? "ltr" : undefined}>{value}</p></div>
}
