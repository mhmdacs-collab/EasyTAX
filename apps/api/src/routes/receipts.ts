import { randomUUID } from "node:crypto"
import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { auth } from "../lib/auth"
import { sql, withTransaction } from "../lib/db"

export const receiptsRouter = new Hono()

async function organizationId(headers: Headers): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await (auth.api as any).getSession({ headers })
  if (!session?.user?.id) return null
  const rows = await sql`SELECT id FROM organizations WHERE user_id=${session.user.id as string} AND deleted_at IS NULL LIMIT 1`
  return (rows[0]?.id as string | undefined) ?? null
}

const optionalText = z.string().trim().optional().or(z.literal(""))
const receiptSchema = z.object({
  customer_id: optionalText,
  payer_name: z.string().trim().optional(),
  payer_phone: optionalText,
  payer_email: z.string().trim().email().optional().or(z.literal("")),
  payer_vat_number: z.string().trim().regex(/^3\d{13}3$/).optional().or(z.literal("")),
  amount: z.number().positive(),
  payment_method_name: z.string().trim().min(1),
  receipt_date: z.string().date(),
  reference_number: optionalText,
  notes: optionalText,
  show_stamp: z.boolean().default(false),
  show_signature: z.boolean().default(false),
}).superRefine((body, context) => {
  if (!body.customer_id && !body.payer_name?.trim()) context.addIssue({ code: "custom", path: ["payer_name"], message: "اسم المستلم منه مطلوب" })
})

receiptsRouter.get("/", async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const receipts = await sql`SELECT id,customer_id,number,receipt_date,amount,payment_method_name,payer_name,payer_phone,payer_email,payer_vat_number,reference_number,created_at FROM customer_receipts WHERE organization_id=${orgId} ORDER BY receipt_date DESC,created_at DESC`
  return c.json({ receipts })
})

receiptsRouter.get("/:id", async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const rows = await sql`SELECT cr.*,CASE WHEN cr.organization_snapshot='{}'::jsonb THEN to_jsonb(o) ELSE cr.organization_snapshot END AS organization_snapshot FROM customer_receipts cr JOIN organizations o ON o.id=cr.organization_id WHERE cr.id=${c.req.param("id")} AND cr.organization_id=${orgId} LIMIT 1`
  return rows[0] ? c.json({ receipt: rows[0] }) : c.json({ error: "سند القبض غير موجود" }, 404)
})

receiptsRouter.post("/", zValidator("json", receiptSchema), async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const body = c.req.valid("json")
  const result = await withTransaction(async (client) => {
    const organization = await client.query("SELECT * FROM organizations WHERE id=$1 AND deleted_at IS NULL", [orgId])
    if (!organization.rows[0]) return { error: "ORGANIZATION_NOT_FOUND" as const }
    const method = await client.query("SELECT name FROM payment_methods WHERE organization_id=$1 AND name=$2 AND is_active=TRUE LIMIT 1", [orgId, body.payment_method_name])
    if (!method.rows[0]) return { error: "PAYMENT_METHOD_NOT_FOUND" as const }

    let customer: Record<string, unknown> | undefined
    if (body.customer_id) {
      const customerResult = await client.query("SELECT * FROM customers WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL LIMIT 1", [body.customer_id, orgId])
      customer = customerResult.rows[0] as Record<string, unknown> | undefined
      if (!customer) return { error: "CUSTOMER_NOT_FOUND" as const }
    }

    await client.query("INSERT INTO document_sequences(organization_id,document_type,next_number) VALUES($1,'receipt',1) ON CONFLICT(organization_id,document_type) DO NOTHING", [orgId])
    const sequence = await client.query(`SELECT GREATEST(ds.next_number,COALESCE((SELECT MAX(number::bigint)+1 FROM customer_receipts WHERE organization_id=$1 AND number ~ '^\\d+$'),1)) AS candidate FROM document_sequences ds WHERE ds.organization_id=$1 AND ds.document_type='receipt' FOR UPDATE`, [orgId])
    const candidate = Number(sequence.rows[0].candidate)
    const number = String(candidate).padStart(5, "0")
    await client.query("UPDATE document_sequences SET next_number=$1 WHERE organization_id=$2 AND document_type='receipt'", [candidate + 1, orgId])

    const payerName = String(customer?.name ?? body.payer_name ?? "").trim()
    const payerPhone = String(customer?.phone ?? body.payer_phone ?? "").trim() || null
    const payerEmail = String(customer?.email ?? body.payer_email ?? "").trim() || null
    const payerVat = String(customer?.vat_number ?? body.payer_vat_number ?? "").trim() || null
    const receipt = await client.query(`INSERT INTO customer_receipts(id,organization_id,customer_id,number,receipt_date,amount,payment_method_name,payer_name,payer_phone,payer_email,payer_vat_number,reference_number,notes,organization_snapshot,show_stamp,show_signature)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`, [randomUUID(), orgId, body.customer_id || null, number, body.receipt_date, body.amount, body.payment_method_name, payerName, payerPhone, payerEmail, payerVat, body.reference_number || null, body.notes || null, JSON.stringify(organization.rows[0]), body.show_stamp, body.show_signature])
    return { receipt: receipt.rows[0] }
  })
  if ("receipt" in result) return c.json(result, 201)
  const messages = { CUSTOMER_NOT_FOUND: "العميل غير موجود", PAYMENT_METHOD_NOT_FOUND: "طريقة السداد غير متاحة", ORGANIZATION_NOT_FOUND: "المنشأة غير موجودة" } as const
  return c.json({ error: messages[result.error] }, 400)
})
