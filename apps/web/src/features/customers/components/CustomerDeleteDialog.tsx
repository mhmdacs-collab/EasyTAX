import { useState } from "react"
import { toast } from "@/shared/hooks/useToast"
import { db, type Customer } from "@/lib/db"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/components/ui/dialog"
import { Button } from "@/shared/components/ui/button"

interface Props {
  customer: Customer | null
  onClose: () => void
}

export function CustomerDeleteDialog({ customer, onClose }: Props) {
  const [loading, setLoading] = useState(false)

  const confirm = async () => {
    if (!customer) return
    setLoading(true)
    await db.customers.update(customer.id, {
      deleted_at: new Date().toISOString(),
      sync_status: "pending",
    })
    setLoading(false)
    toast({ title: "تم الحذف", variant: "default" })
    onClose()
  }

  return (
    <Dialog open={!!customer} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>حذف العميل</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          هل أنت متأكد من حذف <span className="font-semibold text-foreground">{customer?.name}</span>؟
          لن يتأثر أي مستند مرتبط به.
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button
            variant="destructive"
            loading={loading}
            onClick={() => {
              void confirm()
            }}
          >
            حذف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
