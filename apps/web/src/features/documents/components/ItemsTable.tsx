import { useFieldArray, type UseFormReturn } from "react-hook-form"
import { Trash2, Plus } from "lucide-react"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { calcItemSubtotal } from "../lib/calculations"
import { formatCurrency, generateId } from "@/shared/utils"
import type { DocumentFormData } from "./DocumentForm"

interface Props {
  form: UseFormReturn<DocumentFormData>
}

export function ItemsTable({ form }: Props) {
  const { register, watch, control } = form
  const { fields, append, remove } = useFieldArray({ control, name: "items" })
  const watchedItems = watch("items")

  const addItem = () => {
    append({ id: generateId(), description: "", unit: "", quantity: 1, unit_price: 0, discount_percent: 0, retention_percent:0, subtotal: 0 })
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-3 py-2.5 text-start font-medium text-muted-foreground w-[36%]">الوصف</th>
              <th className="px-3 py-2.5 text-center font-medium text-muted-foreground w-[10%]">الوحدة</th>
              <th className="px-3 py-2.5 text-center font-medium text-muted-foreground w-[12%]">الكمية</th>
              <th className="px-3 py-2.5 text-center font-medium text-muted-foreground w-[15%]">سعر الوحدة</th>
              <th className="px-3 py-2.5 text-center font-medium text-muted-foreground w-[10%]">خصم%</th>
              <th className="px-3 py-2.5 text-center font-medium text-muted-foreground w-[10%]">ضمان%</th>
              <th className="px-3 py-2.5 text-end font-medium text-muted-foreground w-[14%]">المجموع</th>
              <th className="w-[3%]" />
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => {
              const item = watchedItems[index]
              const subtotal = item
                ? calcItemSubtotal(
                    item.unit_price || 0,
                    item.quantity || 0,
                    item.discount_percent || 0
                  )
                : 0

              return (
                <tr key={field.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-2 py-1.5">
                    <Input
                      placeholder="وصف الخدمة أو المنتج"
                      className="border-0 shadow-none focus-visible:ring-0 bg-transparent"
                      {...register(`items.${index}.description`)}
                    />
                    {form.formState.errors.items?.[index]?.description && (
                      <p className="text-xs text-destructive px-3">{form.formState.errors.items[index].description.message}</p>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      placeholder="وحدة"
                      className="border-0 shadow-none focus-visible:ring-0 bg-transparent text-center"
                      {...register(`items.${index}.unit`)}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="border-0 shadow-none focus-visible:ring-0 bg-transparent text-center"
                      {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="border-0 shadow-none focus-visible:ring-0 bg-transparent text-center"
                      {...register(`items.${index}.unit_price`, { valueAsNumber: true })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      className="border-0 shadow-none focus-visible:ring-0 bg-transparent text-center"
                      {...register(`items.${index}.discount_percent`, { setValueAs: (value) => Math.min(100, Math.max(0, Number(value) || 0)) })}
                    />
                  </td>
                  <td className="px-2 py-1.5"><Input type="number" min="0" max="100" step="0.1" aria-label="نسبة ضمان الأعمال" className="border-0 bg-transparent text-center shadow-none focus-visible:ring-0" {...register(`items.${index}.retention_percent`,{setValueAs:(value)=>Math.min(100,Math.max(0,Number(value)||0))})}/></td>
                  <td className="px-3 py-1.5 text-end font-medium tabular-nums">
                    {formatCurrency(subtotal).replace("ر.س.‏", "").trim()}
                  </td>
                  <td className="px-1 py-1.5">
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => { remove(index) }}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-2">
        <Plus className="size-4" />
        إضافة بند
      </Button>
    </div>
  )
}
