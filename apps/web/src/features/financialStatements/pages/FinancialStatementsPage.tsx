import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  LockKeyhole,
  RefreshCw,
  Save,
} from "lucide-react"
import {
  createFinancialStatementSnapshot,
  closeFinancialYear,
  fetchFinancialStatements,
  saveFinancialStatementInputs,
  type FinancialInputKey,
  type FinancialStatementReport,
} from "@/lib/platform/api"
import { Button } from "@/shared/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { toast } from "@/shared/hooks/useToast"
import { FinancialStatementReportView } from "../components/FinancialStatementReport"
import { createFinancialStatementsWord, downloadWord } from "../lib/exportWord"
import { createFinancialStatementsPdf, downloadPdf } from "../lib/exportPdf"

type InputDraft = Record<FinancialInputKey, { current: string; prior: string }>
type PurchaseDecision = "all_cost" | "has_exceptions" | undefined
type PriorDecision = "first_year" | "has_comparison" | undefined
type OptionalSection = "inventory" | "assets" | "loans" | "obligations" | "related" | "additional"

const steps = [
  { title: "بيانات السنة", description: "مراجعة ما جمعه النظام" },
  { title: "المشتريات", description: "تحديد الاستثناءات فقط" },
  { title: "أرصدة الإقفال", description: "استكمال الأرصدة الفعلية" },
  { title: "سنة المقارنة", description: "السنة السابقة" },
  { title: "المراجعة", description: "الاتزان والتصدير" },
] as const

const purchaseKeys: FinancialInputKey[] = ["purchase_fixed_asset_reclassification", "purchase_prepayment_reclassification"]
const requiredClosingKeys: FinancialInputKey[] = ["cash_and_cash_equivalents", "capital"]
const optionalSections: Array<{ id: OptionalSection; title: string; description: string; keys: FinancialInputKey[] }> = [
  { id: "inventory", title: "لدي مخزون", description: "أدخل قيمة المخزون المتبقي في نهاية السنة.", keys: ["inventory"] },
  { id: "assets", title: "لدي أصول أو استثمارات أخرى", description: "مثل المعدات والأصول غير الملموسة والعقارات الاستثمارية.", keys: ["property_plant_equipment", "depreciation_expense", "intangible_assets", "investment_property", "equity_method_investments", "other_non_current_assets"] },
  { id: "loans", title: "لدي قروض", description: "افصل الجزء المستحق خلال سنة عن الجزء طويل الأجل.", keys: ["current_loans", "non_current_loans", "finance_cost"] },
  { id: "obligations", title: "لدي التزامات أو مستحقات أخرى", description: "مثل الزكاة والضرائب ومنافع الموظفين والمصاريف المستحقة.", keys: ["employee_benefits", "zakat_payable", "taxes_payable", "other_current_liabilities", "other_non_current_liabilities", "zakat_expense", "income_tax_expense"] },
  { id: "related", title: "لدي أرصدة مع الشركاء أو أطراف ذات علاقة", description: "مبالغ للمنشأة أو عليها تجاه الشركاء والأطراف ذات العلاقة.", keys: ["related_party_receivable", "related_party_payable"] },
  { id: "additional", title: "لدي بنود إضافية", description: "احتياطيات، مسحوبات ملاك، دخل آخر أو عناصر حقوق ملكية أخرى.", keys: ["other_current_assets", "statutory_reserve", "retained_earnings_opening", "other_equity", "owner_distributions", "other_income", "other_comprehensive_income"] },
]

const money = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function draftFromReport(report: FinancialStatementReport): InputDraft {
  return Object.fromEntries(report.inputDefinitions.map((definition) => {
    const value = report.inputs[definition.key]
    return [definition.key, {
      current: value?.current === null || value?.current === undefined ? "" : String(value.current),
      prior: value?.prior === null || value?.prior === undefined ? "" : String(value.prior),
    }]
  })) as InputDraft
}

function asNumber(value: string | undefined) {
  return value === "" || value === undefined ? 0 : Number(value)
}

