import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { auth } from "../lib/auth"
import { sql, withTransaction } from "../lib/db"
import {
  buildFinancialStatements,
  financialInputKeys,
  type FinancialInputKey,
  type FinancialInputValue,
  type FinancialSourceTotals,
} from "../lib/financialStatements"

export const financialStatementsRouter = new Hono()

async function organizationId(headers: Headers): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await (auth.api as any).getSession({ headers })
  if (!session?.user?.id) return null
  const rows = await sql`SELECT id FROM organizations WHERE user_id=${session.user.id as string} AND deleted_at IS NULL LIMIT 1`
  return (rows[0]?.id as string | undefined) ?? null
}

function parsedYear(raw: string) {
  const value = Number(raw)
  return Number.isInteger(value) && value >= 2020 && value <= 2100 ? value : null
}

function fiscalYearRange(fiscalYear: number, startMonth: number) {
  const startsInPreviousCalendarYear = startMonth !== 1
  const startYear = startsInPreviousCalendarYear ? fiscalYear - 1 : fiscalYear
  const startsOn = `${startYear}-${String(startMonth).padStart(2, "0")}-01`
  const endDate = new Date(Date.UTC(startYear + 1, startMonth - 1, 0))
  const endsOn = endDate.toISOString().slice(0, 10)
  return { startsOn, endsOn }
}

const numberValue = (value: unknown) => Number(value ?? 0)

