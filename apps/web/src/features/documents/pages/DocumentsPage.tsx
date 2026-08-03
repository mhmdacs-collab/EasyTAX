import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { Plus, FileText, Search } from "lucide-react"
import { db } from "@/lib/db"
import type { DocumentType, DocumentStatus } from "@/lib/db"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table"
import { DocumentTypeBadge } from "../components/DocumentTypeBadge"
import { DocumentStatusBadge } from "../components/DocumentStatusBadge"
import { DOCUMENT_TYPE_LABELS } from "../lib/calculations"
import { formatCurrency, formatDate } from "@/shared/utils"

const statusOptions: Array<{ value: DocumentStatus | "all"; label: string }> = [
  { value: "all", label: "كل الحالات" },
  { value: "draft", label: "مسودات" },
  { value: "issued", label: "صادرة" },
  { value: "archived", label: "مؤرشفة" },
]

const typeOptions: Array<{ value: DocumentType | "all"; label: string }> = [
  { value: "all", label: "كل الأنواع" },
  ...(Object.entries(DOCUMENT_TYPE_LABELS) as [DocumentType, string][]).map(([v, l]) => ({ value: v, label: l })),
]

export function DocumentsPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "all">("all")
  const [typeFilter, setTypeFilter] = useState<DocumentType | "all">("all")

  const documents = useLiveQuery(async () => {
    const q = db.documents.orderBy("date").reverse()

    const items = await q.toArray()
    return items.filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false
      if (typeFilter !== "all" && d.type !== typeFilter) return false
      if (search) {
        const q2 = search.toLowerCase()
        return (
          d.customer_name.toLowerCase().includes(q2) ||
          d.number.toLowerCase().includes(q2)
        )
      }
      return true
    })
  }, [statusFilter, typeFilter, search])

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">المستندات</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {documents?.length ?? 0} مستند
          </p>
        </div>
        <Link to="/documents/new">
          <Button className="gap-2">
            <Plus className="size-4" />
            مستند جديد
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="ابحث بالاسم أو الرقم..."
            className="ps-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value) }}
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v as typeof typeFilter) }}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as typeof statusFilter) }}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {documents && documents.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>رقم المستند</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>العميل</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead className="text-end">الإجمالي</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id} className="cursor-pointer">
                <TableCell>
                  <Link to="/documents/$id" params={{ id: doc.id }} className="font-mono hover:underline text-primary">
                    {doc.number === "DRAFT" || !doc.number ? (
                      <span className="text-muted-foreground italic">مسودة</span>
                    ) : (
                      doc.number
                    )}
                  </Link>
                </TableCell>
                <TableCell><DocumentTypeBadge type={doc.type} /></TableCell>
                <TableCell><DocumentStatusBadge status={doc.status} /></TableCell>
                <TableCell className="font-medium">{doc.customer_name}</TableCell>
                <TableCell className="text-muted-foreground tabular-nums" dir="ltr">{formatDate(doc.date)}</TableCell>
                <TableCell className="text-end tabular-nums">{formatCurrency(doc.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center text-muted-foreground">
          <FileText className="size-16 opacity-20" />
          <p className="text-lg font-medium">لا توجد مستندات بعد</p>
          <p className="text-sm">ابدأ بإنشاء فاتورتك الأولى الآن</p>
          <Link to="/documents/new">
            <Button className="gap-2">
              <Plus className="size-4" />
              مستند جديد
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
