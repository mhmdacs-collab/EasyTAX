import { Hono } from "hono"
import { randomUUID } from "node:crypto"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { auth } from "../lib/auth"
import { sql, withTransaction } from "../lib/db"

export const customersRouter = new Hono()
async function organizationId(headers: Headers): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await (auth.api as any).getSession({ headers })
  if (!session?.user?.id) return null
  const rows = await sql`SELECT id FROM organizations WHERE user_id=${session.user.id as string} AND deleted_at IS NULL LIMIT 1`
  return (rows[0]?.id as string | undefined) ?? null
}
const vat = z.string().regex(/^3\d{13}3$/, "الرقم الضريبي يجب أن يكون 15 رقماً ويبدأ وينتهي بالرقم 3")
const customerSchema = z.object({
  name: z.string().trim().min(2), vat_number: vat, commercial_registration: z.string().optional(),
  phone: z.string().optional(), email: z.string().email().optional().or(z.literal("")), notes: z.string().optional(),
  city: z.string().trim().min(1), district: z.string().trim().min(1), street: z.string().trim().min(1),
  building_number: z.string().regex(/^\d{4}$/), postal_code: z.string().regex(/^\d{5}$/),
  additional_number: z.string().regex(/^\d{4}$/).optional().or(z.literal("")), short_address: z.string().optional(),
})
const receiptSchema = z.object({
  amount: z.number().positive(),
  payment_method_name: z.string().trim().min(1),
  receipt_date: z.string().date(),
  reference_number: z.string().trim().optional(),
  notes: z.string().trim().optional(),
})
customersRouter.get("/", async (c) => {
  const orgId = await organizationId(c.req.raw.headers); if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const rows = await sql`SELECT * FROM customers WHERE organization_id=${orgId} AND deleted_at IS NULL ORDER BY name`
  return c.json({ customers: rows })
})
customersRouter.post("/", zValidator("json", customerSchema), async (c) => {
  const orgId = await organizationId(c.req.raw.headers); if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const b=c.req.valid("json")
  const rows=await sql`INSERT INTO customers(organization_id,name,vat_number,commercial_registration,phone,email,notes,country,country_code,city,district,street,building_number,postal_code,additional_number,short_address)
    VALUES(${orgId},${b.name},${b.vat_number},${b.commercial_registration||null},${b.phone||null},${b.email||null},${b.notes||null},'Saudi Arabia','SA',${b.city},${b.district},${b.street},${b.building_number},${b.postal_code},${b.additional_number||null},${b.short_address||null}) RETURNING *`
  return c.json({ customer: rows[0] }, 201)
})
customersRouter.put("/:id", zValidator("json", customerSchema), async (c) => {
  const orgId = await organizationId(c.req.raw.headers); if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const b=c.req.valid("json"), id=c.req.param("id")
  const rows=await sql`UPDATE customers SET name=${b.name},vat_number=${b.vat_number},commercial_registration=${b.commercial_registration||null},phone=${b.phone||null},email=${b.email||null},notes=${b.notes||null},city=${b.city},district=${b.district},street=${b.street},building_number=${b.building_number},postal_code=${b.postal_code},additional_number=${b.additional_number||null},short_address=${b.short_address||null},updated_at=NOW(),sync_version=sync_version+1 WHERE id=${id} AND organization_id=${orgId} AND deleted_at IS NULL RETURNING *`
  return rows[0] ? c.json({ customer: rows[0] }) : c.json({ error: "العميل غير موجود" }, 404)
})
customersRouter.delete("/:id", async (c) => {
  const orgId = await organizationId(c.req.raw.headers); if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const rows=await sql`UPDATE customers SET deleted_at=NOW(),updated_at=NOW(),sync_version=sync_version+1 WHERE id=${c.req.param("id")} AND organization_id=${orgId} AND deleted_at IS NULL RETURNING id`
  return rows[0] ? c.json({ ok: true }) : c.json({ error: "العميل غير موجود" }, 404)
})