async function loadSources(orgId: string, startsOn: string, endsOn: string): Promise<FinancialSourceTotals> {
  const rows = await sql`
    SELECT
      (SELECT COALESCE(SUM(total-tax_total),0) FROM documents
        WHERE organization_id=${orgId} AND type='invoice' AND status IN ('issued','paid','partially_paid')
          AND deleted_at IS NULL AND issue_date BETWEEN ${startsOn} AND ${endsOn}) AS revenue,
      (SELECT COALESCE(SUM(total),0) FROM documents
        WHERE organization_id=${orgId} AND type='invoice' AND status IN ('issued','paid','partially_paid')
          AND deleted_at IS NULL AND issue_date BETWEEN ${startsOn} AND ${endsOn}) AS invoice_total,
      (SELECT COALESCE(SUM(tax_total),0) FROM documents
        WHERE organization_id=${orgId} AND type='invoice' AND status IN ('issued','paid','partially_paid')
          AND deleted_at IS NULL AND issue_date BETWEEN ${startsOn} AND ${endsOn}) AS sales_tax,
      (SELECT COALESCE(SUM(CASE WHEN include_in_tax_return THEN subtotal ELSE total END),0) FROM purchase_invoices
        WHERE organization_id=${orgId} AND accounting_status='recorded' AND deleted_at IS NULL
          AND invoice_date BETWEEN ${startsOn} AND ${endsOn}) AS tax_purchases,
      (SELECT COALESCE(SUM(tax_total),0) FROM purchase_invoices
        WHERE organization_id=${orgId} AND accounting_status='recorded' AND include_in_tax_return=TRUE AND deleted_at IS NULL
          AND invoice_date BETWEEN ${startsOn} AND ${endsOn}) AS purchase_tax,
      (SELECT COALESCE(SUM(amount),0) FROM expenses
        WHERE organization_id=${orgId} AND deleted_at IS NULL AND source_type='manual'
          AND financial_class='direct_cost' AND expense_date BETWEEN ${startsOn} AND ${endsOn}) AS direct_costs,
      (SELECT COALESCE(SUM(amount),0) FROM expenses
        WHERE organization_id=${orgId} AND deleted_at IS NULL AND source_type='manual'
          AND financial_class='employee_expense' AND expense_date BETWEEN ${startsOn} AND ${endsOn}) AS employee_expenses,
      (SELECT COALESCE(SUM(amount),0) FROM expenses
        WHERE organization_id=${orgId} AND deleted_at IS NULL AND source_type='manual'
          AND financial_class='operating_expense' AND expense_date BETWEEN ${startsOn} AND ${endsOn}) AS operating_expenses,
      (SELECT COALESCE(SUM(amount),0) FROM expenses
        WHERE organization_id=${orgId} AND deleted_at IS NULL AND source_type='manual'
          AND financial_class='other_expense' AND expense_date BETWEEN ${startsOn} AND ${endsOn}) AS other_expenses,
      (SELECT COALESCE(SUM(amount),0) FROM expenses
        WHERE organization_id=${orgId} AND deleted_at IS NULL AND source_type='manual'
          AND financial_class='fixed_asset' AND expense_date BETWEEN ${startsOn} AND ${endsOn}) AS fixed_asset_additions,
      (SELECT COALESCE(SUM(amount),0) FROM expenses
        WHERE organization_id=${orgId} AND deleted_at IS NULL AND source_type='manual'
          AND financial_class='fixed_asset' AND expense_date<=${endsOn}) AS fixed_asset_balance,
      (SELECT COALESCE(SUM(amount),0) FROM expenses
        WHERE organization_id=${orgId} AND deleted_at IS NULL AND source_type='manual'
          AND financial_class='prepayment' AND expense_date<=${endsOn}) AS prepayment_balance,
      (SELECT COALESCE(SUM(amount),0) FROM customer_receipts
        WHERE organization_id=${orgId} AND status='issued' AND receipt_date BETWEEN ${startsOn} AND ${endsOn}) AS receipt_inflows,
      (SELECT COALESCE(SUM(amount),0) FROM customer_receipts
        WHERE organization_id=${orgId} AND status='issued' AND source_document_id IS NULL AND receipt_date<=${endsOn}) AS standalone_advances,
      (SELECT COALESCE(SUM(amount),0) FROM expense_payments
        WHERE organization_id=${orgId} AND payment_date BETWEEN ${startsOn} AND ${endsOn}) AS expense_payments,
      (SELECT COALESCE(SUM(amount),0) FROM purchase_invoice_payments
        WHERE organization_id=${orgId} AND status='issued' AND payment_date BETWEEN ${startsOn} AND ${endsOn}) AS purchase_payments,
      ((SELECT COALESCE(SUM(amount),0) FROM customer_receipts
          WHERE organization_id=${orgId} AND status='issued' AND receipt_date<=${endsOn})
       - (SELECT COALESCE(SUM(amount),0) FROM expense_payments
          WHERE organization_id=${orgId} AND payment_date<=${endsOn})
       - (SELECT COALESCE(SUM(amount),0) FROM purchase_invoice_payments
          WHERE organization_id=${orgId} AND status='issued' AND payment_date<=${endsOn})) AS system_cash_balance,
      (SELECT COALESCE(SUM(GREATEST(d.total-COALESCE((
          SELECT SUM(cr.amount) FROM customer_receipts cr
          WHERE cr.organization_id=${orgId} AND cr.source_document_id=d.id AND cr.status='issued' AND cr.receipt_date<=${endsOn}
        ),0),0)),0)
        FROM documents d
        WHERE d.organization_id=${orgId} AND d.type='invoice' AND d.status IN ('issued','paid','partially_paid')
          AND d.deleted_at IS NULL AND d.issue_date<=${endsOn}) AS trade_receivables,
      ((SELECT COALESCE(SUM(GREATEST(e.amount-COALESCE((
          SELECT SUM(ep.amount) FROM expense_payments ep
          WHERE ep.organization_id=${orgId} AND ep.expense_id=e.id AND ep.payment_date<=${endsOn}
        ),0),0)),0)
        FROM expenses e
        WHERE e.organization_id=${orgId} AND e.deleted_at IS NULL AND e.source_type='manual' AND e.expense_date<=${endsOn})
       + (SELECT COALESCE(SUM(GREATEST(pi.total-COALESCE((
            SELECT SUM(pip.amount) FROM purchase_invoice_payments pip
            WHERE pip.organization_id=${orgId} AND pip.purchase_invoice_id=pi.id
              AND pip.status='issued' AND pip.payment_date<=${endsOn}
          ),0),0)),0)
          FROM purchase_invoices pi
          WHERE pi.organization_id=${orgId} AND pi.accounting_status='recorded' AND pi.deleted_at IS NULL AND pi.invoice_date<=${endsOn})) AS trade_payables,
      (SELECT COUNT(*) FROM documents
        WHERE organization_id=${orgId} AND type='invoice' AND status IN ('issued','paid','partially_paid')
          AND deleted_at IS NULL AND issue_date BETWEEN ${startsOn} AND ${endsOn}) AS invoice_count,
      (SELECT COUNT(*) FROM purchase_invoices
        WHERE organization_id=${orgId} AND accounting_status='recorded' AND deleted_at IS NULL
          AND invoice_date BETWEEN ${startsOn} AND ${endsOn}) AS purchase_count,
      (SELECT COUNT(*) FROM expenses
        WHERE organization_id=${orgId} AND deleted_at IS NULL AND source_type='manual'
          AND expense_date BETWEEN ${startsOn} AND ${endsOn}) AS expense_count
  `
  const row = rows[0] ?? {}
  return {
    revenue: numberValue(row.revenue),
    invoiceTotal: numberValue(row.invoice_total),
    salesTax: numberValue(row.sales_tax),
    taxPurchases: numberValue(row.tax_purchases),
    purchaseTax: numberValue(row.purchase_tax),
    directCosts: numberValue(row.direct_costs),
    employeeExpenses: numberValue(row.employee_expenses),
    operatingExpenses: numberValue(row.operating_expenses),
    otherExpenses: numberValue(row.other_expenses),
    fixedAssetAdditions: numberValue(row.fixed_asset_additions),
    fixedAssetBalance: numberValue(row.fixed_asset_balance),
    prepaymentBalance: numberValue(row.prepayment_balance),
    receiptInflows: numberValue(row.receipt_inflows),
    standaloneAdvances: numberValue(row.standalone_advances),
    expensePayments: numberValue(row.expense_payments),
    purchasePayments: numberValue(row.purchase_payments),
    systemCashBalance: numberValue(row.system_cash_balance),
    tradeReceivables: numberValue(row.trade_receivables),
    tradePayables: numberValue(row.trade_payables),
    invoiceCount: numberValue(row.invoice_count),
    purchaseCount: numberValue(row.purchase_count),
    expenseCount: numberValue(row.expense_count),
  }
}

