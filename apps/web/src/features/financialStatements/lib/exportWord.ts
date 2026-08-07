import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx"
import type { EquityMovementRow, FinancialStatementReport, FinancialStatementRow } from "@/lib/platform/api"

const COLORS = {
  green: "087A5B",
  greenLight: "E8F5F0",
  gray: "F3F4F6",
  grayDark: "4B5563",
  white: "FFFFFF",
  black: "111827",
}

const borders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "E5E7EB" },
  insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "E5E7EB" },
}

const arabicNumber = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })

function amount(value: number) {
  const absolute = arabicNumber.format(Math.abs(value))
  return value < 0 ? `(${absolute})` : absolute
}

function dateLabel(value: string) {
  const [year, month, day] = value.split("-")
  return `${year}/${month}/${day}`
}

function legalFormLabel(value: string) {
  const labels: Record<string, string> = {
    sole_establishment: "مؤسسة فردية",
    limited_liability: "شركة ذات مسؤولية محدودة",
    simplified_joint_stock: "شركة مساهمة مبسطة",
    joint_stock: "شركة مساهمة",
    partnership: "شركة تضامن",
    limited_partnership: "شركة توصية بسيطة",
  }
  return labels[value] ?? value
}

function run(text: string, options: { bold?: boolean; color?: string; size?: number } = {}) {
  return new TextRun({
    text,
    bold: options.bold,
    color: options.color ?? COLORS.black,
    size: options.size ?? 22,
    font: "Arial",
    rightToLeft: true,
  })
}

function paragraph(text: string, options: { bold?: boolean; color?: string; size?: number; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]; spacingAfter?: number } = {}) {
  return new Paragraph({
    bidirectional: true,
    alignment: options.alignment ?? AlignmentType.RIGHT,
    spacing: { after: options.spacingAfter ?? 0, line: 300 },
    children: [run(text, options)],
  })
}

function titleBlock(report: FinancialStatementReport, title: string, newPage = false) {
  const titleRun = (text: string, options: { bold?: boolean; color?: string; size: number; break?: number }) => new TextRun({
    text,
    bold: options.bold,
    color: options.color ?? COLORS.black,
    size: options.size,
    font: "Arial",
    rightToLeft: true,
    break: options.break,
  })
  return [new Paragraph({
    bidirectional: true,
    pageBreakBefore: newPage,
    keepLines: true,
    alignment: AlignmentType.CENTER,
    spacing: { before: 250, after: 200, line: 340 },
    children: [
      titleRun(report.organization.businessName, { bold: true, size: 28, color: COLORS.green }),
      titleRun(legalFormLabel(report.organization.legalForm), { size: 20, color: COLORS.grayDark, break: 1 }),
      titleRun(title, { bold: true, size: 32, break: 2 }),
      titleRun(`للسنة المنتهية في ${dateLabel(report.period.endsOn)}`, { bold: true, size: 22, break: 1 }),
      titleRun("(ريال سعودي)", { size: 19, color: COLORS.grayDark, break: 1 }),
    ],
  })]
}

function tabularTitleBlock(report: FinancialStatementReport, title: string) {
  const none = { style: BorderStyle.NIL, size: 0, color: COLORS.white }
  return [
    new Paragraph({ pageBreakBefore: true, spacing: { after: 0 }, children: [] }),
    new Table({
      width: { size: 9400, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
      rows: [new TableRow({
        cantSplit: true,
        children: [new TableCell({
          borders: { top: none, bottom: none, left: none, right: none },
          margins: { top: 150, bottom: 0, left: 0, right: 0 },
          children: [
            paragraph(report.organization.businessName, { bold: true, size: 28, color: COLORS.green, alignment: AlignmentType.CENTER, spacingAfter: 50 }),
            paragraph(legalFormLabel(report.organization.legalForm), { size: 20, color: COLORS.grayDark, alignment: AlignmentType.CENTER, spacingAfter: 120 }),
            paragraph(title, { bold: true, size: 32, alignment: AlignmentType.CENTER, spacingAfter: 80 }),
            paragraph(`للسنة المنتهية في ${dateLabel(report.period.endsOn)}`, { bold: true, size: 22, alignment: AlignmentType.CENTER, spacingAfter: 30 }),
            paragraph("(ريال سعودي)", { size: 19, color: COLORS.grayDark, alignment: AlignmentType.CENTER, spacingAfter: 180 }),
          ],
        })],
      })],
    }),
  ]
}

function statementHeader(report: FinancialStatementReport) {
  return new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [
      cell("البيان", 4700, { bold: true, fill: COLORS.green, color: COLORS.white }),
      cell("إيضاح", 900, { bold: true, fill: COLORS.green, color: COLORS.white, align: AlignmentType.CENTER }),
      cell(dateLabel(report.period.endsOn), 1900, { bold: true, fill: COLORS.green, color: COLORS.white, align: AlignmentType.CENTER }),
      cell(dateLabel(report.period.priorEndsOn), 1900, { bold: true, fill: COLORS.green, color: COLORS.white, align: AlignmentType.CENTER }),
    ],
  })
}

