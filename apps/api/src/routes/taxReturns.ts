import { Hono } from "hono"
import { auth } from "../lib/auth"
import { sql } from "../lib/db"

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
  const [organization, sales, purchases, counts] = await Promise.all([
    sql`SELECT id,business_name,vat_number FROM organizations WHERE id=${orgId}`,
    sql`SELECT COALESCE(SUM(total),0) total,COALESCE(SUM(total-tax_total),0) taxable,COALESCE(SUM(tax_total),0) tax
        FROM documents WHERE organization_id=${orgId} AND type='invoice' AND status IN ('issued','paid','partially_paid')
        AND deleted_at IS NULL AND issue_date BETWEEN ${startsOn} AND ${endsOn}`,
    sql`SELECT COALESCE(SUM(total),0) total,COALESCE(SUM(subtotal),0) taxable,COALESCE(SUM(tax_total),0) tax
        FROM purchase_invoices WHERE organization_id=${orgId} AND status='included' AND include_in_tax_return=TRUE
        AND deleted_at IS NULL AND invoice_date BETWEEN ${startsOn} AND ${endsOn}`,
    sql`SELECT
        (SELECT COUNT(*) FROM documents WHERE organization_id=${orgId} AND type='invoice' AND status IN ('issued','paid','partially_paid') AND deleted_at IS NULL AND issue_date BETWEEN ${startsOn} AND ${endsOn}) sales_count,
        (SELECT COUNT(*) FROM purchase_invoices WHERE organization_id=${orgId} AND status='included' AND deleted_at IS NULL AND invoice_date BETWEEN ${startsOn} AND ${endsOn}) purchases_count`,
  ])
  const organizationRow = organization[0] ?? { id: orgId, business_name: "", vat_number: "" }
  const salesRow = sales[0] ?? { total: 0, taxable: 0, tax: 0 }
  const purchasesRow = purchases[0] ?? { total: 0, taxable: 0, tax: 0 }
  const countsRow = counts[0] ?? { sales_count: 0, purchases_count: 0 }
  const outputTax = Number(salesRow.tax)
  const inputTax = Number(purchasesRow.tax)
  const deadlineDate = new Date(`${deadline}T23:59:59Z`)
  const daysRemaining = Math.max(0, Math.ceil((deadlineDate.getTime() - Date.now()) / 86_400_000))
  return c.json({
    period: { year: requestedYear, quarter: requestedQuarter, starts_on: startsOn, ends_on: endsOn, deadline, status: now <= deadlineDate ? "open" : "awaiting_review", days_remaining: daysRemaining },
    organization: organizationRow,
    sales: { total: Number(salesRow.total), taxable: Number(salesRow.taxable), tax: outputTax, adjustments: 0 },
    purchases: { total: Number(purchasesRow.total), taxable: Number(purchasesRow.taxable), tax: inputTax, adjustments: 0 },
    net_tax: outputTax - inputTax,
    counts: { sales: Number(countsRow.sales_count), purchases: Number(countsRow.purchases_count), sales_returns: 0, purchase_returns: 0 },
    notice: "هذا تقرير مساعد لإعداد الإقرار الضريبي ولا يعني تقديم الإقرار إلى الهيئة.",
  })
})