export default function FinancialStatementsPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [step, setStep] = useState(0)
  const [report, setReport] = useState<FinancialStatementReport>()
  const [draft, setDraft] = useState<InputDraft>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState<"word" | "pdf">()
  const [closing,setClosing]=useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [purchaseDecision, setPurchaseDecision] = useState<PurchaseDecision>()
  const [priorDecision, setPriorDecision] = useState<PriorDecision>()
  const [openSections, setOpenSections] = useState<Set<OptionalSection>>(new Set())
  const [openPriorSections, setOpenPriorSections] = useState<Set<OptionalSection>>(new Set())
  const pageTopRef = useRef<HTMLDivElement>(null)
  const reportRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchFinancialStatements(year)
      const nextDraft = draftFromReport(result.report)
      setReport(result.report)
      setDraft(nextDraft)

      const purchaseWasConfirmed = purchaseKeys.some((key) => result.report.inputs[key]?.current !== null && result.report.inputs[key]?.current !== undefined)
      const hasPurchaseExceptions = purchaseKeys.some((key) => (result.report.inputs[key]?.current ?? 0) > 0)
      setPurchaseDecision(purchaseWasConfirmed ? (hasPurchaseExceptions ? "has_exceptions" : "all_cost") : result.report.sourceSummary.purchaseCount === 0 ? "all_cost" : undefined)

      const hasPriorInputs = result.report.inputDefinitions.some((definition) => result.report.inputs[definition.key]?.prior !== null && result.report.inputs[definition.key]?.prior !== undefined)
      const hasPriorSources = result.report.sourceSummary.prior.invoiceCount + result.report.sourceSummary.prior.purchaseCount + result.report.sourceSummary.prior.expenseCount > 0
      setPriorDecision(hasPriorInputs || hasPriorSources ? "has_comparison" : undefined)

      setOpenSections(new Set(optionalSections.filter((section) => section.keys.some((key) => nextDraft[key].current !== "")).map((section) => section.id)))
      setOpenPriorSections(new Set(optionalSections.filter((section) => section.keys.some((key) => nextDraft[key].prior !== "")).map((section) => section.id)))
      const savedStep = Number(window.localStorage.getItem(`financial-statements-step:${result.report.organization.id}:${year}`))
      setStep(Number.isInteger(savedStep) && savedStep >= 0 && savedStep < steps.length ? savedStep : 0)
    } catch (error) {
      setReport(undefined)
      toast({ title: "تعذر إعداد القوائم المالية", description: error instanceof Error ? error.message : "حاول مرة أخرى", variant: "error" })
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => { void load() }, [load])

  const updateDraft = (key: FinancialInputKey, period: "current" | "prior", value: string) => {
    if (!draft) return
    setDraft({ ...draft, [key]: { ...draft[key], [period]: value } })
  }

  const persist = async (announce = true) => {
    if (!report || !draft) return false
    setSaving(true)
    try {
      const result = await saveFinancialStatementInputs(year, report.inputDefinitions.map((definition) => ({
        key: definition.key,
        current_amount: draft[definition.key].current === "" ? null : Number(draft[definition.key].current),
        prior_amount: draft[definition.key].prior === "" ? null : Number(draft[definition.key].prior),
      })))
      setReport(result.report)
      setDraft(draftFromReport(result.report))
      if (announce) toast({ title: "تم حفظ بيانات القوائم", description: "أُعيد احتساب القوائم والتحقق من اتزانها.", variant: "success" })
      return true
    } catch (error) {
      toast({ title: "تعذر الحفظ", description: error instanceof Error ? error.message : "راجع القيم المدخلة", variant: "error" })
      return false
    } finally {
      setSaving(false)
    }
  }

  const purchaseExceptions = useMemo(() => {
    if (!draft) return 0
    return asNumber(draft.purchase_fixed_asset_reclassification.current) + asNumber(draft.purchase_prepayment_reclassification.current)
  }, [draft])

  const validateStep = () => {
    if (!report || !draft) return false
    if (step === 1 && report.sourceSummary.purchaseCount > 0 && !purchaseDecision) {
      toast({ title: "راجع المشتريات أولًا", description: "حدد هل جميع المشتريات تكلفة أعمال أم توجد بينها استثناءات.", variant: "error" })
      return false
    }
    if (step === 1 && purchaseExceptions > report.sourceSummary.taxPurchases) {
      toast({ title: "قيمة الاستثناءات غير صحيحة", description: "لا يمكن أن تتجاوز إجمالي المشتريات الضريبية.", variant: "error" })
      return false
    }
    if (step === 2) {
      const missing = requiredClosingKeys.filter((key) => draft[key].current === "")
      if (missing.length > 0) {
        toast({ title: "أكمل الأرصدة الأساسية", description: "أكد رصيد النقد ورأس المال حتى لو كانت القيمة صفرًا.", variant: "error" })
        return false
      }
    }
    if (step === 3 && !priorDecision) {
      toast({ title: "حدد حالة سنة المقارنة", description: "اختر هل هذه السنة الأولى أم توجد بيانات للسنة السابقة.", variant: "error" })
      return false
    }
    return true
  }

  const moveTo = (nextStep: number) => {
    if (!report) return
    const bounded = Math.max(0, Math.min(steps.length - 1, nextStep))
    setStep(bounded)
    window.localStorage.setItem(`financial-statements-step:${report.organization.id}:${year}`, String(bounded))
    window.requestAnimationFrame(() => pageTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }

  const next = async () => {
    if (!validateStep()) return
    if (step > 0 && !(await persist(false))) return
    moveTo(step + 1)
  }

  const selectPurchaseDecision = (decision: Exclude<PurchaseDecision, undefined>) => {
    setPurchaseDecision(decision)
    if (!draft || decision !== "all_cost") return
    setDraft({
      ...draft,
      purchase_fixed_asset_reclassification: { ...draft.purchase_fixed_asset_reclassification, current: "0" },
      purchase_prepayment_reclassification: { ...draft.purchase_prepayment_reclassification, current: "0" },
    })
  }

  const selectPriorDecision = (decision: Exclude<PriorDecision, undefined>) => {
    setPriorDecision(decision)
    if (!draft || decision !== "first_year") return
    const nextDraft = { ...draft }
    for (const definition of report?.inputDefinitions ?? []) nextDraft[definition.key] = { ...nextDraft[definition.key], prior: "0" }
    setDraft(nextDraft)
  }

  const exportFile = async (type: "word" | "pdf") => {
    if (!report?.validation.isExportable) return
    setExporting(type)
    try {
      await createFinancialStatementSnapshot(year)
      const baseName = `القوائم-المالية-${report.organization.businessName}-${year}`
      if (type === "word") {
        downloadWord(await createFinancialStatementsWord(report), `${baseName}.docx`)
      } else {
        if (!reportRef.current) throw new Error("تعذر تجهيز معاينة PDF")
        downloadPdf(await createFinancialStatementsPdf(reportRef.current), `${baseName}.pdf`)
      }
      toast({ title: "تم إنشاء النسخة الرسمية", description: type === "word" ? "تم تنزيل ملف Word." : "تم تنزيل ملف PDF.", variant: "success" })
    } catch (error) {
      toast({ title: "تعذر التصدير", description: error instanceof Error ? error.message : "حاول مرة أخرى", variant: "error" })
    } finally {
      setExporting(undefined)
    }
  }

  const closeYear=async()=>{
    if(!report?.validation.isExportable)return
    if(!window.confirm(`سيتم حفظ نسخة رسمية وقفل جميع الحركات من ${report.period.startsOn} إلى ${report.period.endsOn}. هل تريد اعتماد السنة؟`))return
    setClosing(true)
    try{await closeFinancialYear(year);toast({title:"تم اعتماد القوائم وقفل السنة",description:"أي تعديل لاحق يتطلب إعادة فتح موثقة من صفحة الضبط المالي.",variant:"success"})}
    catch(error){toast({title:"تعذر إقفال السنة",description:error instanceof Error?error.message:"حاول مرة أخرى",variant:"error"})}
    finally{setClosing(false)}
  }

  if (loading) return <div className="p-6 text-muted-foreground" dir="rtl">جاري إعداد القوائم المالية...</div>
  if (!report || !draft) return <div className="space-y-3 p-6 text-center" dir="rtl"><p>تعذر تحميل القوائم أو أنها غير مفعلة.</p><Button variant="outline" onClick={() => { void load() }}><RefreshCw />إعادة المحاولة</Button></div>

  const current = report.sourceSummary
  const currentSources = [
    ["المبيعات دون الضريبة", current.revenue],
    ["المشتريات الضريبية", current.taxPurchases],
    ["المصروفات التشغيلية", current.operatingExpenses + current.employeeExpenses + current.otherExpenses],
    ["رصيد النقد المستنتج", current.systemCashBalance],
  ] as const
  const automaticBalances = [
    ["ذمم العملاء غير المحصلة", current.tradeReceivables, current.prior.tradeReceivables],
    ["المصاريف المدفوعة مقدمًا", current.prepaymentBalance, current.prior.prepaymentBalance],
    ["المبالغ المستحقة للموردين", current.tradePayables, current.prior.tradePayables],
  ] as const

  const renderInput = (key: FinancialInputKey, period: "current" | "prior" = "current") => {
    const definition = report.inputDefinitions.find((item) => item.key === key)
    if (!definition) return null
    return <div key={`${key}-${period}`} className="rounded-xl border bg-background p-4">
      <div className="mb-3">
        <Label htmlFor={`${key}-${period}`} className="text-sm font-semibold">{definition.label}</Label>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{definition.description}</p>
      </div>
      <div className="max-w-sm">
        <Label htmlFor={`${key}-${period}`} className="mb-1.5 block text-xs text-muted-foreground">{period === "current" ? year : year - 1} — ريال سعودي</Label>
        <Input id={`${key}-${period}`} type="number" min={purchaseKeys.includes(key) ? 0 : undefined} step="0.01" inputMode="decimal" dir="ltr" value={draft[key][period]} onChange={(event) => { updateDraft(key, period, event.target.value) }} />
      </div>
    </div>
  }

  return <div ref={pageTopRef} className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6" dir="rtl">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-bold">معالج القوائم المالية</h1><p className="mt-1 text-sm text-muted-foreground">خطوات قصيرة لإقفال السنة؛ EasyTAX يملأ ما يعرفه ويسألك فقط عما ينقصه.</p></div>
      <div className="flex items-center gap-2"><Label htmlFor="fiscal-year">السنة المالية</Label><Input id="fiscal-year" type="number" min={2020} max={2100} value={year} className="w-28" dir="ltr" onChange={(event) => { setYear(Number(event.target.value)) }} /></div>
    </div>

    <div className="grid grid-cols-5 gap-1 rounded-xl border bg-muted/30 p-2 sm:gap-2">
      {steps.map((item, index) => <button key={item.title} type="button" onClick={() => { if (index <= step) moveTo(index) }} className={`rounded-lg px-2 py-3 text-center transition-colors ${index === step ? "bg-primary text-primary-foreground shadow-sm" : index < step ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100" : "text-muted-foreground"}`}>
        <span className="mx-auto mb-1 flex size-6 items-center justify-center rounded-full border text-xs">{index < step ? <Check className="size-3.5" /> : index + 1}</span>
        <span className="block text-[11px] font-semibold sm:text-sm">{item.title}</span>
        <span className="mt-0.5 hidden text-[11px] opacity-80 lg:block">{item.description}</span>
      </button>)}
    </div>

    {step === 0 && <Card>
      <CardHeader><CardTitle className="text-xl">راجع بيانات السنة {year}</CardTitle><p className="text-sm leading-6 text-muted-foreground">هذه الأرقام جُمعت تلقائيًا من المستندات والمشتريات والمصروفات. لا تحتاج إلى إعادة إدخالها هنا.</p></CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{currentSources.map(([label, value]) => <div key={label} className="rounded-xl border bg-muted/20 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-bold tabular-nums" dir="ltr">{money.format(value)} ر.س</p></div>)}</div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
          <h3 className="flex items-center gap-2 font-semibold text-emerald-900"><CheckCircle2 className="size-5" />أرصدة يحسبها EasyTAX</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-3">{automaticBalances.map(([label, value]) => <div key={label}><p className="text-xs text-emerald-800/70">{label}</p><p className="mt-1 font-semibold tabular-nums" dir="ltr">{money.format(value)} ر.س</p></div>)}</div>
        </div>
        <p className="rounded-lg bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">إذا لاحظت رقمًا غير صحيح، صحّح الفاتورة أو المصروف من سجله الأصلي. لا يسمح المعالج بتغيير البيانات المحسوبة حتى تبقى القوائم مرتبطة بالسجلات الفعلية.</p>
      </CardContent>
    </Card>}

    {step === 1 && <Card>
      <CardHeader><CardTitle className="text-xl">مراجعة المشتريات الضريبية</CardTitle><p className="text-sm leading-6 text-muted-foreground">الافتراضي أن المشتريات البالغة <strong className="text-foreground" dir="ltr">{money.format(current.taxPurchases)} ر.س</strong> هي تكلفة أعمال. غيّر فقط المبالغ الاستثنائية.</p></CardHeader>
      <CardContent className="space-y-5">
        {current.purchaseCount === 0 ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">لا توجد فواتير مشتريات ضريبية مسجلة خلال هذه السنة، ويمكنك المتابعة مباشرة.</div> : <>
          <div className="grid gap-3 md:grid-cols-2">
            <button type="button" onClick={() => { selectPurchaseDecision("all_cost") }} className={`rounded-xl border p-4 text-right transition-colors ${purchaseDecision === "all_cost" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/40"}`}><span className="font-semibold">كلها تكلفة أعمال</span><span className="mt-1 block text-sm leading-6 text-muted-foreground">لا توجد معدات أو دفعات تخص سنة قادمة ضمن المشتريات.</span></button>
            <button type="button" onClick={() => { selectPurchaseDecision("has_exceptions") }} className={`rounded-xl border p-4 text-right transition-colors ${purchaseDecision === "has_exceptions" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/40"}`}><span className="font-semibold">توجد مشتريات استثنائية</span><span className="mt-1 block text-sm leading-6 text-muted-foreground">بعض المبالغ معدات أو أصول، أو دفعات تخص سنة مالية قادمة.</span></button>
          </div>
          {purchaseDecision === "has_exceptions" && <div className="space-y-3 rounded-xl bg-muted/20 p-3 sm:p-4">
            {renderInput("purchase_fixed_asset_reclassification")}
            {renderInput("purchase_prepayment_reclassification")}
            <div className={`rounded-lg px-4 py-3 text-sm ${purchaseExceptions > current.taxPurchases ? "bg-red-50 text-red-800" : "bg-sky-50 text-sky-900"}`}>سيبقى ضمن تكلفة الأعمال: <strong dir="ltr">{money.format(Math.max(0, current.taxPurchases - purchaseExceptions))} ر.س</strong>{purchaseExceptions > current.taxPurchases && <span className="mt-1 block">الاستثناءات تتجاوز إجمالي المشتريات بمبلغ {money.format(purchaseExceptions - current.taxPurchases)} ر.س.</span>}</div>
          </div>}
        </>}
      </CardContent>
    </Card>}

    {step === 2 && <Card>
      <CardHeader><CardTitle className="text-xl">أرصدة الإقفال</CardTitle><p className="text-sm leading-6 text-muted-foreground">أكد أولًا الرصيدين الأساسيين، ثم افتح فقط الأقسام التي تنطبق على منشأتك. أدخل صفرًا إذا كان الرصيد لا شيء.</p></CardHeader>
      <CardContent className="space-y-5">
        <section className="space-y-3"><h3 className="font-semibold">مطلوبان لإكمال المعالج</h3>{requiredClosingKeys.map((key) => renderInput(key))}</section>
        <section className="space-y-3 border-t pt-5"><div><h3 className="font-semibold">هل يوجد شيء آخر؟</h3><p className="mt-1 text-sm text-muted-foreground">لا تفتح قسمًا لا ينطبق عليك؛ سيعامله النظام بصفر.</p></div>
          {optionalSections.map((section) => {
            const open = openSections.has(section.id)
            return <div key={section.id} className="rounded-xl border">
              <button type="button" className="flex w-full items-center justify-between gap-4 p-4 text-right" onClick={() => { setOpenSections((previous) => { const nextSet = new Set(previous); if (nextSet.has(section.id)) nextSet.delete(section.id); else nextSet.add(section.id); return nextSet }) }}>
                <span><span className="block font-semibold">{section.title}</span><span className="mt-1 block text-sm leading-6 text-muted-foreground">{section.description}</span></span>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs ${open ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{open ? "مفتوح" : "إضافة"}</span>
              </button>
              {open && <div className="space-y-3 border-t bg-muted/20 p-3 sm:p-4">{section.keys.map((key) => renderInput(key))}</div>}
            </div>
          })}
        </section>
      </CardContent>
    </Card>}

    {step === 3 && <Card>
      <CardHeader><CardTitle className="text-xl">بيانات السنة السابقة ({year - 1})</CardTitle><p className="text-sm leading-6 text-muted-foreground">تظهر سنة المقارنة بجانب السنة الحالية في القوائم الرسمية. اختر الحالة المناسبة مرة واحدة.</p></CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2">
          <button type="button" onClick={() => { selectPriorDecision("first_year") }} className={`rounded-xl border p-4 text-right transition-colors ${priorDecision === "first_year" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/40"}`}><span className="font-semibold">هذه أول سنة ولا توجد قوائم سابقة</span><span className="mt-1 block text-sm leading-6 text-muted-foreground">سيعرض النظام سنة المقارنة بصفر.</span></button>
          <button type="button" onClick={() => { selectPriorDecision("has_comparison") }} className={`rounded-xl border p-4 text-right transition-colors ${priorDecision === "has_comparison" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/40"}`}><span className="font-semibold">لدي بيانات أو قوائم للسنة السابقة</span><span className="mt-1 block text-sm leading-6 text-muted-foreground">المعاملات المسجلة في EasyTAX محسوبة، وأكمل الأرصدة الأخرى أدناه.</span></button>
        </div>
        {priorDecision === "has_comparison" && <>
          <div className="grid gap-3 sm:grid-cols-3">{[["مبيعات السنة السابقة", current.prior.revenue], ["مشتريات السنة السابقة", current.prior.taxPurchases], ["مصروفات السنة السابقة", current.prior.operatingExpenses + current.prior.employeeExpenses + current.prior.otherExpenses]].map(([label, value]) => <div key={String(label)} className="rounded-xl border bg-emerald-50/30 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 font-bold tabular-nums" dir="ltr">{money.format(Number(value))} ر.س</p></div>)}</div>
          <div className="rounded-xl border bg-muted/20 p-3 sm:p-4">
            <p className="mb-4 text-sm leading-6 text-muted-foreground">إذا سبق اعتماد السنة في EasyTAX تُستعاد أرصدتها تلقائيًا. وإلا فأدخل الرصيدين الأساسيين، ثم افتح فقط الأقسام الموجودة في قائمتك السابقة.</p>
            <div className="space-y-3">{requiredClosingKeys.map((key) => renderInput(key, "prior"))}</div>
          </div>
          {current.prior.purchaseCount > 0 && <div className="rounded-xl border">
            <div className="p-4"><h3 className="font-semibold">استثناءات مشتريات السنة السابقة</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">اتركها صفرًا إذا كانت جميع المشتريات تكلفة أعمال، أو أدخل إجمالي الأصول والمدفوعات المقدمة فقط.</p></div>
            <div className="space-y-3 border-t bg-muted/20 p-3 sm:p-4">{purchaseKeys.map((key) => renderInput(key, "prior"))}</div>
          </div>}
          <div className="space-y-3">
            {optionalSections.map((section) => {
              const open = openPriorSections.has(section.id)
              return <div key={`prior-${section.id}`} className="rounded-xl border">
                <button type="button" className="flex w-full items-center justify-between gap-4 p-4 text-right" onClick={() => { setOpenPriorSections((previous) => { const nextSet = new Set(previous); if (nextSet.has(section.id)) nextSet.delete(section.id); else nextSet.add(section.id); return nextSet }) }}>
                  <span><span className="block font-semibold">{section.title}</span><span className="mt-1 block text-sm leading-6 text-muted-foreground">{section.description}</span></span>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs ${open ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{open ? "مفتوح" : "إضافة"}</span>
                </button>
                {open && <div className="space-y-3 border-t bg-muted/20 p-3 sm:p-4">{section.keys.map((key) => renderInput(key, "prior"))}</div>}
              </div>
            })}
          </div>
        </>}
      </CardContent>
    </Card>}

    {step === 4 && <div className="space-y-5">
      <Card className={report.validation.isExportable ? "border-emerald-300" : "border-red-300"}>
        <CardHeader><CardTitle className="flex items-center gap-2 text-xl">{report.validation.isExportable ? <CheckCircle2 className="text-emerald-600" /> : <AlertTriangle className="text-red-600" />}{report.validation.isExportable ? "القوائم متزنة وجاهزة" : "توجد فروق تحتاج إلى مراجعة"}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-muted/30 p-4"><p className="text-xs text-muted-foreground">إجمالي الموجودات</p><p className="mt-2 font-bold tabular-nums" dir="ltr">{money.format(report.totals.assets)} ر.س</p></div><div className="rounded-xl bg-muted/30 p-4"><p className="text-xs text-muted-foreground">المطلوبات وحقوق الملكية</p><p className="mt-2 font-bold tabular-nums" dir="ltr">{money.format(report.totals.liabilitiesAndEquity)} ر.س</p></div><div className="rounded-xl bg-muted/30 p-4"><p className="text-xs text-muted-foreground">صافي الربح أو الخسارة</p><p className="mt-2 font-bold tabular-nums" dir="ltr">{money.format(report.totals.netProfit)} ر.س</p></div></div>
          <div className="space-y-2">{report.validation.issues.length === 0 ? <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">لا توجد ملاحظات.</p> : report.validation.issues.map((issue) => <div key={issue.code} className={`rounded-lg px-4 py-3 text-sm leading-6 ${issue.severity === "error" ? "bg-red-50 text-red-800" : issue.severity === "warning" ? "bg-amber-50 text-amber-900" : "bg-sky-50 text-sky-800"}`}>{issue.message}{issue.difference === undefined ? "" : ` الفرق: ${money.format(issue.difference)} ر.س`}</div>)}</div>
        </CardContent>
      </Card>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" loading={saving} onClick={() => { void persist() }}><Save />حفظ وإعادة الاحتساب</Button>
        <Button variant="outline" onClick={() => { setShowPreview((value) => !value) }}><FileText />{showPreview ? "إخفاء المعاينة" : "معاينة القوائم"}</Button>
        <Button disabled={!report.validation.isExportable} loading={exporting === "word"} onClick={() => { void exportFile("word") }}><Download />تنزيل Word</Button>
        <Button disabled={!report.validation.isExportable} loading={exporting === "pdf"} onClick={() => { void exportFile("pdf") }}><Download />تنزيل PDF</Button>
        <Button disabled={!report.validation.isExportable} loading={closing} onClick={()=>{void closeYear()}}><LockKeyhole />اعتماد وقفل السنة</Button>
      </div>
      {!report.validation.isExportable && <p className="text-left text-xs text-red-600">التصدير الرسمي مقفل حتى يتساوى المركز المالي ويتطابق رصيد النقد مع التدفقات.</p>}
      <div className={showPreview ? "overflow-x-auto rounded-xl border" : "pointer-events-none fixed -left-[10000px] top-0 opacity-0"} aria-hidden={!showPreview}><div ref={reportRef}><FinancialStatementReportView report={report} /></div></div>
    </div>}

    {step !== 4 && <div className="flex items-center justify-between border-t pt-4">
      <Button variant="outline" disabled={step === 0 || saving} onClick={() => { moveTo(step - 1) }}><ChevronRight />السابق</Button>
      <p className="hidden text-xs text-muted-foreground sm:block">تُحفظ المدخلات مركزيًا عند الانتقال للخطوة التالية.</p>
      <Button loading={saving} onClick={() => { void next() }}>التالي<ChevronLeft /></Button>
    </div>}
    {step === 4 && <div className="flex justify-start border-t pt-4"><Button variant="outline" onClick={() => { moveTo(step - 1) }}><ChevronRight />السابق</Button></div>}
  </div>
}
