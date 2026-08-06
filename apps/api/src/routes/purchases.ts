import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { auth } from "../lib/auth"
import { sql, withTransaction } from "../lib/db"

export const purchasesRouter = new Hono()

function invoiceDateInRiyadh(timestamp: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(timestamp))
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

async function organizationId(headers: Headers): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await (auth.api as any).getSession({ headers })
  if (!session?.user?.id) return null
  const rows = await sql`SELECT id FROM organizations WHERE user_id=${session.user.id as string} AND deleted_at IS NULL LIMIT 1`
  return (rows[0]?.id as string | undefined) ?? null
}

const purchaseSchema = z.object({
  supplier_name: z.string().trim().min(1).max(300),
  supplier_vat_number: z.string().trim().regex(/^3\d{13}3$/),
  invoice_number: z.string().trim().min(1).max(120),
  invoice_timestamp: z.string().datetime(),
  total: z.number().positive(),
  tax_total: z.number().min(0),
  qr_payload: z.string().trim().min(1).max(4000),
  qr_fields: z.record(z.string(), z.string()).default({}),
  duplicate_override: z.boolean().default(false),
  responsibility_confirmed: z.literal(true),
  notes: z.string().trim().max(1000).optional(),
}).superRefine((body, context) => {
  if (body.tax_total > body.total) context.addIssue({ code: "custom", path: ["tax_total"], message: "مبلغ الضريبة لا يمكن أن يتجاوز إجمالي الفاتورة" })
})

purchasesRouter.get("/", async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const purchases = await sql`
    SELECT id,internal_number,supplier_name,supplier_vat_number,invoice_number,invoice_date,invoice_timestamp,
           subtotal,tax_total,total,status,exclusion_reason,cancelled_at,cancellation_reason,
           duplicate_override,duplicate_of_id,created_at
    FROM purchase_invoices
    WHERE organization_id=${orgId} AND deleted_at IS NULL
    ORDER BY invoice_date DESC,created_at DESC`
  return c.json({ purchases })
})

purchasesRouter.get("/:id", async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const rows = await sql`SELECT * FROM purchase_invoices WHERE id=${c.req.param("id")} AND organization_id=${orgId} AND deleted_at IS NULL LIMIT 1`
  return rows[0] ? c.json({ purchase: rows[0] }) : c.json({ error: "فاتورة المشتريات غير موجودة" }, 404)
})

purchasesRouter.post("/", zValidator("json", purchaseSchema), async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const body = c.req.valid("json")
  const invoiceDate = invoiceDateInRiyadh(body.invoice_timestamp)
  const duplicates = await sql`
    SELECT id,internal_number,supplier_name,invoice_number,invoice_date,total
    FROM purchase_invoices
    WHERE organization_id=${orgId} AND deleted_at IS NULL AND status<>'cancelled'
      AND supplier_vat_number=${body.supplier_vat_number}
      AND (invoice_number=${body.invoice_number} OR qr_payload=${body.qr_payload})
    ORDER BY created_at DESC LIMIT 1`
  const duplicate = duplicates[0] as Record<string, unknown> | undefined
  if (duplicate && !body.duplicate_override) return c.json({ error: "DUPLICATE_WARNING", duplicate }, 409)

  const purchase = await withTransaction(async (client) => {
    await client.query("INSERT INTO purchase_invoice_sequences(organization_id,next_number) VALUES($1,1) ON CONFLICT(organization_id) DO NOTHING", [orgId])
    const sequence = await client.query("SELECT next_number FROM purchase_invoice_sequences WHERE organization_id=$1 FOR UPDATE", [orgId])
    const nextNumber = Number(sequence.rows[0].next_number)
    const internalNumber = `PQR-${String(nextNumber).padStart(5, "0")}`
    await client.query("UPDATE purchase_invoice_sequences SET next_number=$1 WHERE organization_id=$2", [nextNumber + 1, orgId])
    const subtotal = Math.max(0, body.total - body.tax_total)
    const result = await client.query(`
      INSERT INTO purchase_invoices(
        organization_id,internal_number,supplier_name,supplier_vat_number,invoice_number,invoice_date,invoice_timestamp,
        subtotal,tax_total,total,include_in_tax_return,qr_payload,qr_extraction_status,qr_fields,source,status,
        duplicate_override,duplicate_of_id
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE,$11,'extracted',$12,'qr','included',$13,$14)
      RETURNING *`, [orgId, internalNumber, body.supplier_name, body.supplier_vat_number, body.invoice_number, invoiceDate,
      body.invoice_timestamp, subtotal, body.tax_total, body.total, body.qr_payload, JSON.stringify(body.qr_fields),
      body.duplicate_override, duplicate?.id ?? null])
    await client.query("INSERT INTO financial_audit_events(organization_id,entity_type,entity_id,action,snapshot) VALUES($1,'purchase_invoice',$2,'created',$3)", [orgId, result.rows[0].id, JSON.stringify(result.rows[0])])
    return result.rows[0]
  })
  return c.json({ purchase }, 201)
})

const statusSchema = z.object({
  status: z.enum(["included", "excluded", "cancelled"]),
  reason: z.string().trim().max(500).optional(),
}).superRefine((body, context) => {
  if (body.status !== "included" && !body.reason?.trim()) context.addIssue({ code: "custom", path: ["reason"], message: "سبب الاستبعاد أو الإلغاء مطلوب" })
})

purchasesRouter.patch("/:id/status", zValidator("json", statusSchema), async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const body = c.req.valid("json")
  const result = await withTransaction(async (client) => {
    const current = await client.query("SELECT * FROM purchase_invoices WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL FOR UPDATE", [c.req.param("id"), orgId])
    if (!current.rows[0]) return null
    if (current.rows[0].status === "cancelled") return { error: "CANCELLED_LOCKED" as const }
    const updated = await client.query(`UPDATE purchase_invoices SET status=$1,include_in_tax_return=$2,
      exclusion_reason=$3,cancelled_at=CASE WHEN $1='cancelled' THEN NOW() ELSE NULL END,
      cancellation_reason=CASE WHEN $1='cancelled' THEN $3 ELSE NULL END,updated_at=NOW()
      WHERE id=$4 RETURNING *`, [body.status, body.status === "included", body.status === "included" ? null : body.reason, c.req.param("id")])
    await client.query("INSERT INTO financial_audit_events(organization_id,entity_type,entity_id,action,reason,snapshot) VALUES($1,'purchase_invoice',$2,$3,$4,$5)", [orgId, c.req.param("id"), body.status === "cancelled" ? "cancelled" : body.status, body.reason ?? null, JSON.stringify(updated.rows[0])])
    return updated.rows[0]
  })
  if (!result) return c.json({ error: "فاتورة المشتريات غير موجودة" }, 404)
  if ("error" in result) return c.json({ error: "الفاتورة الملغاة مغلقة ولا يمكن إعادتها إلى الإقرار" }, 409)
  return c.json({ purchase: result })
})
