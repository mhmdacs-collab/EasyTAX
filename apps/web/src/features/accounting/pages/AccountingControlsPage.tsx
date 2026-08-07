import { useCallback, useEffect, useState } from "react"
import type { ReactNode } from "react"
import { Landmark, LockKeyhole, RefreshCw, RotateCcw, WalletCards } from "lucide-react"
import {
  createFinancialMovement,
  addTaxPurchasePayment,
  fetchSupplierAccount,
  listFinancialMovements,
  listPeriodLocks,
  listSupplierAccounts,
  reverseFinancialMovement,
  unlockPeriod,
  type FinancialMovement,
  type FinancialMovementType,
  type PeriodLock,
  type SupplierAccount,
  type SupplierAccountSummary,
} from "@/lib/platform/api"
import { Button } from "@/shared/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { toast } from "@/shared/hooks/useToast"
import { formatCurrency, formatDate } from "@/shared/utils"

const movementLabels: Record<FinancialMovementType,string> = {
  opening_cash:"رصيد الصندوق والبنك الافتتاحي",
  capital_contribution:"إيداع أو زيادة رأس مال",
  owner_withdrawal:"مسحوبات المالك",
  loan_received:"قرض مستلم",
  loan_repayment:"سداد قرض",
}

const today = new Date().toISOString().slice(0,10)

