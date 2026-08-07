import type { EquityMovementRow, FinancialStatementReport, FinancialStatementRow } from "@/lib/platform/api"

const money = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })

function amount(value: number) {
  const formatted = money.format(Math.abs(value))
  return value < 0 ? `(${formatted})` : formatted
}

function dateLabel(value: string) {
  const [year, month, day] = value.split("-")
  return `${year}/${month}/${day}`
}

const legalForms: Record<string, string> = {
  sole_establishment: "مؤسسة فردية",
  limited_liability: "شركة ذات مسؤولية محدودة",
  simplified_joint_stock: "شركة مساهمة مبسطة",
  joint_stock: "شركة مساهمة",
  partnership: "شركة تضامن",
  limited_partnership: "شركة توصية بسيطة",
}

function Header({ report, title, continuation }: { report: FinancialStatementReport; title: string; continuation?: boolean }) {
  return <header className="mb-5 text-center">
    <p className="text-lg font-bold text-emerald-800">{report.organization.businessName}</p>
    <p className="text-[11px] text-slate-500">{legalForms[report.organization.legalForm] ?? report.organization.legalForm}</p>
    <h2 className="mt-4 text-xl font-bold">{title}{continuation ? " (تتمة)" : ""}</h2>
    <p className="mt-1 text-xs font-semibold">للسنة المنتهية في {dateLabel(report.period.endsOn)}</p>
    <p className="mt-1 text-[10px] text-slate-500">(ريال سعودي)</p>
  </header>
}

function StatementTable({ report, rows }: { report: FinancialStatementReport; rows: FinancialStatementRow[] }) {
  return <table className="w-full table-fixed border-collapse text-[10px]">
    <thead><tr className="bg-emerald-800 text-white">
      <th className="w-[50%] border border-emerald-900 px-2 py-2 text-right">البيان</th>
      <th className="w-[10%] border border-emerald-900 px-1 py-2">إيضاح</th>
      <th className="w-[20%] border border-emerald-900 px-1 py-2">{dateLabel(report.period.endsOn)}</th>
      <th className="w-[20%] border border-emerald-900 px-1 py-2">{dateLabel(report.period.priorEndsOn)}</th>
    </tr></thead>
    <tbody>{rows.map((row) => {
      const heading = row.kind === "heading"
      const total = row.kind === "total"
      const subtotal = row.kind === "subtotal"
      return <tr key={row.code} className={heading ? "bg-slate-100 font-bold" : total ? "bg-emerald-50 font-bold" : subtotal ? "font-bold" : ""}>
        <td className="border border-slate-300 px-2 py-1.5 text-right">{row.label}</td>
        <td className="border border-slate-300 px-1 py-1.5 text-center" />
        <td className="border border-slate-300 px-1 py-1.5 text-center tabular-nums" dir="ltr">{heading ? "" : amount(row.current)}</td>
        <td className="border border-slate-300 px-1 py-1.5 text-center tabular-nums" dir="ltr">{heading ? "" : amount(row.prior)}</td>
      </tr>
    })}</tbody>
  </table>
}

function EquityTable({ rows }: { rows: EquityMovementRow[] }) {
  const columns: Array<{ label: string; value: (row: EquityMovementRow) => number }> = [
    { label: "رأس المال", value: (row) => row.capital },
    { label: "احتياطي نظامي", value: (row) => row.statutoryReserve },
    { label: "أرباح مبقاة", value: (row) => row.retainedEarnings },
    { label: "عناصر أخرى", value: (row) => row.otherEquity },
    { label: "الإجمالي", value: (row) => row.total },
  ]
  return <table className="w-full table-fixed border-collapse text-[9px]">
    <thead><tr className="bg-emerald-800 text-white"><th className="w-[28%] border border-emerald-900 p-2 text-right">البيان</th>{columns.map((column) => <th key={column.label} className="border border-emerald-900 p-1.5">{column.label}</th>)}</tr></thead>
    <tbody>{rows.map((row) => <tr key={row.code} className={row.code === "closing_balance" ? "bg-emerald-50 font-bold" : ""}>
      <td className="border border-slate-300 px-2 py-2 text-right">{row.label}</td>
      {columns.map((column) => <td key={column.label} className="border border-slate-300 px-1 py-2 text-center tabular-nums" dir="ltr">{amount(column.value(row))}</td>)}
    </tr>)}</tbody>
  </table>
}

function Page({ children }: { children: React.ReactNode }) {
  return <section data-financial-statement-page className="mx-auto flex h-[1123px] w-[794px] shrink-0 flex-col overflow-hidden bg-white px-[52px] py-[48px] text-slate-900 shadow-sm print:shadow-none" dir="rtl">
    {children}
    <footer className="mt-auto border-t border-slate-200 pt-2 text-center text-[9px] text-slate-400">أُعدت بواسطة EasyTAX</footer>
  </section>
}

export function FinancialStatementReportView({ report }: { report: FinancialStatementReport }) {
  const positionSplit = report.statements.financialPosition.findIndex((row) => row.code === "equity_and_liabilities")
  const assets = report.statements.financialPosition.slice(0, positionSplit)
  const equityAndLiabilities = report.statements.financialPosition.slice(positionSplit)
  return <div className="space-y-6 bg-slate-200 p-4" data-financial-report>
    <Page><Header report={report} title="قائمة المركز المالي" /><StatementTable report={report} rows={assets} /></Page>
    <Page><Header report={report} title="قائمة المركز المالي" continuation /><StatementTable report={report} rows={equityAndLiabilities} /></Page>
    <Page><Header report={report} title="قائمة الدخل الشامل" /><StatementTable report={report} rows={report.statements.comprehensiveIncome} /></Page>
    <Page><Header report={report} title="قائمة التغيرات في حقوق الملكية" /><EquityTable rows={report.statements.changesInEquity} /></Page>
    <Page><Header report={report} title="قائمة التدفقات النقدية" /><StatementTable report={report} rows={report.statements.cashFlows} /></Page>
  </div>
}
