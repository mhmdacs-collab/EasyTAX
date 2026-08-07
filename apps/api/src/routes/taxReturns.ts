import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { auth } from "../lib/auth"
import { sql, withTransaction } from "../lib/db"

export const taxReturnsRouter = new Hono()

async function organizationId(headers: Headers): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await (auth.api as any).getSession({ headers })
  if (!session?.user?.id) return null
  const rows = await sql`SELECT id FROM organizations WHERE user_id=${session.user.id as string} AND deleted_at IS NULL LIMIT 1`
  return (rows[0]?.id as string | undefined) ?? null
}

function quarterRange(year: number, quarter: number) {
  const startMonth = (quarter - 1) * 3
  const startsOn = `${year}-${String(startMonth + 1).padStart(2, "0")}-01`
  const end = new Date(Date.UTC(year, startMonth + 3, 0))
  const endsOn = end.toISOString().slice(0, 10)
  const deadline = new Date(Date.UTC(year, startMonth + 4, 0))
  return { startsOn, endsOn, deadline: deadline.toISOString().slice(0, 10) }
}

taxReturnsRouter.get("/current", async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const now = new Date()
  const requestedYear = Number(c.req.query("year") ?? now.getUTCFullYear())
  const requestedQuarter = Number(c.req.query("quarter") ?? Math.floor(now.getUTCMonth() / 3) + 1)
  if (!Number.isInteger(requestedYear) || requestedYear < 2020 || requestedYear > 2100 || ![1, 2, 3, 4].includes(requestedQuarter)) return c.json({ error: "الفترة الضريبية غير صحيحة" }, 400)
  const { startsOn, endsOn, deadline } = quarterRange(requestedYear, requestedQuarter)
  const [organization, sales, purchases, counts, locks] = await Promise.all([
    sql`SELECT id,business_name,vat_number FROM organizations WHERE id=${orgId}`,
    sql`SELECT
        COALESCE(SUM(CASE WHEN type='invoice' THEN total WHEN type='debit_note' THEN total WHEN type='credit_note' THEN -total ELSE 0 END),0) total,
        COALESCE(SUM(CASE WHEN type='invoice' THEN total-tax_total ELSE 0 END),0) taxable,
        COALESCE(SUM(CASE WHEN type='debit_note' THEN total-tax_total WHEN type='credit_note' THEN -(total-tax_total) ELSE 0 END),0) adjustments,
        COALESCE(SUM(CASE WHEN type IN ('invoice','debit_note') THEN tax_total WHEN type='credit_note' THEN -tax_total ELSE 0 END),0) tax
        FROM documents WHERE organization_id=${orgId} AND type IN ('invoice','credit_note','debit_note') AND status IN ('issued','paid','partially_paid')
        AND deleted_at IS NULL AND issue_date BETWEEN ${startsOn} AND ${endsOn}`,
    sql`SELECT COALESCE(SUM(total),0) total,COALESCE(SUM(subtotal),0) taxable,COALESCE(SUM(tax_total),0) tax
        FROM purchase_invoices WHERE organization_id=${orgId} AND accounting_status='recorded' AND status='included' AND include_in_tax_return=TRUE
        AND deleted_at IS NULL AND invoice_date BETWEEN ${startsOn} AND ${endsOn}`,
    sql`SELECT
        (SELECT COUNT(*) FROM documents WHERE organization_id=${orgId} AND type='invoice' AND status IN ('issued','paid','partially_paid') AND deleted_at IS NULL AND issue_date BETWEEN ${startsOn} AND ${endsOn}) sales_count,
        (SELECT COUNT(*) FROM purchase_invoices WHERE organization_id=${orgId} AND accounting_status='recorded' AND status='included' AND include_in_tax_return=TRUE AND deleted_at IS NULL AND invoice_date BETWEEN ${startsOn} AND ${endsOn}) purchases_count,
        (SELECT COUNT(*) FROM documents WHERE organization_id=${orgId} AND type='credit_note' AND status IN ('issued','paid','partially_paid') AND deleted_at IS NULL AND issue_date BETWEEN ${startsOn} AND ${endsOn}) sales_returns`,
    sql`SELECT id FROM accounting_period_locks WHERE organization_id=${orgId} AND lock_type='tax_return' AND starts_on=${startsOn} AND ends_on=${endsOn} AND status='locked' LIMIT 1`,
  ])
  const organizationRow = organization[0] ?? { id: orgId, business_name: "", vat_number: "" }
  const salesRow = sales[0] ?? { total: 0, taxable: 0, adjustments: 0, tax: 0 }
  const purchasesRow = purchases[0] ?? { total: 0, taxable: 0, tax: 0 }
  const countsRow = counts[0] ?? { sales_count: 0, purchases_count: 0 }
  const outputTax = Number(salesRow.tax)
  const inputTax = Number(purchasesRow.tax)
  const deadlineDate = new Date(`${deadline}T23:59:59Z`)
  const daysRemaining = Math.max(0, Math.ceil((deadlineDate.getTime() - Date.now()) / 86_400_000))
  return c.json({
    period: { year: requestedYear, quarter: requestedQuarter, starts_on: startsOn, ends_on: endsOn, deadline, status: locks[0] ? "closed" : now <= deadlineDate ? "open" : "awaiting_review", days_remaining: daysRemaining, lock_id: locks[0]?.id ?? null },
    organization: organizationRow,
    sales: { total: Number(salesRow.total), taxable: Number(salesRow.taxable), tax: outputTax, adjustments: Number(salesRow.adjustments) },
    purchases: { total: Number(purchasesRow.total), taxable: Number(purchasesRow.taxable), tax: inputTax, adjustments: 0 },
    net_tax: outputTax - inputTax,
    counts: { sales: Number(countsRow.sales_count), purchases: Number(countsRow.purchases_count), sales_returns: Number(countsRow.sales_returns), purchase_returns: 0 },
    notice: "هذا تقرير مساعد لإعداد الإقرار الضريبي ولا يعني تقديم الإقرار إلى الهيئة.",
  })
})

const closeSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  quarter: z.number().int().min(1).max(4),
  reason: z.string().trim().min(5).max(500).default("اعتماد الإقرار الضريبي وقفل الفترة"),
})

taxReturnsRouter.post("/close", zValidator("json", closeSchema), async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const body = c.req.valid("json")
  const { startsOn, endsOn } = quarterRange(body.year, body.quarter)
  const result = await withTransaction(async (client) => {
    const existing = await client.query("SELECT id FROM accounting_period_locks WHERE organization_id=$1 AND lock_type='tax_return' AND starts_on=$2 AND ends_on=$3 AND status='locked' FOR UPDATE", [orgId, startsOn, endsOn])
    if (existing.rows[0]) return { error: "ALREADY_CLOSED" as const }
    const sales = await client.query(`SELECT
      COALESCE(SUM(CASE WHEN type IN ('invoice','debit_note') THEN total WHEN type='credit_note' THEN -total ELSE 0 END),0) total,
      COALESCE(SUM(CASE WHEN type='invoice' THEN total-tax_total ELSE 0 END),0) taxable,
      COALESCE(SUM(CASE WHEN type='debit_note' THEN total-tax_total WHEN type='credit_note' THEN -(total-tax_total) ELSE 0 END),0) adjustments,
      COALESCE(SUM(CASE WHEN type IN ('invoice','debit_note') THEN tax_total WHEN type='credit_note' THEN -tax_total ELSE 0 END),0) tax,
      COUNT(*) FILTER (WHERE type='invoice') invoice_count,COUNT(*) FILTER (WHERE type='credit_note') credit_note_count,COUNT(*) FILTER (WHERE type='debit_note') debit_note_count
      FROM documents WHERE organization_id=$1 AND type IN ('invoice','credit_note','debit_note')
      AND status IN ('issued','paid','partially_paid') AND deleted_at IS NULL AND issue_date BETWEEN $2 AND $3`, [orgId, startsOn, endsOn])
    const purchases = await client.query(`SELECT COALESCE(SUM(total),0) total,COALESCE(SUM(subtotal),0) taxable,COALESCE(SUM(tax_total),0) tax,COUNT(*) invoice_count FROM purchase_invoices
      WHERE organization_id=$1 AND accounting_status='recorded' AND status='included' AND include_in_tax_return=TRUE
      AND deleted_at IS NULL AND invoice_date BETWEEN $2 AND $3`, [orgId, startsOn, endsOn])
    const salesTax = Number(sales.rows[0].tax), purchaseTax = Number(purchases.rows[0].tax), netTax = salesTax - purchaseTax
    const snapshot = { year: body.year, quarter: body.quarter, starts_on: startsOn, ends_on: endsOn,
      sales: { total: Number(sales.rows[0].total), taxable: Number(sales.rows[0].taxable), adjustments: Number(sales.rows[0].adjustments), tax: salesTax, invoice_count: Number(sales.rows[0].invoice_count), credit_note_count: Number(sales.rows[0].credit_note_count), debit_note_count: Number(sales.rows[0].debit_note_count) },
      purchases: { total: Number(purchases.rows[0].total), taxable: Number(purchases.rows[0].taxable), tax: purchaseTax, invoice_count: Number(purchases.rows[0].invoice_count) }, net_tax: netTax }
    const period = await client.query(`INSERT INTO tax_periods(organization_id,starts_on,ends_on,status)
      VALUES($1,$2,$3,'closed') ON CONFLICT(organization_id,starts_on,ends_on) DO UPDATE SET status='closed' RETURNING id`, [orgId, startsOn, endsOn])
    const taxReturn = await client.query(`INSERT INTO tax_returns(organization_id,tax_period_id,sales_tax,purchase_tax,net_tax,snapshot,status,filed_at)
      VALUES($1,$2,$3,$4,$5,$6,'filed',NOW()) ON CONFLICT(tax_period_id) DO UPDATE SET
      sales_tax=EXCLUDED.sales_tax,purchase_tax=EXCLUDED.purchase_tax,net_tax=EXCLUDED.net_tax,snapshot=EXCLUDED.snapshot,status='filed',filed_at=NOW(),updated_at=NOW()
      RETURNING id`, [orgId, period.rows[0].id, salesTax, purchaseTax, netTax, JSON.stringify(snapshot)])
    const lock = await client.query(`INSERT INTO accounting_period_locks(organization_id,lock_type,starts_on,ends_on,source_entity_id,reason)
      VALUES($1,'tax_return',$2,$3,$4,$5) RETURNING *`, [orgId, startsOn, endsOn, taxReturn.rows[0].id, body.reason])
    await client.query("INSERT INTO financial_audit_events(organization_id,entity_type,entity_id,action,reason,snapshot) VALUES($1,'tax_return',$2,'closed',$3,$4)", [orgId, taxReturn.rows[0].id, body.reason, JSON.stringify({ ...snapshot, lock_id: lock.rows[0].id })])
    return { lock: lock.rows[0], tax_return: { id: taxReturn.rows[0].id, sales_tax: salesTax, purchase_tax: purchaseTax, net_tax: netTax } }
  })
  if ("error" in result) return c.json({ error: "الفترة الضريبية مقفلة مسبقًا" }, 409)
  return c.json(result, 201)
})
