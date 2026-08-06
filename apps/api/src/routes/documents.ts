import { randomUUID } from "node:crypto"
import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { auth } from "../lib/auth"
import { sql, withTransaction } from "../lib/db"

export const documentsRouter = new Hono()

async function getOrganizationId(headers: Headers): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await (auth.api as any).getSession({ headers })
  if (!session?.user?.id) return null
  const rows = await sql`SELECT id FROM organizations WHERE user_id=${session.user.id as string} AND deleted_at IS NULL LIMIT 1`
  return (rows[0]?.id as string | undefined) ?? null
}

const itemSchema = z.object({
  description: z.string().trim().min(1), unit: z.string().optional(),
  quantity: z.number().positive(), unit_price: z.number().nonnegative(),
  discount_percent: z.number().min(0).max(100).default(0), retention_percent: z.number().min(0).max(100).default(0),
})
const draftSchema = z.object({
  customer_id: z.string().min(1), issue_date: z.string().date(), due_date: z.string().date().optional().or(z.literal("")),
  prices_include_tax: z.boolean(), retention_basis: z.enum(["before_tax", "including_tax"]).optional(),
  discount_amount: z.number().nonnegative().default(0), notes: z.string().optional(),
  show_bank_details: z.boolean().default(false), show_stamp: z.boolean().default(false), show_signature: z.boolean().default(false),
  reference_data: z.object({ purchase_order: z.string().optional(), reference_number: z.string().optional(), payment_method: z.string().optional() }).default({}),
  payments: z.array(z.object({ payment_method_name: z.string().trim().min(1), amount: z.number().positive() })).default([]),
  items: z.array(itemSchema).min(1),
})

function calculate(body: z.infer<typeof draftSchema>) {
  const round = (value: number) => Math.round(value * 100) / 100
  const lines = body.items.map((item, index) => {
    const gross = item.quantity * item.unit_price
    const discount = gross * item.discount_percent / 100
    const afterDiscount = gross - discount
    const beforeTax = body.prices_include_tax ? afterDiscount / 1.15 : afterDiscount
    const tax = beforeTax * 0.15
    const retentionBase = body.retention_basis === "including_tax" ? beforeTax + tax : beforeTax
    const retention = retentionBase * item.retention_percent / 100
    return { ...item, sort_order: index, discount: round(discount), line_subtotal: round(beforeTax), line_tax: round(tax), line_retention: round(retention), line_total: round(beforeTax + tax - retention) }
  })
  const subtotal = round(lines.reduce((sum, line) => sum + line.line_subtotal, 0))
  const rawTaxTotal = lines.reduce((sum, line) => sum + line.line_tax, 0)
  const discountRatio = subtotal > 0 ? Math.max(0, subtotal - body.discount_amount) / subtotal : 1
  const taxTotal = round(rawTaxTotal * discountRatio)
  const retentionTotal = round(lines.reduce((sum, line) => sum + line.line_retention, 0))
  const total = round(Math.max(0, subtotal - body.discount_amount + taxTotal - retentionTotal))
  return { lines, subtotal, taxTotal, retentionTotal, total }
}

documentsRouter.get("/", async (c) => {
  const organizationId = await getOrganizationId(c.req.raw.headers)
  if (!organizationId) return c.json({ error: "غير مصرح" }, 401)
  const rows = await sql`SELECT id,type,number,issue_date,due_date,status,subtotal,tax_total,retention_total,total,customer_snapshot,created_at,updated_at FROM documents WHERE organization_id=${organizationId} AND deleted_at IS NULL ORDER BY created_at DESC`
  return c.json({ documents: rows })
})

