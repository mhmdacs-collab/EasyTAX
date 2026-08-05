import { useEffect, useState } from "react"
import { Link, useParams } from "@tanstack/react-router"
import { Mail, MessageCircle, Pencil, Printer } from "lucide-react"
import { fetchDocument, type CentralDocument } from "@/lib/platform/api"
import { ZatcaQrCode } from "@/lib/zatca/ZatcaQrCode"
import { Button } from "@/shared/components/ui/button"
import { Separator } from "@/shared/components/ui/separator"
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
}

export function DocumentViewPage() {
  const { id } = useParams({ from: "/app/documents/$id" })
  const [document, setDocument] = useState<CentralDocument>()

  useEffect(() => {
    void fetchDocument(id).then((result) => { setDocument(result.document) })
  }, [id])

  if (!document) return <p className="p-6 text-muted-foreground">جاري تحميل المستند...</p>

  const seller = document.organization_snapshot as OrganizationSnapshot
  const customer = document.customer_snapshot
  const hasUnits = document.items?.some((item) => Boolean(item.unit?.trim())) ?? false
  const sellerAddress = [seller.street, seller.building_number, seller.district, seller.city, seller.postal_code].filter(Boolean).join("، ")
  const customerAddress = [customer.street, customer.building_number, customer.district, customer.city, customer.postal_code].filter(Boolean).join("، ")
  const shareText = document.status === "issued" ? `فاتورة ضريبية رقم ${document.number} بقيمة ${formatCurrency(Number(document.total))} من ${seller.business_name ?? "EasyTAX"}.` : ""
  const emailUrl = customer.email ? `mailto:${customer.email}?subject=${encodeURIComponent(`فاتورة ضريبية رقم ${document.number}`)}&body=${encodeURIComponent(shareText)}` : ""
  const whatsappPhone = customer.phone?.replace(/\D/g, "").replace(/^0/, "966") ?? ""
  const whatsappUrl = whatsappPhone ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(shareText)}` : ""

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
          {document.status === "issued" && customer.email ? <Button asChild variant="outline" className="gap-2"><a href={emailUrl}><Mail className="size-4" />إرسال بالبريد</a></Button> : null}
          {document.status === "issued" && whatsappPhone ? <Button asChild variant="outline" className="gap-2"><a href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle className="size-4" />واتساب</a></Button> : null}
        </div>
      </div>

      <article data-print-area className="mx-auto max-w-4xl rounded-xl border bg-white p-5 shadow-sm sm:p-8 print:border-0 print:shadow-none">
        <header className="flex justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">فاتورة ضريبية</h1>
            <p className="font-mono text-primary">{document.status === "draft" ? "مسودة غير صادرة" : document.number}</p>
          </div>
          <div className="text-end text-sm"><p>{formatDate(document.issue_date)}</p><p className="text-muted-foreground">{document.status === "issued" ? "صادرة" : "مسودة"}</p></div>
        </header>
        <Separator className="my-5" />

        <section className="grid gap-5 text-sm sm:grid-cols-2">
          <Party title="من" name={seller.business_name} vat={seller.vat_number} registration={seller.commercial_registration} address={sellerAddress} />
          <Party title="إلى" name={customer.name} vat={customer.vat_number} registration={customer.commercial_registration} address={customerAddress} />
        </section>

        <div className="my-6 overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead><tr className="border-b bg-muted/30"><th className="p-2 text-start">البيان</th><th>الكمية</th>{hasUnits ? <th>الوحدة</th> : null}<th>السعر</th><th>الضريبة</th><th className="text-end">الإجمالي</th></tr></thead>
            <tbody>{document.items?.map((item) => (
              <tr key={item.id} className="border-b"><td className="p-2">{item.description}</td><td className="text-center">{item.quantity}</td>{hasUnits ? <td className="text-center">{item.unit || "—"}</td> : null}<td className="text-center">{formatCurrency(Number(item.unit_price))}</td><td className="text-center">{formatCurrency(Number(item.line_tax))}</td><td className="text-end">{formatCurrency(Number(item.line_total))}</td></tr>
            ))}</tbody>
          </table>
        </div>

        <div className="ms-auto max-w-sm space-y-2 text-sm">
          <Row label="المجموع قبل الضريبة" value={Number(document.subtotal)} />
          {Number(document.discount_total) > 0 ? <Row label="الخصم" value={-Number(document.discount_total)} /> : null}
          <Row label="ضريبة القيمة المضافة 15%" value={Number(document.tax_total)} />
          {Number(document.retention_total) > 0 ? <Row label="حجز ضمان الأعمال" value={-Number(document.retention_total)} /> : null}
          <Separator /><Row label="الإجمالي" value={Number(document.total)} bold />
        </div>

        {document.status === "issued" && seller.business_name && seller.vat_number ? <div className="mt-8 flex justify-center border-t pt-6"><ZatcaQrCode sellerName={seller.business_name} vatNumber={seller.vat_number} invoiceDateTime={document.updated_at} totalWithVat={Number(document.total) + Number(document.retention_total)} vatAmount={Number(document.tax_total)} size={176} /></div> : null}
        {document.reference_data.payment_method ? <Info label="طريقة السداد" value={document.reference_data.payment_method} /> : null}
        {document.show_bank_details && seller.iban ? <Info label="الحساب البنكي" value={[seller.bank_name, seller.bank_account_name, seller.iban].filter(Boolean).join(" · ")} ltr /> : null}
        {document.notes ? <div className="mt-6 border-t pt-4"><p className="font-medium">ملاحظات</p><p className="whitespace-pre-wrap text-sm text-muted-foreground">{document.notes}</p></div> : null}
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
