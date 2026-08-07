import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, Download, FileText, RefreshCw, Save } from "lucide-react"
import {
  createFinancialStatementSnapshot,
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
const groupLabels = { assets: "الموجودات", liabilities: "المطلوبات", equity: "حقوق الملكية", income: "الدخل والمصاريف" }
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

export default function FinancialStatementsPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [report, setReport] = useState<FinancialStatementReport>()
  const [draft, setDraft] = useState<InputDraft>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState<"word" | "pdf">()
  const [showInputs, setShowInputs] = useState(true)
  const [showPreview, setShowPreview] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchFinancialStatements(year)
      setReport(result.report)
      setDraft(draftFromReport(result.report))
    } catch (error) {
      setReport(undefined)
      toast({ title: "تعذر إعداد القوائم المالية", description: error instanceof Error ? error.message : "حاول مرة أخرى", variant: "error" })
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => { void load() }, [load])

  const save = async () => {
    if (!report || !draft) return
    setSaving(true)
    try {
      const result = await saveFinancialStatementInputs(year, report.inputDefinitions.map((definition) => ({
        key: definition.key,
        current_amount: draft[definition.key].current === "" ? null : Number(draft[definition.key].current),
        prior_amount: draft[definition.key].prior === "" ? null : Number(draft[definition.key].prior),
      })))
      setReport(result.report)
      setDraft(draftFromReport(result.report))
      toast({ title: "تم حفظ بيانات القوائم", description: "أُعيد احتساب القوائم والتحقق من اتزانها.", variant: "success" })
    } catch (error) {
      toast({ title: "تعذر الحفظ", description: error instanceof Error ? error.message : "راجع القيم المدخلة", variant: "error" })
    } finally {
      setSaving(false)
    }
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

  if (loading) return <div className="p-6 text-muted-foreground" dir="rtl">جاري إعداد القوائم المالية...</div>
  if (!report || !draft) return <div className="space-y-3 p-6 text-center" dir="rtl"><p>تعذر تحميل القوائم أو أنها غير مفعلة.</p><Button variant="outline" onClick={() => { void load() }}><RefreshCw />إعادة المحاولة</Button></div>

  const current = report.sourceSummary
  const sources = [
    ["المبيعات دون الضريبة", current.revenue],
    ["المشتريات الضريبية", current.taxPurchases],
    ["المصروفات التشغيلية", current.operatingExpenses + current.employeeExpenses + current.otherExpenses],
    ["ذمم العملاء", current.tradeReceivables],
  ] as const

  return <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6" dir="rtl">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-bold">القوائم المالية</h1><p className="mt-1 text-sm text-muted-foreground">معالج نهاية السنة: يجمع المسجل في EasyTAX ويطلب الأرصدة التي لا يستطيع النظام استنتاجها.</p></div>
      <div className="flex items-center gap-2"><Label htmlFor="fiscal-year">السنة المالية</Label><Input id="fiscal-year" type="number" min={2020} max={2100} value={year} className="w-28" dir="ltr" onChange={(event) => { setYear(Number(event.target.value)) }} /></div>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{sources.map(([label, value]) => <Card key={label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-bold tabular-nums" dir="ltr">{money.format(value)} ر.س</p></CardContent></Card>)}</div>

    <Card className={report.validation.isExportable ? "border-emerald-200" : "border-red-300"}>
      <CardHeader><CardTitle className="flex items-center gap-2 text-lg">{report.validation.isExportable ? <CheckCircle2 className="text-emerald-600" /> : <AlertTriangle className="text-red-600" />}{report.validation.isExportable ? "القوائم متزنة وجاهزة للتصدير" : "القوائم تحتاج إلى مراجعة قبل التصدير"}</CardTitle></CardHeader>
      <CardContent className="space-y-2">{report.validation.issues.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد ملاحظات.</p> : report.validation.issues.map((issue) => <div key={issue.code} className={`rounded-md px-3 py-2 text-sm ${issue.severity === "error" ? "bg-red-50 text-red-800" : issue.severity === "warning" ? "bg-amber-50 text-amber-900" : "bg-sky-50 text-sky-800"}`}>{issue.message}{issue.difference === undefined ? "" : ` الفرق: ${money.format(issue.difference)} ر.س`}</div>)}</CardContent>
    </Card>

    <Card>
      <CardHeader className="flex-row items-center justify-between"><div><CardTitle className="text-lg">أرصدة الإقفال والمعلومات المكملة</CardTitle><p className="mt-1 text-sm text-muted-foreground">اترك الحقل فارغًا عندما يذكر الشرح أن EasyTAX سيعتمده تلقائيًا.</p></div><Button variant="outline" onClick={() => { setShowInputs((value) => !value) }}>{showInputs ? "إخفاء" : "عرض"}</Button></CardHeader>
      {showInputs && <CardContent className="space-y-7">{(["assets", "liabilities", "equity", "income"] as const).map((group) => <section key={group}><h3 className="mb-3 border-b pb-2 font-semibold">{groupLabels[group]}</h3><div className="space-y-3">{report.inputDefinitions.filter((definition) => definition.group === group).map((definition) => <div key={definition.key} className="grid items-end gap-3 rounded-lg border p-3 md:grid-cols-[1fr_170px_170px]">
        <div><Label>{definition.label}</Label><p className="mt-1 text-xs text-muted-foreground">{definition.description}</p></div>
        <div><Label className="text-xs">{year}</Label><Input type="number" step="0.01" dir="ltr" value={draft[definition.key].current} onChange={(event) => { setDraft({ ...draft, [definition.key]: { ...draft[definition.key], current: event.target.value } }) }} /></div>
        <div><Label className="text-xs">{year - 1}</Label><Input type="number" step="0.01" dir="ltr" value={draft[definition.key].prior} onChange={(event) => { setDraft({ ...draft, [definition.key]: { ...draft[definition.key], prior: event.target.value } }) }} /></div>
      </div>)}</div></section>)}</CardContent>}
    </Card>

    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="outline" loading={saving} onClick={() => { void save() }}><Save />حفظ وإعادة الاحتساب</Button>
      <Button variant="outline" onClick={() => { setShowPreview((value) => !value) }}><FileText />{showPreview ? "إخفاء المعاينة" : "معاينة القوائم"}</Button>
      <Button disabled={!report.validation.isExportable} loading={exporting === "word"} onClick={() => { void exportFile("word") }}><Download />تنزيل Word</Button>
      <Button disabled={!report.validation.isExportable} loading={exporting === "pdf"} onClick={() => { void exportFile("pdf") }}><Download />تنزيل PDF</Button>
    </div>
    {!report.validation.isExportable && <p className="text-left text-xs text-red-600">التصدير الرسمي مقفل حتى يتساوى المركز المالي ويتطابق رصيد النقد مع التدفقات.</p>}

    <div className={showPreview ? "overflow-x-auto rounded-xl border" : "pointer-events-none fixed -left-[10000px] top-0 opacity-0"} aria-hidden={!showPreview}>
      <div ref={reportRef}><FinancialStatementReportView report={report} /></div>
    </div>
  </div>
}
