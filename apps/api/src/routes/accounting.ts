import { randomUUID } from "node:crypto"
import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { auth } from "../lib/auth"
import { sql, withTransaction } from "../lib/db"
import { activePeriodLock, lockedPeriodMessage } from "../lib/periodLocks"

export const accountingRouter = new Hono()

async function organizationId(headers: Headers): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await (auth.api as any).getSession({ headers })
  if (!session?.user?.id) return null
  const rows = await sql`SELECT id FROM organizations WHERE user_id=${session.user.id as string} AND deleted_at IS NULL LIMIT 1`
  return (rows[0]?.id as string | undefined) ?? null
}

accountingRouter.get("/period-locks", async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const locks = await sql`SELECT * FROM accounting_period_locks WHERE organization_id=${orgId} ORDER BY starts_on DESC,created_at DESC`
  return c.json({ locks })
})

const unlockSchema = z.object({ reason: z.string().trim().min(5).max(500) })
accountingRouter.post("/period-locks/:id/unlock", zValidator("json", unlockSchema), async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const reason = c.req.valid("json").reason
  const result = await withTransaction(async (client) => {
    const locked = await client.query("SELECT * FROM accounting_period_locks WHERE id=$1 AND organization_id=$2 FOR UPDATE", [c.req.param("id"), orgId])
    const row = locked.rows[0]
    if (!row) return { error: "NOT_FOUND" as const }
    if (row.status !== "locked") return { error: "ALREADY_UNLOCKED" as const }
    const updated = await client.query("UPDATE accounting_period_locks SET status='unlocked',unlocked_at=NOW(),unlock_reason=$1,updated_at=NOW() WHERE id=$2 RETURNING *", [reason, row.id])
    if (row.lock_type === "financial_year" && row.source_entity_id) {
      await client.query("UPDATE financial_statement_periods SET status='generated',updated_at=NOW() WHERE id=$1 AND organization_id=$2", [row.source_entity_id, orgId])
    }
    if (row.lock_type === "tax_return" && row.source_entity_id) {
      await client.query("UPDATE tax_returns SET status='draft',updated_at=NOW() WHERE id=$1 AND organization_id=$2", [row.source_entity_id, orgId])
      await client.query("UPDATE tax_periods SET status='open' WHERE id=(SELECT tax_period_id FROM tax_returns WHERE id=$1 AND organization_id=$2)", [row.source_entity_id, orgId])
    }
    await client.query("INSERT INTO financial_audit_events(organization_id,entity_type,entity_id,action,reason,snapshot) VALUES($1,'period_lock',$2,'unlocked',$3,$4)", [orgId, row.id, reason, JSON.stringify(updated.rows[0])])
    return { lock: updated.rows[0] }
  })
  if ("error" in result) return c.json({ error: result.error === "NOT_FOUND" ? "فترة الإقفال غير موجودة" : "الفترة مفتوحة مسبقًا" }, result.error === "NOT_FOUND" ? 404 : 409)
  return c.json(result)
})

const movementTypes = ["opening_cash", "capital_contribution", "owner_withdrawal", "loan_received", "loan_repayment"] as const
const movementSchema = z.object({
  movement_date: z.iso.date(),
  movement_type: z.enum(movementTypes),
  amount: z.coerce.number().positive().max(999999999999),
  loan_term: z.enum(["current", "non_current"]).optional(),
  reference_number: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
}).superRefine((value, context) => {
  const isLoan = value.movement_type === "loan_received" || value.movement_type === "loan_repayment"
  if (isLoan && !value.loan_term) context.addIssue({ code: "custom", path: ["loan_term"], message: "حدد ما إذا كان القرض قصير أو طويل الأجل" })
  if (!isLoan && value.loan_term) context.addIssue({ code: "custom", path: ["loan_term"], message: "مدة القرض متاحة لحركات القروض فقط" })
})

