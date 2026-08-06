import { useEffect, useRef, useState } from "react"
import { Link, useParams } from "@tanstack/react-router"
import { Download, Mail, MessageCircle, Pencil, Printer, Share2 } from "lucide-react"
import { fetchBrandingAssetUrl, fetchDocument, type BrandingAssetKind, type CentralDocument } from "@/lib/platform/api"
import { createInvoicePdf, downloadPdf, sharePdf } from "@/lib/pdf/invoicePdf"
import { ZatcaQrCode } from "@/lib/zatca/ZatcaQrCode"
import { Button } from "@/shared/components/ui/button"
import { Separator } from "@/shared/components/ui/separator"
import { toast } from "@/shared/hooks/useToast"
import { formatCurrency, formatDate } from "@/shared/utils"

type OrganizationSnapshot = {
  business_name?: string
  vat_number?: string
  commercial_registration?: string
  city?: string
  district?: string
  street?: string
  building_number?: string
  postal_code?: string
  bank_name?: string
  bank_account_name?: string
  iban?: string
  stamp_on_invoice?: boolean
  signature_on_invoice?: boolean
}

export function DocumentViewPage() {
  const { id } = useParams({ from: "/app/documents/$id" })
  const [document, setDocument] = useState<CentralDocument>()
  const [creatingPdf, setCreatingPdf] = useState(false)
  const [assetUrls, setAssetUrls] = useState<Partial<Record<BrandingAssetKind, string>>>({})
  const printAreaRef = useRef<HTMLElement>(null)

  useEffect(() => {
    void fetchDocument(id).then((result) => { setDocument(result.document) })
  }, [id])
  useEffect(() => { void Promise.all((["logo", "stamp", "signature"] as const).map(async (kind) => { const url = await fetchBrandingAssetUrl(kind); if (url) setAssetUrls((current) => ({ ...current, [kind]: url })) })) }, [])

  if (!document) return <p className="p-6 text-muted-foreground">جاري تحميل المستند...</p>

  const seller = document.organization_snapshot as OrganizationSnapshot
  const customer = document.customer_snapshot
  const isQuotation = document.type === "quotation"
  const showTotals = !isQuotation || document.reference_data.show_totals !== false
  const hasUnits = document.items?.some((item) => Boolean(item.unit?.trim())) ?? false
  const hasLineDiscounts = document.items?.some((item) => Number(item.discount) > 0) ?? false
  const hasRetentions = document.items?.some((item) => Number(item.retention_rate) > 0) ?? false
  const grossItemsTotal = document.items?.reduce((sum,item)=>sum+Number(item.quantity)*Number(item.unit_price),0) ?? 0
  const lineDiscountTotal = document.items?.reduce((sum,item)=>sum+Number(item.discount),0) ?? 0
  const collectedTotal = document.payments?.reduce((sum,payment)=>sum+Number(payment.amount),0) ?? 0
  const amountDue = Math.max(0,Number(document.total)-Number(document.retention_total)-collectedTotal)
  const sellerAddress = [seller.street, seller.building_number, seller.district, seller.city, seller.postal_code].filter(Boolean).join("، ")
  const customerAddress = [customer.street, customer.building_number, customer.district, customer.city, customer.postal_code].filter(Boolean).join("، ")
  const organizationName = seller.business_name ?? "المنشأة"
  const shareText = document.status === "issued" ? `السلام عليكم ورحمة الله وبركاته،\n\nيسر ${organizationName} أن ترسل لكم الفاتورة الضريبية رقم ${document.number} بتاريخ ${formatDate(document.issue_date)}، وبإجمالي ${formatCurrency(Number(document.total))}.\n\nنأمل التكرم بمراجعة الفاتورة المرفقة.\n\nمع خالص التحية،\n${organizationName}${seller.vat_number ? `\nالرقم الضريبي: ${seller.vat_number}` : ""}` : ""
  const emailUrl = customer.email ? `mailto:${customer.email}?subject=${encodeURIComponent(`فاتورة ضريبية رقم ${document.number}`)}&body=${encodeURIComponent(shareText)}` : ""
  const whatsappPhone = customer.phone?.replace(/\D/g, "").replace(/^0/, "966") ?? ""
  const whatsappUrl = whatsappPhone ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(shareText)}` : ""
  const pdfFileName = `tax-invoice-${document.number}.pdf`

  const makePdf = async () => {
    if (!printAreaRef.current) throw new Error("تعذر العثور على محتوى الفاتورة")
    return createInvoicePdf(printAreaRef.current)
  }

  const handleDownload = async () => {
    setCreatingPdf(true)
    try {
      downloadPdf(await makePdf(), pdfFileName)
      toast({ title: "تم إنشاء PDF", description: "تم تنزيل ملف الفاتورة بنجاح", variant: "success" })
    } catch (error) {
      toast({ title: "تعذر إنشاء PDF", description: error instanceof Error ? error.message : "حاول مرة أخرى", variant: "error" })
    } finally { setCreatingPdf(false) }
  }

  const handleNativeShare = async () => {
    setCreatingPdf(true)
    try {
      const blob = await makePdf()
      const shared = await sharePdf(blob, pdfFileName, `فاتورة ضريبية رقم ${document.number}`, shareText)
      if (!shared) {
        downloadPdf(blob, pdfFileName)
        toast({ title: "المشاركة غير مدعومة", description: "تم تنزيل PDF ويمكنك إرفاقه يدويًا", variant: "success" })
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      toast({ title: "تعذرت المشاركة", description: error instanceof Error ? error.message : "حاول مرة أخرى", variant: "error" })
    } finally { setCreatingPdf(false) }
  }

  const openMessageWithPdf = async (target: "email" | "whatsapp") => {
    const popup = target === "whatsapp" ? window.open("about:blank", "_blank") : null
    setCreatingPdf(true)
    try {
      downloadPdf(await makePdf(), pdfFileName)
      if (target === "whatsapp") {
        if (popup) popup.location.href = whatsappUrl
        else window.location.href = whatsappUrl
      } else {
        window.location.href = emailUrl
      }
      toast({ title: "تم تجهيز الفاتورة", description: "أرفق ملف PDF الذي تم تنزيله بالرسالة", variant: "success" })
    } catch (error) {
      popup?.close()
      toast({ title: "تعذر تجهيز الرسالة", description: error instanceof Error ? error.message : "حاول مرة أخرى", variant: "error" })
    } finally { setCreatingPdf(false) }
  }

  return (
    <div className="min-h-screen bg-muted/20 p-3 sm:p-6" dir="rtl">
      <div className="mx-auto mb-3 flex max-w-4xl items-center justify-between print:hidden">
        <Link to="/documents" className="text-sm text-muted-foreground">العودة للفواتير</Link>
        <div className="flex flex-wrap justify-end gap-2">
          {document.status === "draft" ? (
            <Button asChild variant="outline" className="gap-2">
              <Link to="/documents/$id/edit" params={{ id }}><Pencil className="size-4" />تعديل المسودة</Link>
            </Button>
          ) : null}
          <Button variant="outline" className="gap-2" onClick={() => { window.print() }}>
            <Printer className="size-4" />طباعة / PDF
          </Button>
          {document.status === "issued" ? <Button variant="outline" className="gap-2" disabled={creatingPdf} onClick={() => { void handleDownload() }}><Download className="size-4" />تنزيل PDF</Button> : null}
          {document.status === "issued" ? <Button variant="outline" className="gap-2" disabled={creatingPdf} onClick={() => { void handleNativeShare() }}><Share2 className="size-4" />مشاركة PDF</Button> : null}
          {document.status === "issued" && customer.email ? <Button variant="outline" className="gap-2" disabled={creatingPdf} onClick={() => { void openMessageWithPdf("email") }}><Mail className="size-4" />البريد</Button> : null}
          {document.status === "issued" && whatsappPhone ? <Button variant="outline" className="gap-2" disabled={creatingPdf} onClick={() => { void openMessageWithPdf("whatsapp") }}><MessageCircle className="size-4" />واتساب</Button> : null}
        </div>
      </div>

      <article ref={printAreaRef} data-print-area className="mx-auto max-w-4xl rounded-xl border bg-white p-5 shadow-sm sm:p-8 print:border-0 print:shadow-none">
        <header className="flex justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{isQuotation?"عرض سعر":"فاتورة ضريبية"}</h1>
            <p className="font-mono text-primary">{document.status === "draft" ? "مسودة غير صادرة" : document.number}</p>
          </div>
          <div className="flex items-start gap-4">{assetUrls.logo ? <img src={assetUrls.logo} alt="شعار المنشأة" className="h-[5.5rem] w-[8.8rem] object-contain" /> : null}<div className="text-end text-sm"><p>{formatDate(document.issue_date)}</p><p className="text-muted-foreground">{document.status === "issued" ? "صادرة" : "مسودة"}</p></div></div>
        </header>
        <Separator className="my-5" />

        <section className="grid gap-5 text-sm sm:grid-cols-2">
          <Party title="من" name={seller.business_name} vat={seller.vat_number} registration={seller.commercial_registration} address={sellerAddress} />
          <Party title="إلى" name={customer.name} vat={customer.vat_number} registration={customer.commercial_registration} address={customerAddress} />
        </section>

        <div className="my-6 overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead><tr className="border-b bg-muted/30"><th className="p-2 text-start">البيان</th><th>الكمية</th>{hasUnits ? <th>الوحدة</th> : null}<th>السعر</th>{hasLineDiscounts?<th>خصم %</th>:null}{hasRetentions?<th>ضمان الأعمال %</th>:null}{showTotals?<th className="text-end">الإجمالي</th>:null}</tr></thead>
            <tbody>{document.items?.map((item) => (
              <tr key={item.id} className="border-b"><td className="p-2">{item.description}</td><td className="text-center">{item.quantity}</td>{hasUnits ? <td className="text-center">{item.unit || "—"}</td> : null}<td className="text-center">{formatCurrency(Number(item.unit_price))}</td>{hasLineDiscounts?<td className="text-center">{Number(item.discount)>0?`${((Number(item.discount)/(Number(item.quantity)*Number(item.unit_price)))*100).toFixed(2).replace(/\.00$/,"")}%`:"—"}</td>:null}{hasRetentions?<td className="text-center">{Number(item.retention_rate)>0?`${Number(item.retention_rate)}%`:"—"}</td>:null}{showTotals?<td className="text-end">{formatCurrency(Number(item.line_total))}</td>:null}</tr>
            ))}</tbody>
          </table>
        </div>

        {showTotals?<div className="ms-auto max-w-sm space-y-2 text-sm">
          <Row label="إجمالي البنود قبل الخصم" value={grossItemsTotal} />
          {lineDiscountTotal > 0 ? <Row label="خصومات البنود" value={lineDiscountTotal} /> : null}
          {Number(document.discount_total) > 0 ? <Row label="خصم على الفاتورة" value={Number(document.discount_total)} /> : null}
          <Row label="الوعاء الضريبي" value={Number(document.total)-Number(document.tax_total)} />
          <Row label="ضريبة القيمة المضافة 15%" value={Number(document.tax_total)} />
          <Separator /><Row label="إجمالي الفاتورة" value={Number(document.total)} bold />
          {Number(document.retention_total) > 0 ? <Row label="حجز ضمان الأعمال" value={Number(document.retention_total)} /> : null}
          {(document.payments?.length ?? 0) > 0 ? <><Separator />{document.payments?.map((payment)=><Row key={payment.id} label={`دفعة مستلمة — ${payment.payment_method_name}`} value={Number(payment.amount)}/>)}</> : null}
          {(Number(document.retention_total)>0 || collectedTotal>0)?<Row label="المبلغ المستحق" value={amountDue} bold />:null}
        </div>:<p className="mt-5 rounded-lg bg-muted/50 p-4 text-sm">جميع الأسعار المذكورة في العرض {document.prices_include_tax?"شاملة":"غير شاملة"} ضريبة القيمة المضافة 15%، وتُحدد الكميات والقيمة النهائية عند الطلب.</p>}

        {!isQuotation&&document.status === "issued" && seller.business_name && seller.vat_number ? <div className="mt-8 flex justify-center border-t pt-6"><ZatcaQrCode sellerName={seller.business_name} vatNumber={seller.vat_number} invoiceDateTime={document.updated_at} totalWithVat={Number(document.total)} vatAmount={Number(document.tax_total)} size={176} /></div> : null}
        {!isQuotation&&document.reference_data.payment_method ? <Info label="طريقة السداد" value={document.reference_data.payment_method} /> : null}
        {isQuotation&&(document.terms?.length??0)>0?<div className="mt-6 border-t pt-4"><p className="font-medium">الشروط والأحكام</p><ol className="mt-2 list-decimal space-y-1 pe-5 text-sm text-muted-foreground">{document.terms?.map((term,index)=><li key={index}>{term}</li>)}</ol></div>:null}
        {document.show_bank_details && seller.iban ? <Info label="الحساب البنكي" value={[seller.bank_name, seller.bank_account_name, seller.iban].filter(Boolean).join(" · ")} ltr /> : null}
        {document.notes ? <div className="mt-6 border-t pt-4"><p className="font-medium">ملاحظات</p><p className="whitespace-pre-wrap text-sm text-muted-foreground">{document.notes}</p></div> : null}
        {(document.show_stamp && assetUrls.stamp) || (document.show_signature && assetUrls.signature) ? <div className="mt-8 flex justify-end gap-8 border-t pt-5">{document.show_stamp && assetUrls.stamp ? <img src={assetUrls.stamp} alt="ختم المنشأة" className="h-[7.7rem] w-44 object-contain" /> : null}{document.show_signature && assetUrls.signature ? <img src={assetUrls.signature} alt="توقيع المنشأة" className="h-[7.7rem] w-44 object-contain" /> : null}</div> : null}
      </article>
    </div>
  )
}

function Party({ title, name, vat, registration, address }: { title:string; name?:string; vat?:string; registration?:string; address:string }) {
  return <div><p className="text-xs text-muted-foreground">{title}</p><p className="font-semibold">{name || "—"}</p>{vat ? <p>الرقم الضريبي: <span dir="ltr">{vat}</span></p> : null}{registration ? <p>السجل التجاري: <span dir="ltr">{registration}</span></p> : null}{address ? <p>{address}</p> : null}</div>
}

function Info({ label, value, ltr = false }: { label:string; value:string; ltr?:boolean }) {
  return <div className="mt-6 border-t pt-4 text-sm"><p className="font-medium">{label}</p><p className="text-muted-foreground" dir={ltr ? "ltr" : undefined}>{value}</p></div>
}

function Row({ label, value, bold = false }: { label:string; value:number; bold?:boolean }) {
  return <div className={`flex justify-between ${bold ? "text-base font-bold" : ""}`}><span>{label}</span><span>{formatCurrency(value)}</span></div>
}
