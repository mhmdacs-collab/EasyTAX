import { randomUUID } from "node:crypto"
import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { auth } from "../lib/auth"
import { sql, withTransaction } from "../lib/db"
import { applyExpensePayment } from "../lib/expensePayments"
import { activePeriodLock, lockedPeriodMessage } from "../lib/periodLocks"

export const expensesRouter = new Hono()

const categories = ["work_costs", "payroll", "rent_utilities", "vehicles_transport", "admin_marketing_professional", "asset_equipment", "other"] as const
const financialClasses = ["direct_cost", "operating_expense", "employee_expense", "fixed_asset", "prepayment", "other_expense"] as const
const paymentMethods = ["cash", "bank_transfer", "card", "sadad"] as const
const ibanPattern = /^SA\d{22}$/
const ibanSchema = z.preprocess(
  (value) => typeof value === "string" ? value.replace(/\s+/g, "").toUpperCase() : value,
  z.string().regex(ibanPattern, "رقم الآيبان السعودي يجب أن يبدأ بـ SA ويتكون من 24 خانة"),
)

async function organizationId(headers: Headers) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await (auth.api as any).getSession({ headers })
  if (!session?.user?.id) return null
  const rows = await sql`SELECT id FROM organizations WHERE user_id=${session.user.id as string} AND deleted_at IS NULL LIMIT 1`
  return (rows[0]?.id as string | undefined) ?? null
}

const expenseSchema = z.object({
  expense_date: z.iso.date(),
  category: z.enum(categories),
  financial_class: z.enum(financialClasses),
  description: z.string().trim().min(2).max(300),
  amount: z.coerce.number().positive().max(999999999999),
  payment_status: z.enum(["paid", "unpaid", "partially_paid"]),
  paid_amount: z.coerce.number().min(0),
  payment_method: z.enum(paymentMethods).optional(),
  supplier_name: z.string().trim().max(200).optional(),
  beneficiary_iban: z.union([ibanSchema, z.literal(""), z.undefined()]),
  reference_number: z.string().trim().max(100).optional(),
  project_reference: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
}).superRefine((value, ctx) => {
  if (value.paid_amount > value.amount) ctx.addIssue({ code: "custom", path: ["paid_amount"], message: "المبلغ المدفوع لا يمكن أن يتجاوز قيمة المصروف" })
  if (value.payment_status === "paid" && value.paid_amount !== value.amount) ctx.addIssue({ code: "custom", path: ["paid_amount"], message: "المصروف المدفوع يجب أن يكون مسددًا بالكامل" })
  if (value.payment_status === "unpaid" && value.paid_amount !== 0) ctx.addIssue({ code: "custom", path: ["paid_amount"], message: "المصروف غير المدفوع يجب أن تكون دفعاته صفرًا" })
  if (value.payment_status !== "unpaid" && !value.payment_method) ctx.addIssue({ code: "custom", path: ["payment_method"], message: "اختر طريقة الدفع" })
  if (value.payment_status !== "unpaid" && !value.supplier_name) ctx.addIssue({ code: "custom", path: ["supplier_name"], message: "اسم المستفيد مطلوب عند تسجيل دفعة" })
  if (value.payment_status === "partially_paid" && (value.paid_amount <= 0 || value.paid_amount >= value.amount)) ctx.addIssue({ code: "custom", path: ["paid_amount"], message: "أدخل دفعة أقل من إجمالي المصروف" })
  if (value.payment_method === "sadad" && !value.reference_number) ctx.addIssue({ code: "custom", path: ["reference_number"], message: "رقم سداد أو رقم الفاتورة مطلوب" })
})

expensesRouter.get("/", async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const year = Number(c.req.query("year") || new Date().getFullYear())
  const month = Number(c.req.query("month") || new Date().getMonth() + 1)
  if (!Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) return c.json({ error: "الفترة غير صحيحة" }, 400)
  const start = `${year}-${String(month).padStart(2, "0")}-01`
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
  const [expenses, summary] = await Promise.all([
    sql`SELECT * FROM expenses WHERE organization_id=${orgId} AND deleted_at IS NULL AND expense_date BETWEEN ${start} AND ${end} ORDER BY expense_date DESC, created_at DESC`,
    sql`SELECT COALESCE(SUM(amount),0) total, COALESCE(SUM(paid_amount),0) paid,
      COALESCE(SUM(amount-paid_amount),0) outstanding,
      COALESCE(SUM(amount) FILTER (WHERE financial_class='direct_cost'),0) direct_costs,
      COALESCE(SUM(amount) FILTER (WHERE financial_class IN ('operating_expense','employee_expense','other_expense')),0) operating_expenses,
      COALESCE(SUM(amount) FILTER (WHERE financial_class='fixed_asset'),0) asset_purchases
      FROM expenses WHERE organization_id=${orgId} AND deleted_at IS NULL AND expense_date BETWEEN ${start} AND ${end}`,
  ])
  return c.json({ expenses, summary: summary[0], period: { year, month, starts_on: start, ends_on: end } })
})