accountingRouter.get("/movements", async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const year = Number(c.req.query("year") || new Date().getFullYear())
  if (!Number.isInteger(year) || year < 2020 || year > 2100) return c.json({ error: "السنة غير صحيحة" }, 400)
  const startsOn = `${year}-01-01`, endsOn = `${year}-12-31`
  const [movements, summary] = await Promise.all([
    sql`SELECT * FROM financial_movements WHERE organization_id=${orgId} AND movement_date BETWEEN ${startsOn} AND ${endsOn} ORDER BY movement_date DESC,created_at DESC`,
    sql`SELECT
      COALESCE(SUM(amount) FILTER (WHERE status='recorded' AND movement_type='opening_cash'),0) opening_cash,
      COALESCE(SUM(amount) FILTER (WHERE status='recorded' AND movement_type='capital_contribution'),0) capital_contributions,
      COALESCE(SUM(amount) FILTER (WHERE status='recorded' AND movement_type='owner_withdrawal'),0) owner_withdrawals,
      COALESCE(SUM(amount) FILTER (WHERE status='recorded' AND movement_type='loan_received'),0) loans_received,
      COALESCE(SUM(amount) FILTER (WHERE status='recorded' AND movement_type='loan_repayment'),0) loans_repaid
      FROM financial_movements WHERE organization_id=${orgId} AND movement_date BETWEEN ${startsOn} AND ${endsOn}`,
  ])
  return c.json({ movements, summary: summary[0], period: { year, starts_on: startsOn, ends_on: endsOn } })
})