customersRouter.get("/:id/account", async (c) => {
  const orgId = await organizationId(c.req.raw.headers); if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const customerId = c.req.param("id")
  const customers = await sql`SELECT id,name,vat_number FROM customers WHERE id=${customerId} AND organization_id=${orgId} AND deleted_at IS NULL LIMIT 1`
  if (!customers[0]) return c.json({ error: "العميل غير موجود" }, 404)
  const rows = await sql`
    SELECT 'invoice' AS kind,d.id AS source_id,d.number,d.issue_date AS event_date,d.created_at,
      d.total AS invoice_total,d.retention_total,0::numeric AS received,d.status,NULL::text AS payment_method_name,NULL::text AS reference_number
    FROM documents d
    WHERE d.organization_id=${orgId} AND d.customer_id=${customerId} AND d.type='invoice'
      AND d.status IN ('issued','paid','partially_paid') AND d.deleted_at IS NULL
    UNION ALL
    SELECT 'payment' AS kind,dp.id AS source_id,d.number,COALESCE(dp.paid_at::date,d.issue_date) AS event_date,dp.created_at,
      0::numeric,0::numeric,dp.amount,d.status,dp.payment_method_name,NULL::text
    FROM document_payments dp JOIN documents d ON d.id=dp.document_id
    WHERE d.organization_id=${orgId} AND d.customer_id=${customerId} AND d.type='invoice'
      AND d.status IN ('issued','paid','partially_paid') AND d.deleted_at IS NULL AND dp.is_collected=TRUE
    UNION ALL
    SELECT 'receipt' AS kind,cr.id AS source_id,cr.number,cr.receipt_date AS event_date,cr.created_at,
      0::numeric,0::numeric,cr.amount,NULL::text,cr.payment_method_name,cr.reference_number
    FROM customer_receipts cr
    WHERE cr.organization_id=${orgId} AND cr.customer_id=${customerId}
    ORDER BY event_date,created_at,kind
  `
  let balance = 0
  const movements = rows.map((row) => {
    const invoiceTotal=Number(row.invoice_total),retentionTotal=Number(row.retention_total),received=Number(row.received)
    balance=Math.round((balance+invoiceTotal-retentionTotal-received)*100)/100
    return {...row,invoice_total:invoiceTotal,retention_total:retentionTotal,received,balance}
  })
  const summary=movements.reduce((totals,row)=>({
    invoice_total:totals.invoice_total+row.invoice_total,
    retention_total:totals.retention_total+row.retention_total,
    received_total:totals.received_total+row.received,
  }),{invoice_total:0,retention_total:0,received_total:0})
  return c.json({customer:customers[0],summary:{...summary,balance:Math.round((summary.invoice_total-summary.retention_total-summary.received_total)*100)/100},movements})
})

customersRouter.post("/:id/receipts", zValidator("json", receiptSchema), async (c) => {
  const orgId = await organizationId(c.req.raw.headers); if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const customerId=c.req.param("id"),body=c.req.valid("json")
  const result=await withTransaction(async(client)=>{
    const customer=await client.query("SELECT id FROM customers WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL",[customerId,orgId])
    if(!customer.rows[0])return null
    await client.query("INSERT INTO document_sequences(organization_id,document_type,next_number) VALUES($1,'receipt',1) ON CONFLICT(organization_id,document_type) DO NOTHING",[orgId])
    const sequence=await client.query("SELECT next_number FROM document_sequences WHERE organization_id=$1 AND document_type='receipt' FOR UPDATE",[orgId])
    const candidate=Number(sequence.rows[0].next_number),number=String(candidate).padStart(5,"0")
    await client.query("UPDATE document_sequences SET next_number=$1 WHERE organization_id=$2 AND document_type='receipt'",[candidate+1,orgId])
    const receipt=await client.query(`INSERT INTO customer_receipts(id,organization_id,customer_id,number,receipt_date,amount,payment_method_name,reference_number,notes)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[randomUUID(),orgId,customerId,number,body.receipt_date,body.amount,body.payment_method_name,body.reference_number||null,body.notes||null])
    return receipt.rows[0]
  })
  return result?c.json({receipt:result},201):c.json({error:"العميل غير موجود"},404)
})