export default function AccountingControlsPage(){
  const [year,setYear]=useState(new Date().getFullYear())
  const [movements,setMovements]=useState<FinancialMovement[]>([])
  const [locks,setLocks]=useState<PeriodLock[]>([])
  const [suppliers,setSuppliers]=useState<SupplierAccountSummary[]>([])
  const [supplierAccount,setSupplierAccount]=useState<SupplierAccount>()
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [paying,setPaying]=useState(false)
  const [payment,setPayment]=useState({invoice_id:"",amount:"",payment_date:today,payment_method:"bank_transfer" as "cash"|"bank_transfer"|"card"|"sadad",reference_number:""})
  const [form,setForm]=useState({movement_date:today,movement_type:"opening_cash" as FinancialMovementType,amount:"",loan_term:"current" as "current"|"non_current",reference_number:"",notes:""})

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const [movementResult,lockResult,supplierResult]=await Promise.all([listFinancialMovements(year),listPeriodLocks(),listSupplierAccounts()])
      setMovements(movementResult.movements);setLocks(lockResult.locks);setSuppliers(supplierResult.suppliers)
    }catch(error){toast({title:"تعذر تحميل الضبط المالي",description:error instanceof Error?error.message:"حاول مرة أخرى",variant:"error"})}
    finally{setLoading(false)}
  },[year])
  useEffect(()=>{void load()},[load])

  const submit=async()=>{
    const amount=Number(form.amount)
    if(!Number.isFinite(amount)||amount<=0){toast({title:"أدخل مبلغًا صحيحًا",variant:"error"});return}
    setSaving(true)
    try{
      const isLoan=form.movement_type==="loan_received"||form.movement_type==="loan_repayment"
      await createFinancialMovement({movement_date:form.movement_date,movement_type:form.movement_type,amount,...(isLoan?{loan_term:form.loan_term}:{}),reference_number:form.reference_number||undefined,notes:form.notes||undefined})
      setForm({...form,amount:"",reference_number:"",notes:""})
      toast({title:"تم تسجيل الحركة المالية",description:"أعيد احتساب النقد ورأس المال أو القرض تلقائيًا.",variant:"success"})
      await load()
    }catch(error){toast({title:"تعذر تسجيل الحركة",description:error instanceof Error?error.message:"راجع البيانات",variant:"error"})}
    finally{setSaving(false)}
  }

  const reverse=async(movement:FinancialMovement)=>{
    const reason=window.prompt("اكتب سبب عكس الحركة. سيبقى السجل محفوظًا للتدقيق:")?.trim()
    if(!reason)return
    try{await reverseFinancialMovement(movement.id,reason);toast({title:"تم عكس الحركة",variant:"success"});await load()}
    catch(error){toast({title:"تعذر عكس الحركة",description:error instanceof Error?error.message:"حاول مرة أخرى",variant:"error"})}
  }

  const unlock=async(lock:PeriodLock)=>{
    const reason=window.prompt("سبب إعادة فتح الفترة (إجباري وسيُحفظ في سجل التدقيق):")?.trim()
    if(!reason)return
    try{await unlockPeriod(lock.id,reason);toast({title:"تمت إعادة فتح الفترة",variant:"success"});await load()}
    catch(error){toast({title:"تعذر فتح الفترة",description:error instanceof Error?error.message:"حاول مرة أخرى",variant:"error"})}
  }

  const openSupplier=async(vat:string)=>{
    try{const account=await fetchSupplierAccount(vat);setSupplierAccount(account);const invoice=account.invoices.find((item)=>Number(item.total)>Number(item.paid_amount));setPayment({...payment,invoice_id:invoice?.id||"",amount:invoice?(Number(invoice.total)-Number(invoice.paid_amount)).toFixed(2):""})}
    catch(error){toast({title:"تعذر تحميل كشف المورد",description:error instanceof Error?error.message:"حاول مرة أخرى",variant:"error"})}
  }

  const paySupplier=async()=>{
    if(!supplierAccount||!payment.invoice_id)return
    const amount=Number(payment.amount);if(!Number.isFinite(amount)||amount<=0){toast({title:"أدخل مبلغ السداد",variant:"error"});return}
    setPaying(true)
    try{await addTaxPurchasePayment(payment.invoice_id,{amount,payment_method:payment.payment_method,payment_date:payment.payment_date,beneficiary_name:supplierAccount.supplier.name,reference_number:payment.reference_number||undefined});toast({title:"تم تسجيل دفعة المورد",variant:"success"});await openSupplier(supplierAccount.supplier.vat_number);await load()}
    catch(error){toast({title:"تعذر تسجيل الدفعة",description:error instanceof Error?error.message:"راجع البيانات",variant:"error"})}
    finally{setPaying(false)}
  }

  const activeLocks=locks.filter((lock)=>lock.status==="locked")
  const isLoan=form.movement_type==="loan_received"||form.movement_type==="loan_repayment"
  return <div className="space-y-6 p-4 sm:p-6" dir="rtl">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">الضبط المالي</h1><p className="mt-1 text-sm text-muted-foreground">حركات لا تنتج عن فاتورة، الفترات المقفلة، وحسابات الموردين — وكلها تدخل في القوائم تلقائيًا.</p></div><Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className="me-2 size-4"/>تحديث</Button></div>

    <Card><CardHeader><CardTitle className="flex items-center gap-2"><WalletCards className="size-5"/>الأرصدة وحركات المالك والقروض</CardTitle><p className="text-sm text-muted-foreground">لا تسجل بيعًا أو مصروفًا هنا. استخدم هذا القسم فقط للنقد الافتتاحي، تمويل المالك، المسحوبات والقروض.</p></CardHeader><CardContent className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="نوع الحركة"><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.movement_type} onChange={(event)=>{ setForm({...form,movement_type:event.target.value as FinancialMovementType}); }}>{Object.entries(movementLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="التاريخ"><Input type="date" value={form.movement_date} onChange={(event)=>{ setForm({...form,movement_date:event.target.value}); }}/></Field>
        <Field label="المبلغ (ر.س)"><Input type="number" min="0.01" step="0.01" dir="ltr" value={form.amount} onChange={(event)=>{ setForm({...form,amount:event.target.value}); }}/></Field>
        {isLoan?<Field label="مدة القرض"><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.loan_term} onChange={(event)=>{ setForm({...form,loan_term:event.target.value as "current"|"non_current"}); }}><option value="current">قصير الأجل — خلال 12 شهرًا</option><option value="non_current">طويل الأجل — أكثر من 12 شهرًا</option></select></Field>:null}
        <Field label="رقم مرجعي (اختياري)"><Input value={form.reference_number} onChange={(event)=>{ setForm({...form,reference_number:event.target.value}); }}/></Field>
        <Field label="ملاحظات (اختياري)"><Input value={form.notes} onChange={(event)=>{ setForm({...form,notes:event.target.value}); }}/></Field>
      </div>
      <Button onClick={()=>void submit()} disabled={saving}>{saving?"جاري الحفظ…":"تسجيل الحركة"}</Button>
      <div className="flex items-center gap-2 pt-3"><Label>السنة المعروضة</Label><Input className="w-28" type="number" value={year} onChange={(event)=>{ setYear(Number(event.target.value)); }}/></div>
      <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[720px] text-sm"><thead><tr className="bg-muted/50"><th className="p-3 text-start">التاريخ</th><th className="p-3 text-start">الحركة</th><th className="p-3 text-start">المرجع</th><th className="p-3 text-end">المبلغ</th><th className="p-3 text-center">الحالة</th><th/></tr></thead><tbody>{movements.map((movement)=><tr key={movement.id} className="border-t"><td className="p-3">{formatDate(movement.movement_date)}</td><td className="p-3">{movementLabels[movement.movement_type]}{movement.loan_term?<span className="block text-xs text-muted-foreground">{movement.loan_term==="current"?"قصير الأجل":"طويل الأجل"}</span>:null}</td><td className="p-3">{movement.reference_number||"—"}</td><td className="p-3 text-end tabular-nums">{formatCurrency(Number(movement.amount))}</td><td className="p-3 text-center">{movement.status==="recorded"?"مسجلة":"معكوسة"}</td><td className="p-3">{movement.status==="recorded"?<Button size="sm" variant="ghost" onClick={()=>void reverse(movement)}><RotateCcw className="me-1 size-4"/>عكس</Button>:null}</td></tr>)}{!movements.length?<tr><td colSpan={6} className="p-6 text-center text-muted-foreground">لا توجد حركات في هذه السنة.</td></tr>:null}</tbody></table></div>
    </CardContent></Card>

    <Card><CardHeader><CardTitle className="flex items-center gap-2"><LockKeyhole className="size-5"/>الفترات المقفلة</CardTitle><p className="text-sm text-muted-foreground">أي مستند أو دفعة بتاريخ داخل فترة مقفلة يُرفض مركزيًا. إعادة الفتح تتطلب سببًا محفوظًا.</p></CardHeader><CardContent><div className="space-y-2">{activeLocks.map((lock)=><div key={lock.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">{lock.lock_type==="tax_return"?"إقرار ضريبي":"سنة مالية"}</p><p className="text-sm text-muted-foreground">{formatDate(lock.starts_on)} — {formatDate(lock.ends_on)} · {lock.reason}</p></div><Button variant="outline" size="sm" onClick={()=>void unlock(lock)}>إعادة فتح</Button></div>)}{!activeLocks.length?<p className="py-4 text-center text-sm text-muted-foreground">لا توجد فترات مقفلة حاليًا.</p>:null}</div></CardContent></Card>

    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Landmark className="size-5"/>حسابات الموردين</CardTitle><p className="text-sm text-muted-foreground">يُنشأ كشف المورد تلقائيًا من فواتير QR ودفعاتها، دون إدخال المورد مرة أخرى.</p></CardHeader><CardContent><div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[700px] text-sm"><thead><tr className="bg-muted/50"><th className="p-3 text-start">المورد</th><th className="p-3 text-start">الرقم الضريبي</th><th className="p-3 text-end">المشتريات</th><th className="p-3 text-end">المدفوع</th><th className="p-3 text-end">المتبقي</th><th/></tr></thead><tbody>{suppliers.map((supplier)=><tr key={supplier.supplier_vat_number} className="border-t"><td className="p-3 font-medium">{supplier.supplier_name}</td><td className="p-3 font-mono" dir="ltr">{supplier.supplier_vat_number}</td><td className="p-3 text-end">{formatCurrency(Number(supplier.invoice_total))}</td><td className="p-3 text-end">{formatCurrency(Number(supplier.paid_total))}</td><td className="p-3 text-end font-semibold text-destructive">{formatCurrency(Number(supplier.outstanding))}</td><td className="p-3"><Button size="sm" variant="outline" onClick={()=>void openSupplier(supplier.supplier_vat_number)}>كشف الحساب</Button></td></tr>)}{!suppliers.length?<tr><td colSpan={6} className="p-6 text-center text-muted-foreground">لا توجد فواتير مشتريات مسجلة.</td></tr>:null}</tbody></table></div>
      {supplierAccount?<div className="mt-4 rounded-lg border bg-muted/20 p-4"><div className="flex items-start justify-between"><div><h3 className="font-semibold">{supplierAccount.supplier.name}</h3><p className="font-mono text-xs text-muted-foreground" dir="ltr">{supplierAccount.supplier.vat_number}</p></div><Button size="sm" variant="ghost" onClick={()=>{ setSupplierAccount(undefined); }}>إغلاق</Button></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><Metric label="إجمالي المشتريات" value={supplierAccount.summary.invoice_total}/><Metric label="إجمالي المدفوع" value={supplierAccount.summary.paid_total}/><Metric label="المتبقي للمورد" value={supplierAccount.summary.outstanding} danger/></div>{supplierAccount.summary.outstanding>0?<div className="mt-4 rounded-lg border bg-background p-3"><h4 className="font-medium">تسجيل دفعة للمورد</h4><div className="mt-3 grid gap-3 sm:grid-cols-4"><Field label="الفاتورة"><select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={payment.invoice_id} onChange={(event)=>{const invoice=supplierAccount.invoices.find((item)=>item.id===event.target.value);setPayment({...payment,invoice_id:event.target.value,amount:invoice?(Number(invoice.total)-Number(invoice.paid_amount)).toFixed(2):""})}}>{supplierAccount.invoices.filter((invoice)=>Number(invoice.total)>Number(invoice.paid_amount)).map((invoice)=><option key={invoice.id} value={invoice.id}>{invoice.internal_number} — متبقي {formatCurrency(Number(invoice.total)-Number(invoice.paid_amount))}</option>)}</select></Field><Field label="المبلغ"><Input type="number" dir="ltr" value={payment.amount} onChange={(event)=>{ setPayment({...payment,amount:event.target.value}); }}/></Field><Field label="الطريقة"><select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={payment.payment_method} onChange={(event)=>{ setPayment({...payment,payment_method:event.target.value as typeof payment.payment_method}); }}><option value="cash">نقدي</option><option value="bank_transfer">تحويل بنكي</option><option value="card">شبكة / بطاقة</option><option value="sadad">سداد</option></select></Field><Field label="التاريخ"><Input type="date" value={payment.payment_date} onChange={(event)=>{ setPayment({...payment,payment_date:event.target.value}); }}/></Field>{payment.payment_method==="sadad"?<Field label="رقم سداد"><Input value={payment.reference_number} onChange={(event)=>{ setPayment({...payment,reference_number:event.target.value}); }}/></Field>:null}</div><Button className="mt-3" size="sm" disabled={paying||!payment.invoice_id} onClick={()=>void paySupplier()}>{paying?"جاري التسجيل…":"تسجيل الدفعة"}</Button></div>:null}<div className="mt-4 space-y-2">{supplierAccount.invoices.map((invoice)=><div key={invoice.id} className="flex items-center justify-between rounded border bg-background p-3 text-sm"><span>{invoice.internal_number} · {formatDate(invoice.invoice_date)}</span><span>{formatCurrency(Number(invoice.total))} · متبقي {formatCurrency(Number(invoice.total)-Number(invoice.paid_amount))}</span></div>)}</div></div>:null}
    </CardContent></Card>
  </div>
}

function Field({label,children}:{label:string;children:ReactNode}){return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>}
function Metric({label,value,danger=false}:{label:string;value:number;danger?:boolean}){return <div className="rounded-lg border bg-background p-3"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 font-bold tabular-nums ${danger&&value>0?"text-destructive":""}`}>{formatCurrency(value)}</p></div>}