accountingRouter.post("/movements", zValidator("json", movementSchema, (result, c) => {
  if (!result.success) return c.json({ error: result.error.issues[0]?.message ?? "راجع بيانات الحركة" }, 400)
  return undefined
}), async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const body = c.req.valid("json")
  const result = await withTransaction(async (client) => {
    const lock = await activePeriodLock(client, orgId, body.movement_date)
    if (lock) return { error: "PERIOD_LOCKED" as const, message: lockedPeriodMessage(lock) }
    if (body.movement_type === "opening_cash") {
      const opening = await client.query("SELECT id FROM financial_movements WHERE organization_id=$1 AND movement_type='opening_cash' AND status='recorded' LIMIT 1", [orgId])
      if (opening.rows[0]) return { error: "OPENING_EXISTS" as const }
    }
    if (body.movement_type === "loan_repayment") {
      const balance = await client.query(`SELECT
        COALESCE(SUM(CASE WHEN movement_type='loan_received' THEN amount WHEN movement_type='loan_repayment' THEN -amount ELSE 0 END),0) balance
        FROM financial_movements WHERE organization_id=$1 AND status='recorded' AND loan_term=$2 AND movement_date<=$3`, [orgId, body.loan_term, body.movement_date])
      if (Number(balance.rows[0].balance) < body.amount) return { error: "LOAN_OVERPAYMENT" as const }
    }
    const inserted = await client.query(`INSERT INTO financial_movements(
      id,organization_id,movement_date,movement_type,amount,loan_term,reference_number,notes
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [
      randomUUID(), orgId, body.movement_date, body.movement_type, body.amount, body.loan_term || null,
      body.reference_number || null, body.notes || null,
    ])
    await client.query("INSERT INTO financial_audit_events(organization_id,entity_type,entity_id,action,snapshot) VALUES($1,'financial_movement',$2,'created',$3)", [orgId, inserted.rows[0].id, JSON.stringify(inserted.rows[0])])
    return { movement: inserted.rows[0] }
  })
  if ("error" in result) return c.json({ error: result.error === "PERIOD_LOCKED" ? result.message : result.error === "OPENING_EXISTS" ? "يوجد رصيد نقدي افتتاحي مسجل. اعكس الحركة السابقة قبل استبداله." : "مبلغ سداد القرض يتجاوز رصيده المسجل" }, 409)
  return c.json(result, 201)
})

accountingRouter.post("/movements/:id/reverse", zValidator("json", unlockSchema), async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const reason = c.req.valid("json").reason
  const result = await withTransaction(async (client) => {
    const found = await client.query("SELECT * FROM financial_movements WHERE id=$1 AND organization_id=$2 FOR UPDATE", [c.req.param("id"), orgId])
    const movement = found.rows[0]
    if (!movement) return { error: "NOT_FOUND" as const }
    if (movement.status === "reversed") return { error: "ALREADY_REVERSED" as const }
    const lock = await activePeriodLock(client, orgId, String(movement.movement_date).slice(0, 10))
    if (lock) return { error: "PERIOD_LOCKED" as const, message: lockedPeriodMessage(lock) }
    if (movement.movement_type === "loan_received") {
      const balance = await client.query(`SELECT COALESCE(SUM(CASE WHEN movement_type='loan_received' THEN amount WHEN movement_type='loan_repayment' THEN -amount ELSE 0 END),0) balance
        FROM financial_movements WHERE organization_id=$1 AND status='recorded' AND loan_term=$2`, [orgId, movement.loan_term])
      if (Number(balance.rows[0].balance) - Number(movement.amount) < -0.005) return { error: "ACTIVE_REPAYMENTS" as const }
    }
    const updated = await client.query("UPDATE financial_movements SET status='reversed',reversed_at=NOW(),reversal_reason=$1,updated_at=NOW() WHERE id=$2 RETURNING *", [reason, movement.id])
    await client.query("INSERT INTO financial_audit_events(organization_id,entity_type,entity_id,action,reason,snapshot) VALUES($1,'financial_movement',$2,'reversed',$3,$4)", [orgId, movement.id, reason, JSON.stringify(updated.rows[0])])
    return { movement: updated.rows[0] }
  })
  if ("error" in result) return c.json({ error: result.error === "PERIOD_LOCKED" ? result.message : result.error === "NOT_FOUND" ? "الحركة غير موجودة" : result.error === "ACTIVE_REPAYMENTS" ? "اعكس دفعات سداد القرض المرتبطة أولًا قبل عكس استلام القرض" : "الحركة معكوسة مسبقًا" }, result.error === "NOT_FOUND" ? 404 : 409)
  return c.json(result)
})

accountingRouter.get("/suppliers", async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const suppliers = await sql`
    SELECT pi.supplier_vat_number,MAX(pi.supplier_name) supplier_name,COUNT(*) invoice_count,
      COALESCE(SUM(pi.total),0) invoice_total,COALESCE(SUM(pi.paid_amount),0) paid_total,
      COALESCE(SUM(pi.total-pi.paid_amount),0) outstanding
    FROM purchase_invoices pi
    WHERE pi.organization_id=${orgId} AND pi.accounting_status='recorded' AND pi.deleted_at IS NULL
    GROUP BY pi.supplier_vat_number
    ORDER BY MAX(pi.supplier_name)`
  return c.json({ suppliers })
})

accountingRouter.get("/suppliers/:vat/account", async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const vat = c.req.param("vat")
  const invoices = await sql`SELECT id,internal_number,invoice_number,invoice_date,supplier_name,total,paid_amount,payment_status
    FROM purchase_invoices WHERE organization_id=${orgId} AND supplier_vat_number=${vat} AND accounting_status='recorded' AND deleted_at IS NULL
    ORDER BY invoice_date,created_at`
  if (!invoices[0]) return c.json({ error: "المورد غير موجود" }, 404)
  const payments = await sql`SELECT pip.id,pip.purchase_invoice_id,pip.payment_date,pip.amount,pip.payment_method,pip.reference_number,pip.status,pi.internal_number
    FROM purchase_invoice_payments pip JOIN purchase_invoices pi ON pi.id=pip.purchase_invoice_id
    WHERE pip.organization_id=${orgId} AND pi.supplier_vat_number=${vat}
    ORDER BY pip.payment_date,pip.created_at`
  const activePayments = payments.filter((payment) => payment.status === "issued")
  const invoiceTotal = invoices.reduce((sum, invoice) => sum + Number(invoice.total), 0)
  const paidTotal = activePayments.reduce((sum, payment) => sum + Number(payment.amount), 0)
  return c.json({
    supplier: { name: String(invoices[0].supplier_name), vat_number: vat },
    summary: { invoice_total: invoiceTotal, paid_total: paidTotal, outstanding: invoiceTotal - paidTotal },
    invoices,
    payments,
  })
})
