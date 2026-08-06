import { useCallback, useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { Camera, FileDown } from "lucide-react"
import { listTaxPurchases, setTaxPurchaseStatus, type TaxPurchase } from "@/lib/platform/api"
import { formatCurrency, formatDate } from "@/shared/utils"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"

export function PurchasesPage() {
  const [purchases, setPurchases] = useState<TaxPurchase[]>()
  const [error, setError] = useState("")
  const load = useCallback(async () => {
    try { setPurchases((await listTaxPurchases()).purchases); setError("") }
    catch (caught) { setError(caught instanceof Error ? caught.message : "تعذر تحميل فواتير المشتريات") }
  }, [])
  useEffect(() => { void load() }, [load])

  async function changeStatus(purchase: TaxPurchase, status: TaxPurchase["status"]) {
    const reason = status === "included" ? undefined : window.prompt(status === "cancelled" ? "سبب الإلغاء" : "سبب الاستبعاد")?.trim()
    if (status !== "included" && !reason) return
    await setTaxPurchaseStatus(purchase.id, status, reason)
    await load()
  }

  function downloadCsv() {
    const rows = [["رقم EasyTAX","رقم فاتورة المورد","المورد","الرقم الضريبي","التاريخ","قبل الضريبة","الضريبة","الإجمالي","الحالة"],
      ...(purchases ?? []).map((p) => [p.internal_number,p.invoice_number,p.supplier_name,p.supplier_vat_number,p.invoice_date,p.subtotal,p.tax_total,p.total,p.status])]
    const csv = "\uFEFF" + rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n")
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type:"text/csv;charset=utf-8" })); link.download = "كشف-المشتريات-الضريبية.csv"; link.click(); URL.revokeObjectURL(link.href)
  }

  return <div className="space-y-6 p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-bold">فواتير المشتريات الضريبية</h1><p className="mt-1 text-sm text-muted-foreground">الفواتير المدخلة عبر QR والمشمولة في إعداد الإقرار الضريبي.</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={downloadCsv} disabled={!purchases?.length}><FileDown className="me-2 size-4"/>تحميل الكشف</Button><Button asChild><Link to="/purchases/scan"><Camera className="me-2 size-4"/>مسح فاتورة</Link></Button></div>
    </div>
    {error ? <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-destructive">{error}</div> : null}
    <Card><CardHeader><CardTitle className="text-lg">سجل المشتريات</CardTitle></CardHeader><CardContent className="overflow-x-auto">
      {!purchases ? <p className="py-10 text-center text-muted-foreground">جاري التحميل…</p> : purchases.length === 0 ? <div className="py-14 text-center"><Camera className="mx-auto mb-3 size-10 text-muted-foreground/40"/><p className="font-medium">لا توجد فواتير مشتريات ضريبية</p><p className="mt-1 text-sm text-muted-foreground">ابدأ بمسح QR من فاتورة المورد.</p></div> :
      <table className="w-full min-w-[850px] text-sm"><thead><tr className="border-b text-muted-foreground"><th className="p-3 text-start">الرقم الداخلي</th><th className="p-3 text-start">المورد</th><th className="p-3 text-start">فاتورة المورد</th><th className="p-3 text-start">التاريخ</th><th className="p-3 text-end">الضريبة</th><th className="p-3 text-end">الإجمالي</th><th className="p-3 text-center">الحالة</th><th className="p-3"></th></tr></thead><tbody>{purchases.map((purchase) => <tr key={purchase.id} className="border-b last:border-0"><td className="p-3 font-mono font-semibold text-primary">{purchase.internal_number}</td><td className="p-3"><div className="font-medium">{purchase.supplier_name}</div><div className="text-xs text-muted-foreground" dir="ltr">{purchase.supplier_vat_number}</div></td><td className="p-3">{purchase.invoice_number}</td><td className="p-3" dir="ltr">{formatDate(purchase.invoice_date)}</td><td className="p-3 text-end tabular-nums">{formatCurrency(Number(purchase.tax_total))}</td><td className="p-3 text-end font-medium tabular-nums">{formatCurrency(Number(purchase.total))}</td><td className="p-3 text-center"><Status status={purchase.status}/></td><td className="p-3"><select className="rounded-md border bg-background px-2 py-1" value="" onChange={(event) => { const status=event.target.value; if(status==="included"||status==="excluded"||status==="cancelled") void changeStatus(purchase,status) }}><option value="">إجراء…</option>{purchase.status!=="included"?<option value="included">إدراج في الإقرار</option>:<option value="excluded">استبعاد من الإقرار</option>}<option value="cancelled">إلغاء</option></select></td></tr>)}</tbody></table>}
    </CardContent></Card>
  </div>
}

function Status({status}:{status:TaxPurchase["status"]}) {
  if(status==="included") return <Badge variant="success">مشمولة</Badge>
  if(status==="excluded") return <Badge variant="warning">مستبعدة</Badge>
  return <Badge variant="destructive">ملغاة</Badge>
}
