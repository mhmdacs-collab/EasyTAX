import { useState, useRef } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { Search, UserPlus } from "lucide-react"
import { db } from "@/lib/db"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"

interface CustomerFields {
  customer_name: string
  customer_vat_number: string
  customer_phone: string
  customer_email: string
  customer_address: string
}

interface Props {
  values: CustomerFields
  onChange: (fields: Partial<CustomerFields>) => void
}

export function CustomerSelector({ values, onChange }: Props) {
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const customers = useLiveQuery(
    () => db.customers.toArray().then((list) => list.filter((c) => !c.deleted_at)),
    []
  )

  const filtered = customers?.filter(
    (c) =>
      c.name.includes(search) ||
      (c.vat_number ?? "").includes(search) ||
      (c.phone ?? "").includes(search)
  ) ?? []

  const select = (c: typeof filtered[0]) => {
    onChange({
      customer_name: c.name,
      customer_vat_number: c.vat_number ?? "",
      customer_phone: c.phone ?? "",
      customer_email: c.email ?? "",
      customer_address: c.address ?? "",
    })
    setSearch("")
    setOpen(false)
  }

  return (
    <div className="space-y-3">
      {/* Customer name search */}
      <div className="space-y-1.5">
        <Label>العميل *</Label>
        <div className="relative">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="ابحث عن عميل أو اكتب الاسم مباشرة"
            className="ps-9"
            value={open ? search : values.customer_name}
            onFocus={() => { setSearch(""); setOpen(true) }}
            onBlur={() => { setTimeout(() => { setOpen(false) }, 150) }}
            onChange={(e) => {
              setSearch(e.target.value)
              onChange({ customer_name: e.target.value })
            }}
          />
          {open && (
            <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-lg">
              {filtered.length > 0 ? (
                <ul className="max-h-48 overflow-auto py-1">
                  {filtered.map((c) => (
                    <li
                      key={c.id}
                      className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent"
                      onMouseDown={() => { select(c) }}
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {c.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{c.name}</p>
                        {c.vat_number && <p className="text-xs text-muted-foreground" dir="ltr">{c.vat_number}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                  <UserPlus className="size-4" />
                  <span>سيُحفظ كعميل جديد عند الإصدار</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Extra fields (shown when customer name is filled) */}
      {values.customer_name && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="c_vat">الرقم الضريبي للعميل</Label>
            <Input
              id="c_vat"
              placeholder="300000000000000"
              dir="ltr"
              value={values.customer_vat_number}
              onChange={(e) => { onChange({ customer_vat_number: e.target.value }) }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c_phone">جوال العميل</Label>
            <Input
              id="c_phone"
              type="tel"
              placeholder="0500000000"
              dir="ltr"
              value={values.customer_phone}
              onChange={(e) => { onChange({ customer_phone: e.target.value }) }}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="c_address">عنوان العميل</Label>
            <Input
              id="c_address"
              placeholder="الرياض — العليا"
              value={values.customer_address}
              onChange={(e) => { onChange({ customer_address: e.target.value }) }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
