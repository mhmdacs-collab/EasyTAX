import { useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { Plus, Search, Edit2, Trash2, Phone, Mail, Building2 } from "lucide-react"
import { db } from "@/lib/db"
import type { Customer } from "@/lib/db"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { CustomerDialog } from "../components/CustomerDialog"
import { CustomerDeleteDialog } from "../components/CustomerDeleteDialog"

export default function CustomersPage() {
  const [search, setSearch] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Customer | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)

  const org = useLiveQuery(() => db.organizations.toArray().then((r) => r[0]))
  const customers = useLiveQuery(
    () =>
      db.customers
        .toArray()
        .then((list) =>
          list
            .filter((c) => !c.deleted_at)
            .filter((c) =>
              search
                ? c.name.toLowerCase().includes(search.toLowerCase()) ||
                  (c.vat_number ?? "").includes(search) ||
                  (c.phone ?? "").includes(search)
                : true
            )
            .sort((a, b) => a.name.localeCompare(b.name, "ar"))
        ),
    [search]
  )

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">العملاء</h1>
          <p className="mt-1 text-sm text-muted-foreground">{customers?.length ?? 0} عميل</p>
        </div>
        <Button className="gap-2" onClick={() => { setAddOpen(true) }}>
          <Plus className="size-4" />
          عميل جديد
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="ابحث بالاسم أو الرقم الضريبي أو الجوال..."
          className="ps-9"
          value={search}
          onChange={(e) => { setSearch(e.target.value) }}
        />
      </div>

      {/* Grid */}
      {customers && customers.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((c) => (
            <div
              key={c.id}
              className="group rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {c.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.name}</p>
                    {c.vat_number && (
                      <p className="truncate text-xs text-muted-foreground" dir="ltr">{c.vat_number}</p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    className="rounded p-1.5 hover:bg-muted"
                    onClick={() => { setEditTarget(c) }}
                  >
                    <Edit2 className="size-3.5 text-muted-foreground" />
                  </button>
                  <button
                    className="rounded p-1.5 hover:bg-destructive/10"
                    onClick={() => { setDeleteTarget(c) }}
                  >
                    <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </div>

              {(c.phone || c.email || c.address) && (
                <div className="mt-3 space-y-1 border-t pt-3">
                  {c.phone && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="size-3 shrink-0" />
                      <span dir="ltr">{c.phone}</span>
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="size-3 shrink-0" />
                      <span className="truncate" dir="ltr">{c.email}</span>
                    </div>
                  )}
                  {c.address && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Building2 className="size-3 shrink-0" />
                      <span className="truncate">{c.address}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center text-muted-foreground">
          <Building2 className="size-16 opacity-20" />
          <p className="text-lg font-medium">لا يوجد عملاء بعد</p>
          <p className="text-sm">أضف عميلك الأول لتتمكن من إنشاء المستندات بسرعة</p>
          <Button className="gap-2" onClick={() => { setAddOpen(true) }}>
            <Plus className="size-4" />
            عميل جديد
          </Button>
        </div>
      )}

      {/* Dialogs */}
      {org && (
        <CustomerDialog
          open={addOpen}
          onClose={() => { setAddOpen(false) }}
          organizationId={org.id}
        />
      )}
      {org && editTarget && (
        <CustomerDialog
          open={!!editTarget}
          onClose={() => { setEditTarget(null) }}
          organizationId={org.id}
          customer={editTarget}
        />
      )}
      <CustomerDeleteDialog
        customer={deleteTarget}
        onClose={() => { setDeleteTarget(null) }}
      />
    </div>
  )
}