documentsRouter.get("/:id", async (c) => {
  const organizationId = await getOrganizationId(c.req.raw.headers)
  if (!organizationId) return c.json({ error: "غير مصرح" }, 401)
  const rows = await sql`SELECT d.*, COALESCE(json_agg(di ORDER BY di.sort_order) FILTER (WHERE di.id IS NOT NULL),'[]'::json) AS items, COALESCE((SELECT json_agg(dp ORDER BY dp.created_at) FROM document_payments dp WHERE dp.document_id=d.id),'[]'::json) AS payments FROM documents d LEFT JOIN document_items di ON di.document_id=d.id WHERE d.id=${c.req.param("id")} AND d.organization_id=${organizationId} AND d.deleted_at IS NULL GROUP BY d.id`
  return rows[0] ? c.json({ document: rows[0] }) : c.json({ error: "المستند غير موجود" }, 404)
})

async function saveDraft(organizationId: string, id: string, body: z.infer<typeof draftSchema>, update: boolean) {
  const totals = calculate(body)
  const collectedTotal = Math.round(body.payments.reduce((sum, payment) => sum + payment.amount, 0) * 100) / 100
  if (collectedTotal > totals.total) return { error: "PAYMENTS_EXCEED_TOTAL" as const }
  const dueTotal = Math.round((totals.total - collectedTotal) * 100) / 100
  return withTransaction(async (client) => {
    const customer = await client.query("SELECT * FROM customers WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL", [body.customer_id, organizationId])
    if (!customer.rows[0]) return { error: "CUSTOMER_NOT_FOUND" as const }
    if (update) {
      const changed = await client.query(`UPDATE documents SET customer_id=$1,issue_date=$2,due_date=$3,prices_include_tax=$4,retention_basis=$5,subtotal=$6,discount_total=$7,tax_total=$8,retention_total=$9,total=$10,collected_total=$11,due_total=$12,show_bank_details=$13,show_stamp=$14,show_signature=$15,notes=$16,reference_data=$17,customer_snapshot=$18,updated_at=NOW(),sync_version=sync_version+1 WHERE id=$19 AND organization_id=$20 AND status='draft' AND deleted_at IS NULL RETURNING id`, [body.customer_id,body.issue_date,body.due_date||null,body.prices_include_tax,body.retention_basis||null,totals.subtotal,body.discount_amount,totals.taxTotal,totals.retentionTotal,totals.total,collectedTotal,dueTotal,body.show_bank_details,body.show_stamp,body.show_signature,body.notes||null,JSON.stringify(body.reference_data),JSON.stringify(customer.rows[0]),id,organizationId])
      if (!changed.rows[0]) return { error: "DRAFT_NOT_EDITABLE" as const }
      await client.query("DELETE FROM document_items WHERE document_id=$1", [id])
      await client.query("DELETE FROM document_payments WHERE document_id=$1", [id])
    } else {
      await client.query(`INSERT INTO documents(id,organization_id,customer_id,type,number,issue_date,due_date,status,prices_include_tax,retention_basis,subtotal,discount_total,tax_total,retention_total,total,collected_total,due_total,show_bank_details,show_stamp,show_signature,notes,reference_data,customer_snapshot) VALUES($1,$2,$3,'invoice',$4,$5,$6,'draft',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`, [id,organizationId,body.customer_id,`DRAFT-${id}`,body.issue_date,body.due_date||null,body.prices_include_tax,body.retention_basis||null,totals.subtotal,body.discount_amount,totals.taxTotal,totals.retentionTotal,totals.total,collectedTotal,dueTotal,body.show_bank_details,body.show_stamp,body.show_signature,body.notes||null,JSON.stringify(body.reference_data),JSON.stringify(customer.rows[0])])
    }
    for (const line of totals.lines) await client.query(`INSERT INTO document_items(document_id,description,unit,quantity,unit_price,discount,tax_rate,retention_rate,line_subtotal,line_tax,line_retention,line_total,sort_order) VALUES($1,$2,$3,$4,$5,$6,15,$7,$8,$9,$10,$11,$12)`, [id,line.description,line.unit||null,line.quantity,line.unit_price,line.discount,line.retention_percent,line.line_subtotal,line.line_tax,line.line_retention,line.line_total,line.sort_order])
    for (const payment of body.payments) await client.query(`INSERT INTO document_payments(document_id,payment_method_id,payment_method_name,amount,is_collected,paid_at) VALUES($1,(SELECT id FROM payment_methods WHERE organization_id=$2 AND name=$3 AND is_active=TRUE LIMIT 1),$3,$4,TRUE,NOW())`, [id,organizationId,payment.payment_method_name,payment.amount])
    return { id }
  })
}