expensesRouter.post("/", zValidator("json", expenseSchema, (result, c) => {
  if (!result.success) return c.json({ error: result.error.issues[0]?.message ?? "راجع بيانات المصروف" }, 400)
  return undefined
}), async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const input = c.req.valid("json")
  const id = randomUUID()
  const expense = await withTransaction(async (client) => {
    const periodLock = await activePeriodLock(client, orgId, input.expense_date)
    if (periodLock) return { error: "PERIOD_LOCKED" as const, message: lockedPeriodMessage(periodLock) }
    const result = await client.query(`INSERT INTO expenses (
      id, organization_id, expense_date, category, financial_class, description, amount,
      payment_status, paid_amount, payment_method, supplier_name, beneficiary_iban, reference_number, project_reference, notes
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`, [
      id, orgId, input.expense_date, input.category, input.financial_class, input.description, input.amount,
      input.payment_status, input.paid_amount, input.payment_method ?? null, input.supplier_name || null,
      input.beneficiary_iban || null, input.reference_number || null, input.project_reference || null, input.notes || null,
    ])
    if (input.paid_amount > 0 && input.payment_method) await client.query(
      "INSERT INTO expense_payments(id,organization_id,expense_id,payment_date,amount,payment_method,beneficiary_name,beneficiary_iban,reference_number) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [randomUUID(), orgId, id, input.expense_date, input.paid_amount, input.payment_method, input.supplier_name || null, input.beneficiary_iban || null, input.reference_number || null],
    )
    return result.rows[0]
  })
  if ("error" in expense) return c.json({ error: expense.message }, 409)
  return c.json({ expense }, 201)
})

const paymentSchema = z.object({
  amount: z.coerce.number().positive(),
  payment_method: z.enum(paymentMethods),
  payment_date: z.iso.date(),
  reference_number: z.string().trim().max(100).optional(),
  beneficiary_name: z.string().trim().min(1).max(200),
  beneficiary_iban: z.union([ibanSchema, z.literal(""), z.undefined()]),
  notes: z.string().trim().max(500).optional(),
}).superRefine((value, ctx) => {
  if (value.payment_method === "sadad" && !value.reference_number) ctx.addIssue({ code: "custom", path: ["reference_number"], message: "رقم سداد أو رقم الفاتورة مطلوب" })
})

expensesRouter.post("/:id/payments", zValidator("json", paymentSchema, (result, c) => {
  if (!result.success) return c.json({ error: result.error.issues[0]?.message ?? "راجع بيانات السداد" }, 400)
  return undefined
}), async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const input = c.req.valid("json")
  const result = await withTransaction(async (client) => {
    const current = await client.query("SELECT * FROM expenses WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL FOR UPDATE", [c.req.param("id"), orgId])
    const expense = current.rows[0]
    if (!expense) return { error: "NOT_FOUND" as const }
    const periodLock = await activePeriodLock(client, orgId, input.payment_date)
    if (periodLock) return { error: "PERIOD_LOCKED" as const, message: lockedPeriodMessage(periodLock) }
    const payment = applyExpensePayment(Number(expense.amount), Number(expense.paid_amount), input.amount)
    if (!payment.ok) return { error: payment.reason, remaining: payment.remaining }
    await client.query("INSERT INTO expense_payments(id,organization_id,expense_id,payment_date,amount,payment_method,beneficiary_name,beneficiary_iban,reference_number,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [randomUUID(), orgId, expense.id, input.payment_date, input.amount, input.payment_method, input.beneficiary_name, input.beneficiary_iban || null, input.reference_number || null, input.notes || null])
    const updated = await client.query("UPDATE expenses SET paid_amount=$1,payment_status=$2,payment_method=$3,supplier_name=$4,beneficiary_iban=COALESCE($5,beneficiary_iban),updated_at=NOW() WHERE id=$6 RETURNING *", [payment.paid, payment.status, input.payment_method, input.beneficiary_name, input.beneficiary_iban || null, expense.id])
    return { expense: updated.rows[0] }
  })
  if ("error" in result) {
    if (result.error === "NOT_FOUND") return c.json({ error: "المصروف غير موجود" }, 404)
    if (result.error === "PERIOD_LOCKED") return c.json({ error: result.message }, 409)
    if (result.error === "ALREADY_PAID") return c.json({ error: "المصروف مدفوع بالكامل" }, 409)
    if (result.error === "INVALID_AMOUNT") return c.json({ error: `المبلغ يتجاوز المتبقي وهو ${result.remaining.toFixed(2)} ر.س` }, 400)
    return c.json({ error: "تعذر تسجيل الدفعة" }, 400)
  }
  return c.json(result)
})

expensesRouter.delete("/:id", async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const result = await withTransaction(async (client) => {
    const found = await client.query("SELECT * FROM expenses WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL AND source_type='manual' FOR UPDATE", [c.req.param("id"), orgId])
    const expense = found.rows[0]
    if (!expense) return { error: "NOT_FOUND" as const }
    const periodLock = await activePeriodLock(client, orgId, String(expense.expense_date).slice(0, 10))
    if (periodLock) return { error: "PERIOD_LOCKED" as const, message: lockedPeriodMessage(periodLock) }
    if (Number(expense.paid_amount) > 0) return { error: "HAS_PAYMENTS" as const }
    await client.query("UPDATE expenses SET deleted_at=NOW(),updated_at=NOW() WHERE id=$1", [expense.id])
    return { ok: true as const }
  })
  if ("ok" in result) return c.json(result)
  if (result.error === "PERIOD_LOCKED") return c.json({ error: result.message }, 409)
  return c.json({ error: result.error === "HAS_PAYMENTS" ? "لا يمكن حذف مصروف له دفعات مسجلة" : "المصروف غير موجود أو لا يمكن حذفه" }, result.error === "NOT_FOUND" ? 404 : 409)
})
