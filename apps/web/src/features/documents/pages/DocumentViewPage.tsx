import { useParams, Link } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { Printer, Archive, Edit } from "lucide-react"
import { db } from "@/lib/db"
import { Button } from "@/shared/components/ui/button"
import { Separator } from "@/shared/components/ui/separator"
import { DocumentTypeBadge } from "../components/DocumentTypeBadge"
import { DocumentStatusBadge } from "../components/DocumentStatusBadge"
import { DOCUMENT_TYPE_LABELS } from "../lib/calculations"
import { formatCurrency, formatDate } from "@/shared/utils"

export function DocumentViewPage() {
  const { id } = useParams({ from: "/app/documents/$id" })
  const doc = useLiveQuery(() => db.documents.get(id), [id])
  const org = useLiveQuery(() => db.organizations.toArray().then((r) => r[0]))

  if (!doc) return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      جاري التحميل...
    </div>
  )

  const archive = async () => {
    await db.documents.update(id, { status: "archived", updated_at: new Date().toISOString(), sync_status: "pending" })
  }

  return (
    <div className="min-h-screen bg-muted/20 p-4">
      {/* Action bar (hidden on print) */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link to="/documents" className="text-sm text-muted-foreground hover:underline">
          ← العودة للمستندات
        </Link>
        <div className="flex gap-2">
          {doc.status === "draft" && (
            <Link to="/documents/$id/edit" params={{ id: doc.id }}>
              <Button variant="outline" className="gap-2"><Edit className="size-4" />تعديل</Button>
            </Link>
          )}
          {doc.status === "issued" && (
            <Button variant="outline" className="gap-2" onClick={archive}>
              <Archive className="size-4" />أرشفة
            </Button>
          )}
          <Button variant="outline" className="gap-2" onClick={() => window.print()}>
            <Printer className="size-4" />طباعة / PDF
          </Button>
        </div>
      </div>

      {/* Document card */}
      <div className="mx-auto max-w-3xl rounded-lg border bg-white p-8 shadow-sm print:max-w-none print:shadow-none print:border-0">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{DOCUMENT_TYPE_LABELS[doc.type]}</h1>
            {doc.number && doc.number !== "DRAFT" ? (
              <p className="font-mono text-lg font-semibold text-primary mt-1" dir="ltr">{doc.number}</p>
            ) : (
              <p className="text-muted-foreground italic mt-1">مسودة غير منشورة</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <DocumentStatusBadge status={doc.status} />
            <DocumentTypeBadge type={doc.type} />
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">من</p>
            {org && (
              <>
                <p className="font-semibold">{org.business_name}</p>
                {org.vat_number && <p className="text-muted-foreground" dir="ltr">{org.vat_number}</p>}
                {org.phone && <p className="text-muted-foreground">{org.phone}</p>}
              </>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">إلى</p>
            <p className="font-semibold">{doc.customer_name}</p>
            {doc.customer_vat_number && <p className="text-muted-foreground" dir="ltr">{doc.customer_vat_number}</p>}
            {doc.customer_phone && <p className="text-muted-foreground">{doc.customer_phone}</p>}
            {doc.customer_address && <p className="text-muted-foreground">{doc.customer_address}</p>}
          </div>
        </div>

        <div className="mb-6 flex gap-8 text-sm">
          <div><span className="text-muted-foreground">التاريخ: </span><span dir="ltr">{formatDate(doc.date)}</span></div>
          {doc.due_date && <div><span className="text-muted-foreground">الاستحقاق: </span><span dir="ltr">{formatDate(doc.due_date)}</span></div>}
        </div>

        <Separator className="mb-4" />

        {/* Items */}
        <table className="w-full text-sm mb-6">
          <thead className="border-b">
            <tr className="text-muted-foreground">
              <th className="pb-2 text-start">الوصف</th>
              <th className="pb-2 text-center">الكمية</th>
              <th className="pb-2 text-center">سعر الوحدة</th>
              <th className="pb-2 text-end">المجموع</th>
            </tr>
          </thead>
          <tbody>
            {doc.items.map((item) => (
              <tr key={item.id} className="border-b last:border-0">
                <td className="py-2 font-medium">{item.description}</td>
                <td className="py-2 text-center">{item.quantity}</td>
                <td className="py-2 text-center tabular-nums" dir="ltr">{formatCurrency(item.unit_price)}</td>
                <td className="py-2 text-end tabular-nums">{formatCurrency(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">المجموع الفرعي</span>
              <span className="tabular-nums">{formatCurrency(doc.subtotal)}</span>
            </div>
            {doc.discount_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">الخصم</span>
                <span className="tabular-nums text-destructive">- {formatCurrency(doc.discount_amount)}</span>
              </div>
            )}
            {doc.retention_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">الاستقطاع</span>
                <span className="tabular-nums">- {formatCurrency(doc.retention_amount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">ضريبة ({doc.vat_rate}%)</span>
              <span className="tabular-nums">{formatCurrency(doc.vat_amount)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-base">
              <span>الإجمالي</span>
              <span className="tabular-nums">{formatCurrency(doc.total)}</span>
            </div>
          </div>
        </div>

        {doc.notes && (
          <>
            <Separator className="my-4" />
            <div className="text-sm">
              <p className="mb-1 font-semibold">ملاحظات</p>
              <p className="text-muted-foreground whitespace-pre-wrap">{doc.notes}</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