async function buildReport(orgId: string, fiscalYear: number) {
  const organizations = await sql`
    SELECT id,business_name,vat_number,commercial_registration,legal_form,fiscal_year_start_month,financial_reporting_enabled
    FROM organizations WHERE id=${orgId} AND deleted_at IS NULL LIMIT 1`
  const organization = organizations[0] as Record<string, unknown> | undefined
  if (!organization) return { error: "NOT_FOUND" as const }
  if (!organization.financial_reporting_enabled) return { error: "NOT_ENABLED" as const }
  const startMonth = Number(organization.fiscal_year_start_month || 1)
  const currentRange = fiscalYearRange(fiscalYear, startMonth)
  const priorRange = fiscalYearRange(fiscalYear - 1, startMonth)
  const [current, prior, inputRows, priorSnapshots] = await Promise.all([
    loadSources(orgId, currentRange.startsOn, currentRange.endsOn),
    loadSources(orgId, priorRange.startsOn, priorRange.endsOn),
    sql`SELECT fsi.input_key,fsi.current_amount,fsi.prior_amount,fsi.note
        FROM financial_statement_inputs fsi
        JOIN financial_statement_periods fsp ON fsp.id=fsi.period_id
        WHERE fsi.organization_id=${orgId} AND fsp.organization_id=${orgId} AND fsp.fiscal_year=${fiscalYear}`,
    sql`SELECT fss.report
        FROM financial_statement_snapshots fss
        JOIN financial_statement_periods fsp ON fsp.id=fss.period_id
        WHERE fss.organization_id=${orgId} AND fsp.organization_id=${orgId} AND fsp.fiscal_year=${fiscalYear - 1}
        ORDER BY fss.version DESC
        LIMIT 1`,
  ])
  const inputs: Partial<Record<FinancialInputKey, FinancialInputValue>> = {}
  for (const row of inputRows) {
    const key = String(row.input_key) as FinancialInputKey
    if (!financialInputKeys.includes(key)) continue
    inputs[key] = {
      current: row.current_amount === null ? null : Number(row.current_amount),
      prior: row.prior_amount === null ? null : Number(row.prior_amount),
      ...(row.note ? { note: String(row.note) } : {}),
    }
  }
  const priorSnapshot = priorSnapshots[0]?.report as { inputs?: Partial<Record<FinancialInputKey, FinancialInputValue>> } | undefined
  for (const key of financialInputKeys) {
    if (inputs[key]?.prior !== null && inputs[key]?.prior !== undefined) continue
    const previousCurrent = priorSnapshot?.inputs?.[key]?.current
    if (previousCurrent === null || previousCurrent === undefined) continue
    inputs[key] = { ...inputs[key], current: inputs[key]?.current ?? null, prior: Number(previousCurrent) }
  }
  return {
    report: buildFinancialStatements({
      organization: {
        id: String(organization.id),
        businessName: String(organization.business_name ?? ""),
        legalForm: String(organization.legal_form ?? ""),
        vatNumber: String(organization.vat_number ?? ""),
        commercialRegistration: String(organization.commercial_registration ?? ""),
      },
      period: {
        fiscalYear,
        startsOn: currentRange.startsOn,
        endsOn: currentRange.endsOn,
        priorStartsOn: priorRange.startsOn,
        priorEndsOn: priorRange.endsOn,
        currency: "SAR",
      },
      current,
      prior,
      inputs,
    }),
  }
}

financialStatementsRouter.get("/:year", async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const year = parsedYear(c.req.param("year"))
  if (!year) return c.json({ error: "السنة المالية غير صحيحة" }, 400)
  const result = await buildReport(orgId, year)
  if ("error" in result) {
    if (result.error === "NOT_ENABLED") return c.json({ error: "فعّل القوائم المالية من الإعدادات أولًا" }, 403)
    return c.json({ error: "المنشأة غير موجودة" }, 404)
  }
  return c.json({ report: result.report })
})

