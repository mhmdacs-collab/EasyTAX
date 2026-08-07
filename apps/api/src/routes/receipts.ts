import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { auth } from "../lib/auth"
import { sql, withTransaction } from "../lib/db"
import { issueReceipt } from "../lib/receiptService"
import { activePeriodLock, lockedPeriodMessage } from "../lib/periodLocks"
import { reverseSourceJournalEntries } from "../lib/accountingEngine"

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
  request_id: z.string().uuid().optional(),
}).superRefine((body, context) => {
  if (!body.customer_id && !body.payer_name?.trim()) context.addIssue({ code: "custom", path: ["payer_name"], message: "اسم المستلم منه مطلوب" })
})

receiptsRouter.get("/", async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const receipts = await sql`SELECT id,customer_id,number,receipt_date,amount,payment_method_name,payer_name,payer_phone,payer_email,payer_vat_number,reference_number,status,cancelled_at,cancellation_reason,source_document_id,created_at FROM customer_receipts WHERE organization_id=${orgId} ORDER BY receipt_date DESC,created_at DESC`
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
    const periodLock = await activePeriodLock(client, orgId, body.receipt_date)
    if (periodLock) return { error: "PERIOD_LOCKED" as const, message: lockedPeriodMessage(periodLock) }
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

    const payerName = String(customer?.name ?? body.payer_name ?? "").trim()
    const payerPhone = String(customer?.phone ?? body.payer_phone ?? "").trim() || null
    const payerEmail = String(customer?.email ?? body.payer_email ?? "").trim() || null
    const payerVat = String(customer?.vat_number ?? body.payer_vat_number ?? "").trim() || null
    const receipt=await issueReceipt(client,{organizationId:orgId,customerId:body.customer_id||null,payerName,payerPhone,payerEmail,payerVatNumber:payerVat,receiptDate:body.receipt_date,amount:body.amount,paymentMethodName:body.payment_method_name,referenceNumber:body.reference_number||null,notes:body.notes||null,organizationSnapshot:organization.rows[0] as Record<string,unknown>,showStamp:body.show_stamp,showSignature:body.show_signature,requestId:body.request_id||null})
    return { receipt }
  })
  if ("receipt" in result) return c.json(result, 201)
  if (result.error === "PERIOD_LOCKED") return c.json({ error: result.message }, 409)
  const messages = { CUSTOMER_NOT_FOUND: "العميل غير موجود", PAYMENT_METHOD_NOT_FOUND: "طريقة السداد غير متاحة", ORGANIZATION_NOT_FOUND: "المنشأة غير موجودة" } as const
  return c.json({ error: messages[result.error] }, 400)
})

const cancelSchema=z.object({reason:z.string().trim().min(3).max(500)})
receiptsRouter.post("/:id/cancel",zValidator("json",cancelSchema),async(c)=>{
  const orgId=await organizationId(c.req.raw.headers);if(!orgId)return c.json({error:"غير مصرح"},401)
  const reason=c.req.valid("json").reason
  const result=await withTransaction(async(client)=>{
    const receipt=await client.query("SELECT * FROM customer_receipts WHERE id=$1 AND organization_id=$2 FOR UPDATE",[c.req.param("id"),orgId])
    const row=receipt.rows[0] as Record<string,unknown>|undefined
    if(!row)return {error:"NOT_FOUND" as const}
    if(row.status!=="issued")return {error:"ALREADY_CANCELLED" as const}
    const periodLock=await activePeriodLock(client,orgId,String(row.receipt_date).slice(0,10))
    if(periodLock)return {error:"PERIOD_LOCKED" as const,message:lockedPeriodMessage(periodLock)}
    await reverseSourceJournalEntries(client,{organizationId:orgId,sourceType:"receipt",sourceId:String(row.id),reversalDate:String(row.receipt_date).slice(0,10),reason})
    const cancelled=await client.query("UPDATE customer_receipts SET status='cancelled',cancelled_at=NOW(),cancellation_reason=$1,updated_at=NOW() WHERE id=$2 RETURNING *",[reason,row.id])
    if(row.source_payment_id){
      await client.query("UPDATE document_payments SET is_collected=FALSE WHERE id=$1",[row.source_payment_id])
      await client.query(`UPDATE documents SET collected_total=GREATEST(0,collected_total-$1),due_total=due_total+$1,updated_at=NOW(),sync_version=sync_version+1 WHERE id=$2`,[row.amount,row.source_document_id])
    }
    await client.query("INSERT INTO financial_audit_events(organization_id,entity_type,entity_id,action,reason,snapshot) VALUES($1,'receipt',$2,'reversed',$3,$4)",[orgId,row.id,reason,JSON.stringify(cancelled.rows[0])])
    return {receipt:cancelled.rows[0]}
  })
  if("receipt" in result)return c.json(result)
  if(result.error==="PERIOD_LOCKED")return c.json({error:result.message},409)
  return c.json({error:result.error==="NOT_FOUND"?"سند القبض غير موجود":"سند القبض ملغى مسبقًا"},result.error==="NOT_FOUND"?404:409)
})