documentsRouter.post("/", zValidator("json", draftSchema), async (c) => {
  const organizationId = await getOrganizationId(c.req.raw.headers)
  if (!organizationId) return c.json({ error: "غير مصرح" }, 401)
  const result = await saveDraft(organizationId, randomUUID(), c.req.valid("json"), false)
  return "error" in result ? c.json({ error: "العميل غير موجود" }, 400) : c.json({ document_id: result.id }, 201)
})

documentsRouter.put("/:id", zValidator("json", draftSchema), async (c) => {
  const organizationId = await getOrganizationId(c.req.raw.headers)
  if (!organizationId) return c.json({ error: "غير مصرح" }, 401)
  const result = await saveDraft(organizationId, c.req.param("id"), c.req.valid("json"), true)
  return "error" in result ? c.json({ error: result.error === "CUSTOMER_NOT_FOUND" ? "العميل غير موجود" : "يمكن تعديل المسودات فقط" }, 400) : c.json({ document_id: result.id })
})

documentsRouter.post("/:id/issue", async (c) => {
  const organizationId = await getOrganizationId(c.req.raw.headers)
  if (!organizationId) return c.json({ error: "غير مصرح" }, 401)
  const result = await withTransaction(async (client) => {
    const draft = await client.query("SELECT id FROM documents WHERE id=$1 AND organization_id=$2 AND status='draft' AND deleted_at IS NULL FOR UPDATE", [c.req.param("id"), organizationId])
    if (!draft.rows[0]) return null
    const organization = await client.query("SELECT * FROM organizations WHERE id=$1", [organizationId])
    const seller = organization.rows[0] as Record<string, unknown> | undefined
    const requiredSellerFields = ["business_name", "vat_number", "commercial_registration", "street", "building_number", "district", "city", "postal_code"]
    if (!seller || requiredSellerFields.some((field) => !String(seller[field] ?? "").trim())) {
      return { error: "SELLER_PROFILE_INCOMPLETE" as const }
    }
    await client.query(`INSERT INTO document_sequences(organization_id,document_type,next_number) VALUES($1,'invoice',1) ON CONFLICT(organization_id,document_type) DO NOTHING`, [organizationId])
    const sequence = await client.query(`SELECT GREATEST(ds.next_number,COALESCE((SELECT MAX(number::bigint)+1 FROM documents WHERE organization_id=$1 AND type='invoice' AND number ~ '^\\d+$'),1)) AS candidate FROM document_sequences ds WHERE ds.organization_id=$1 AND ds.document_type='invoice' FOR UPDATE`, [organizationId])
    const candidate = Number(sequence.rows[0].candidate)
    const number = String(candidate).padStart(5,"0")
    await client.query("UPDATE document_sequences SET next_number=$1 WHERE organization_id=$2 AND document_type='invoice'", [candidate+1,organizationId])
    const issued = await client.query(`UPDATE documents SET number=$1,status='issued',uuid=$2,issue_time=LOCALTIME,organization_snapshot=$3,updated_at=NOW(),sync_version=sync_version+1 WHERE id=$4 RETURNING id,number`, [number,randomUUID(),JSON.stringify(organization.rows[0]),c.req.param("id")])
    return issued.rows[0] as { id:string; number:string }
  })
  if (!result) return c.json({ error: "المسودة غير موجودة أو صادرة مسبقًا" }, 409)
  if ("error" in result) return c.json({ error: "أكمل السجل التجاري والعنوان الوطني للمنشأة قبل إصدار الفاتورة" }, 422)
  return c.json({ document: result })
})
