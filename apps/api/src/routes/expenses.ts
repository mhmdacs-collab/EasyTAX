import { randomUUID } from "node:crypto"
import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { auth } from "../lib/auth"
import { sql } from "../lib/db"

export const expensesRouter = new Hono()

const categories = ["work_costs", "payroll", "rent_utilities", "vehicles_transport", "admin_marketing_professional", "asset_equipment", "other"] as const
const financialClasses = ["direct_cost", "operating_expense", "employee_expense", "fixed_asset", "prepayment", "other_expense"] as const

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
  payment_method: z.string().trim().max(100).optional(),
  supplier_name: z.string().trim().max(200).optional(),
  reference_number: z.string().trim().max(100).optional(),
  project_reference: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
}).superRefine((value, ctx) => {
  if (value.paid_amount > value.amount) ctx.addIssue({ code: "custom", path: ["paid_amount"], message: "المبلغ المدفوع لا يمكن أن يتجاوز قيمة المصروف" })
  if (value.payment_status === "paid" && value.paid_amount !== value.amount) ctx.addIssue({ code: "custom", path: ["paid_amount"], message: "المصروف المدفوع يجب أن يكون مسددًا بالكامل" })
  if (value.payment_status === "unpaid" && value.paid_amount !== 0) ctx.addIssue({ code: "custom", path: ["paid_amount"], message: "المصروف غير المدفوع يجب أن تكون دفعاته صفرًا" })
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

expensesRouter.post("/", zValidator("json", expenseSchema), async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const input = c.req.valid("json")
  const id = randomUUID()
  const rows = await sql`INSERT INTO expenses (
    id, organization_id, expense_date, category, financial_class, description, amount,
    payment_status, paid_amount, payment_method, supplier_name, reference_number, project_reference, notes
  ) VALUES (
    ${id}, ${orgId}, ${input.expense_date}, ${input.category}, ${input.financial_class}, ${input.description}, ${input.amount},
    ${input.payment_status}, ${input.paid_amount}, ${input.payment_method || null}, ${input.supplier_name || null},
    ${input.reference_number || null}, ${input.project_reference || null}, ${input.notes || null}
  ) RETURNING *`
  return c.json({ expense: rows[0] }, 201)
})

expensesRouter.delete("/:id", async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const rows = await sql`UPDATE expenses SET deleted_at=NOW(), updated_at=NOW() WHERE id=${c.req.param("id")} AND organization_id=${orgId} AND deleted_at IS NULL AND source_type='manual' RETURNING id`
  return rows[0] ? c.json({ ok: true }) : c.json({ error: "المصروف غير موجود أو لا يمكن حذفه" }, 404)
})