function cell(text: string, width: number, options: { bold?: boolean; fill?: string; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    shading: options.fill ? { fill: options.fill } : undefined,
    margins: { top: 65, bottom: 65, left: 90, right: 90 },
    children: [paragraph(text, { bold: options.bold, color: options.color, size: 19, alignment: options.align ?? AlignmentType.RIGHT })],
  })
}

function statementTable(report: FinancialStatementReport, rows: FinancialStatementRow[]) {
  const tableRows = rows.map((row) => {
    const heading = row.kind === "heading"
    const emphasized = row.kind === "subtotal" || row.kind === "total"
    const fill = heading ? COLORS.gray : row.kind === "total" ? COLORS.greenLight : undefined
    return new TableRow({
      cantSplit: true,
      children: [
        cell(row.label, 4700, { bold: heading || emphasized, fill }),
        cell("", 900, { fill, align: AlignmentType.CENTER }),
        cell(heading ? "" : amount(row.current), 1900, { bold: emphasized, fill, align: AlignmentType.CENTER }),
        cell(heading ? "" : amount(row.prior), 1900, { bold: emphasized, fill, align: AlignmentType.CENTER }),
      ],
    })
  })
  return new Table({
    rows: [statementHeader(report), ...tableRows],
    width: { size: 9400, type: WidthType.DXA },
    columnWidths: [4700, 900, 1900, 1900],
    layout: TableLayoutType.FIXED,
    visuallyRightToLeft: true,
    borders,
    margins: { top: 80, bottom: 80, left: 80, right: 80 },
  })
}

function equityTable(report: FinancialStatementReport, rows: EquityMovementRow[]) {
  const widths: [number, number, number, number, number, number] = [3000, 1250, 1250, 1600, 1200, 1200]
  const headers = ["البيان", "رأس المال", "احتياطي نظامي", "أرباح مبقاة", "عناصر أخرى", "الإجمالي"]
  return new Table({
    rows: [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: headers.map((label, index) => cell(label, widths[index] ?? 1200, { bold: true, fill: COLORS.green, color: COLORS.white, align: AlignmentType.CENTER })),
      }),
      ...rows.map((row) => {
        const closing = row.code === "closing_balance"
        const fill = closing ? COLORS.greenLight : undefined
        return new TableRow({
          cantSplit: true,
          children: [
            cell(row.label, widths[0], { bold: closing, fill }),
            cell(amount(row.capital), widths[1], { bold: closing, fill, align: AlignmentType.CENTER }),
            cell(amount(row.statutoryReserve), widths[2], { bold: closing, fill, align: AlignmentType.CENTER }),
            cell(amount(row.retainedEarnings), widths[3], { bold: closing, fill, align: AlignmentType.CENTER }),
            cell(amount(row.otherEquity), widths[4], { bold: closing, fill, align: AlignmentType.CENTER }),
            cell(amount(row.total), widths[5], { bold: true, fill, align: AlignmentType.CENTER }),
          ],
        })
      }),
    ],
    width: { size: 9500, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    visuallyRightToLeft: true,
    borders,
    margins: { top: 70, bottom: 70, left: 60, right: 60 },
  })
}

export async function createFinancialStatementsWord(report: FinancialStatementReport): Promise<Blob> {
  const footer = () => new Footer({
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run("صفحة ", { size: 18, color: COLORS.grayDark }), new TextRun({ children: [PageNumber.CURRENT], size: 18, color: COLORS.grayDark, font: "Arial" })] })],
  })
  const page = { size: { width: 11906, height: 16838 }, margin: { top: 850, right: 900, bottom: 850, left: 900, header: 400, footer: 400 } }
  const children = [
    ...titleBlock(report, "قائمة المركز المالي"),
    statementTable(report, report.statements.financialPosition),
    ...titleBlock(report, "قائمة الدخل الشامل", true),
    statementTable(report, report.statements.comprehensiveIncome),
    ...tabularTitleBlock(report, "قائمة التغيرات في حقوق الملكية"),
    equityTable(report, report.statements.changesInEquity),
    ...titleBlock(report, "قائمة التدفقات النقدية", true),
    statementTable(report, report.statements.cashFlows),
  ]

  const document = new Document({
    title: `القوائم المالية ${report.organization.businessName} ${report.period.fiscalYear}`,
    creator: "EasyTAX",
    description: "قوائم مالية مبسطة معدة وفق بنود نموذج قوائم للشركات متناهية الصغر والصغيرة",
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 22, rightToLeft: true },
          paragraph: { spacing: { line: 300 } },
        },
      },
    },
    sections: [{
      properties: { page: { ...page, pageNumbers: { start: 1 } } },
      footers: { default: footer() },
      children,
    }],
  })

  return Packer.toBlob(document)
}

export function downloadWord(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => { URL.revokeObjectURL(url) }, 1_000)
}