const inputSchema = z.object({
  inputs: z.array(z.object({
    key: z.enum(financialInputKeys),
    current_amount: z.number().finite().nullable(),
    prior_amount: z.number().finite().nullable(),
    note: z.string().trim().max(500).optional(),
  })).max(financialInputKeys.length),
})

financialStatementsRouter.put("/:year/inputs", zValidator("json", inputSchema), async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const year = parsedYear(c.req.param("year"))
  if (!year) return c.json({ error: "السنة المالية غير صحيحة" }, 400)
  const organizationRows = await sql`SELECT fiscal_year_start_month,financial_reporting_enabled FROM organizations WHERE id=${orgId} AND deleted_at IS NULL`
  const organization = organizationRows[0]
  if (!organization) return c.json({ error: "المنشأة غير موجودة" }, 404)
  if (!organization.financial_reporting_enabled) return c.json({ error: "فعّل القوائم المالية من الإعدادات أولًا" }, 403)
  const range = fiscalYearRange(year, Number(organization.fiscal_year_start_month || 1))
  const body = c.req.valid("json")
  await withTransaction(async (client) => {
    const periodResult = await client.query(`
      INSERT INTO financial_statement_periods(organization_id,fiscal_year,starts_on,ends_on)
      VALUES($1,$2,$3,$4)
      ON CONFLICT(organization_id,fiscal_year) DO UPDATE SET starts_on=EXCLUDED.starts_on,ends_on=EXCLUDED.ends_on,status='draft',updated_at=NOW()
      RETURNING id`, [orgId, year, range.startsOn, range.endsOn])
    const periodId = String(periodResult.rows[0].id)
    for (const item of body.inputs) {
      if (item.current_amount === null && item.prior_amount === null && !item.note) {
        await client.query("DELETE FROM financial_statement_inputs WHERE organization_id=$1 AND period_id=$2 AND input_key=$3", [orgId, periodId, item.key])
        continue
      }
      await client.query(`
        INSERT INTO financial_statement_inputs(organization_id,period_id,input_key,current_amount,prior_amount,note)
        VALUES($1,$2,$3,$4,$5,$6)
        ON CONFLICT(period_id,input_key) DO UPDATE SET current_amount=EXCLUDED.current_amount,prior_amount=EXCLUDED.prior_amount,note=EXCLUDED.note,updated_at=NOW()`,
      [orgId, periodId, item.key, item.current_amount, item.prior_amount, item.note || null])
    }
  })
  const refreshed = await buildReport(orgId, year)
  if ("error" in refreshed) return c.json({ error: "تعذر إعادة إعداد القوائم" }, 500)
  return c.json({ report: refreshed.report })
})

financialStatementsRouter.post("/:year/snapshots", async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const year = parsedYear(c.req.param("year"))
  if (!year) return c.json({ error: "السنة المالية غير صحيحة" }, 400)
  const result = await buildReport(orgId, year)
  if ("error" in result) return c.json({ error: result.error === "NOT_ENABLED" ? "فعّل القوائم المالية من الإعدادات أولًا" : "تعذر إعداد القوائم" }, result.error === "NOT_ENABLED" ? 403 : 404)
  if (!result.report.validation.isExportable) return c.json({ error: "عالج أخطاء التوازن والتدفق النقدي قبل إنشاء النسخة الرسمية", validation: result.report.validation }, 422)
  const snapshot = await withTransaction(async (client) => {
    const range = result.report.period
    const periodResult = await client.query(`
      INSERT INTO financial_statement_periods(organization_id,fiscal_year,starts_on,ends_on,status)
      VALUES($1,$2,$3,$4,'generated')
      ON CONFLICT(organization_id,fiscal_year) DO UPDATE SET status='generated',updated_at=NOW()
      RETURNING id`, [orgId, year, range.startsOn, range.endsOn])
    const periodId = String(periodResult.rows[0].id)
    await client.query("SELECT id FROM financial_statement_periods WHERE id=$1 FOR UPDATE", [periodId])
    const versionResult = await client.query("SELECT COALESCE(MAX(version),0)+1 AS version FROM financial_statement_snapshots WHERE period_id=$1", [periodId])
    const version = Number(versionResult.rows[0].version)
    const inserted = await client.query(`
      INSERT INTO financial_statement_snapshots(organization_id,period_id,version,report,validation)
      VALUES($1,$2,$3,$4,$5) RETURNING id,version,generated_at`,
    [orgId, periodId, version, JSON.stringify(result.report), JSON.stringify(result.report.validation)])
    await client.query("INSERT INTO financial_audit_events(organization_id,entity_type,entity_id,action,snapshot) VALUES($1,'financial_statement',$2,'created',$3)", [orgId, inserted.rows[0].id, JSON.stringify({ fiscal_year: year, version })])
    return inserted.rows[0]
  })
  return c.json({ snapshot }, 201)
})
