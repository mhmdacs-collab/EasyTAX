import { randomUUID } from "node:crypto"
import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { auth } from "../lib/auth"
import { sql, withTransaction } from "../lib/db"
import { issueReceipt } from "../lib/receiptService"
import { calculateDocument } from "../lib/documentCalculations"
import { activePeriodLock, lockedPeriodMessage } from "../lib/periodLocks"
import { availableCreditAmount, calculateTaxAdjustment } from "../lib/documentAdjustments"
import { postJournalEntry, reverseSourceJournalEntries } from "../lib/accountingEngine"
import { documentJournal } from "../lib/accountingRules"
import { dateOnly } from "../lib/dateOnly"

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
  type: z.enum(["invoice", "quotation"]).default("invoice"),
  customer_id: z.string().min(1), issue_date: z.string().date(), due_date: z.string().date().optional().or(z.literal("")),
  prices_include_tax: z.boolean(), retention_basis: z.enum(["before_tax", "including_tax"]).optional(),
  discount_amount: z.number().nonnegative().default(0), notes: z.string().optional(),
  show_bank_details: z.boolean().default(false), show_stamp: z.boolean().default(false), show_signature: z.boolean().default(false),
  reference_data: z.object({ purchase_order: z.string().optional(), reference_number: z.string().optional(), payment_method: z.string().optional(), show_totals: z.boolean().optional() }).default({}),
  payments: z.array(z.object({ payment_method_name: z.string().trim().min(1), amount: z.number().positive() })).default([]),
  terms: z.array(z.string().trim().min(1)).default([]),
  items: z.array(itemSchema).min(1),
})

documentsRouter.get("/", async (c) => {
  const organizationId = await getOrganizationId(c.req.raw.headers)
  if (!organizationId) return c.json({ error: "غير مصرح" }, 401)
  const rows = await sql`SELECT id,type,number,issue_date,due_date,status,subtotal,tax_total,retention_total,total,customer_snapshot,created_at,updated_at FROM documents WHERE organization_id=${organizationId} AND deleted_at IS NULL ORDER BY created_at DESC`
  return c.json({ documents: rows })
})

documentsRouter.get("/:id", async (c) => {
  const organizationId = await getOrganizationId(c.req.raw.headers)
  if (!organizationId) return c.json({ error: "غير مصرح" }, 401)
  const rows = await sql`SELECT d.*, COALESCE(json_agg(di ORDER BY di.sort_order) FILTER (WHERE di.id IS NOT NULL),'[]'::json) AS items, COALESCE((SELECT json_agg(dp ORDER BY dp.created_at) FROM document_payments dp WHERE dp.document_id=d.id),'[]'::json) AS payments, COALESCE((SELECT json_agg(dt.text ORDER BY dt.sort_order) FROM document_terms dt WHERE dt.document_id=d.id),'[]'::json) AS terms FROM documents d LEFT JOIN document_items di ON di.document_id=d.id WHERE d.id=${c.req.param("id")} AND d.organization_id=${organizationId} AND d.deleted_at IS NULL GROUP BY d.id`
  return rows[0] ? c.json({ document: rows[0] }) : c.json({ error: "المستند غير موجود" }, 404)
})

async function saveDraft(organizationId: string, id: string, body: z.infer<typeof draftSchema>, update: boolean) {
  const totals = calculateDocument(body)
  const collectedTotal = Math.round(body.payments.reduce((sum, payment) => sum + payment.amount, 0) * 100) / 100
  if (collectedTotal > totals.payableTotal) return { error: "PAYMENTS_EXCEED_TOTAL" as const }
  const dueTotal = Math.round((totals.payableTotal - collectedTotal) * 100) / 100
  return withTransaction(async (client) => {
    const customer = await client.query("SELECT * FROM customers WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL", [body.customer_id, organizationId])
    if (!customer.rows[0]) return { error: "CUSTOMER_NOT_FOUND" as const }
    if (update) {
      const changed = await client.query(`UPDATE documents SET type=$1,customer_id=$2,issue_date=$3,due_date=$4,prices_include_tax=$5,retention_basis=$6,subtotal=$7,discount_total=$8,tax_total=$9,retention_total=$10,total=$11,collected_total=$12,due_total=$13,show_bank_details=$14,show_stamp=$15,show_signature=$16,notes=$17,reference_data=$18,customer_snapshot=$19,updated_at=NOW(),sync_version=sync_version+1 WHERE id=$20 AND organization_id=$21 AND status='draft' AND deleted_at IS NULL RETURNING id`, [body.type,body.customer_id,body.issue_date,body.due_date||null,body.prices_include_tax,body.retention_basis||null,totals.subtotal,totals.discountTotal,totals.taxTotal,totals.retentionTotal,totals.total,collectedTotal,dueTotal,body.show_bank_details,body.show_stamp,body.show_signature,body.notes||null,JSON.stringify(body.reference_data),JSON.stringify(customer.rows[0]),id,organizationId])
      if (!changed.rows[0]) return { error: "DRAFT_NOT_EDITABLE" as const }
      await client.query("DELETE FROM document_items WHERE document_id=$1", [id])
      await client.query("DELETE FROM document_payments WHERE document_id=$1", [id])
      await client.query("DELETE FROM document_terms WHERE document_id=$1", [id])
    } else {
      await client.query(`INSERT INTO documents(id,organization_id,customer_id,type,number,issue_date,due_date,status,prices_include_tax,retention_basis,subtotal,discount_total,tax_total,retention_total,total,collected_total,due_total,show_bank_details,show_stamp,show_signature,notes,reference_data,customer_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,'draft',$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`, [id,organizationId,body.customer_id,body.type,`DRAFT-${id}`,body.issue_date,body.due_date||null,body.prices_include_tax,body.retention_basis||null,totals.subtotal,totals.discountTotal,totals.taxTotal,totals.retentionTotal,totals.total,collectedTotal,dueTotal,body.show_bank_details,body.show_stamp,body.show_signature,body.notes||null,JSON.stringify(body.reference_data),JSON.stringify(customer.rows[0])])
    }
    for (const line of totals.lines) await client.query(`INSERT INTO document_items(document_id,description,unit,quantity,unit_price,discount,tax_rate,retention_rate,line_subtotal,line_tax,line_retention,line_total,sort_order) VALUES($1,$2,$3,$4,$5,$6,15,$7,$8,$9,$10,$11,$12)`, [id,line.description,line.unit||null,line.quantity,line.unit_price,line.discount,line.retention_percent,line.line_subtotal,line.line_tax,line.line_retention,line.line_total,line.sort_order])
    for (const payment of body.payments) await client.query(`INSERT INTO document_payments(document_id,payment_method_id,payment_method_name,amount,is_collected,paid_at) VALUES($1,(SELECT id FROM payment_methods WHERE organization_id=$2 AND name=$3 AND is_active=TRUE LIMIT 1),$3,$4,TRUE,NOW())`, [id,organizationId,payment.payment_method_name,payment.amount])
    for (const [sortOrder, term] of body.terms.entries()) await client.query(`INSERT INTO document_terms(document_id,text,sort_order) VALUES($1,$2,$3)`, [id,term,sortOrder])
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
    const draft = await client.query("SELECT * FROM documents WHERE id=$1 AND organization_id=$2 AND status='draft' AND deleted_at IS NULL FOR UPDATE", [c.req.param("id"), organizationId])
    if (!draft.rows[0]) return null
    const issueDate = dateOnly(draft.rows[0].issue_date)
    const periodLock = await activePeriodLock(client, organizationId, issueDate)
    if (periodLock) return { error: "PERIOD_LOCKED" as const, message: lockedPeriodMessage(periodLock) }
    const organization = await client.query("SELECT * FROM organizations WHERE id=$1", [organizationId])
    const seller = organization.rows[0] as Record<string, unknown> | undefined
    const requiredSellerFields = ["business_name", "vat_number", "commercial_registration", "street", "building_number", "district", "city", "postal_code"]
    if (!seller || requiredSellerFields.some((field) => !String(seller[field] ?? "").trim())) {
      return { error: "SELLER_PROFILE_INCOMPLETE" as const }
    }
    const documentType = draft.rows[0].type as "invoice" | "quotation"
    await client.query(`INSERT INTO document_sequences(organization_id,document_type,next_number) VALUES($1,$2,1) ON CONFLICT(organization_id,document_type) DO NOTHING`, [organizationId,documentType])
    const sequence = await client.query(`SELECT GREATEST(ds.next_number,COALESCE((SELECT MAX(number::bigint)+1 FROM documents WHERE organization_id=$1 AND type=$2 AND number ~ '^\\d+$'),1)) AS candidate FROM document_sequences ds WHERE ds.organization_id=$1 AND ds.document_type=$2 FOR UPDATE`, [organizationId,documentType])
    const candidate = Number(sequence.rows[0].candidate)
    const number = String(candidate).padStart(5,"0")
    await client.query("UPDATE document_sequences SET next_number=$1 WHERE organization_id=$2 AND document_type=$3", [candidate+1,organizationId,documentType])
    const issued = await client.query(`UPDATE documents SET number=$1,status='issued',uuid=$2,issue_time=LOCALTIME,organization_snapshot=$3,updated_at=NOW(),sync_version=sync_version+1 WHERE id=$4 RETURNING id,number`, [number,randomUUID(),JSON.stringify(organization.rows[0]),c.req.param("id")])
    const issuedRow=issued.rows[0] as {id:string;number:string}
    if(documentType==="invoice"){
      await postJournalEntry(client,{organizationId,entryDate:issueDate,sourceType:"document",sourceId:c.req.param("id"),idempotencyKey:`document:${c.req.param("id")}:issued`,description:`فاتورة ضريبية رقم ${number}`,customerId:String(draft.rows[0].customer_id),lines:documentJournal({type:"invoice",total:Number(draft.rows[0].total),taxTotal:Number(draft.rows[0].tax_total),retentionTotal:Number(draft.rows[0].retention_total)})})
      const payments=await client.query("SELECT * FROM document_payments WHERE document_id=$1 AND is_collected=TRUE ORDER BY created_at FOR UPDATE",[c.req.param("id")])
      const customer=draft.rows[0].customer_snapshot as Record<string,unknown>
      const seller=organization.rows[0] as Record<string,unknown>
      for(const payment of payments.rows)await issueReceipt(client,{organizationId,customerId:String(draft.rows[0].customer_id),payerName:String(customer.name??""),payerPhone:String(customer.phone??"")||null,payerEmail:String(customer.email??"")||null,payerVatNumber:String(customer.vat_number??"")||null,receiptDate:issueDate,amount:Number(payment.amount),paymentMethodName:String(payment.payment_method_name),referenceNumber:`فاتورة رقم ${number}`,organizationSnapshot:seller,showStamp:Boolean(seller.stamp_url&&seller.stamp_on_receipt),showSignature:Boolean(seller.signature_url&&seller.signature_on_receipt),sourceDocumentId:c.req.param("id"),sourcePaymentId:String(payment.id),requestId:`invoice-payment:${payment.id}`})
    }
    await client.query("INSERT INTO financial_audit_events(organization_id,entity_type,entity_id,action,snapshot) VALUES($1,'document',$2,'issued',$3)",[organizationId,c.req.param("id"),JSON.stringify({...draft.rows[0],number,status:"issued"})])
    return issuedRow
  })
  if (!result) return c.json({ error: "المسودة غير موجودة أو صادرة مسبقًا" }, 409)
  if ("error" in result) return c.json({ error: result.error === "PERIOD_LOCKED" ? result.message : "أكمل السجل التجاري والعنوان الوطني للمنشأة قبل إصدار الفاتورة" }, result.error === "PERIOD_LOCKED" ? 409 : 422)
  return c.json({ document: result })
})

const adjustmentSchema = z.object({
  type: z.enum(["credit_note", "debit_note"]),
  issue_date: z.iso.date(),
  reason: z.string().trim().min(5).max(500),
  taxable_amount: z.coerce.number().positive().max(999999999999),
})

documentsRouter.post("/:id/adjustments", zValidator("json", adjustmentSchema, (result, c) => {
  if (!result.success) return c.json({ error: result.error.issues[0]?.message ?? "راجع بيانات الإشعار" }, 400)
  return undefined
}), async (c) => {
  const organizationId = await getOrganizationId(c.req.raw.headers)
  if (!organizationId) return c.json({ error: "غير مصرح" }, 401)
  const body = c.req.valid("json")
  const result = await withTransaction(async (client) => {
    const sourceResult = await client.query("SELECT * FROM documents WHERE id=$1 AND organization_id=$2 AND type='invoice' AND status IN ('issued','paid','partially_paid') AND deleted_at IS NULL FOR UPDATE", [c.req.param("id"), organizationId])
    const source = sourceResult.rows[0]
    if (!source) return { error: "SOURCE_NOT_FOUND" as const }
    if (body.issue_date < dateOnly(source.issue_date)) return { error: "DATE_BEFORE_INVOICE" as const }
    const periodLock = await activePeriodLock(client, organizationId, body.issue_date)
    if (periodLock) return { error: "PERIOD_LOCKED" as const, message: lockedPeriodMessage(periodLock) }
    const adjustment = calculateTaxAdjustment(body.taxable_amount)
    const taxAmount = adjustment.tax
    const total = adjustment.total
    if (body.type === "credit_note") {
      const prior = await client.query(`SELECT
        COALESCE(SUM(CASE WHEN type='credit_note' THEN total ELSE 0 END),0) credits,
        COALESCE(SUM(CASE WHEN type='debit_note' THEN total ELSE 0 END),0) debits
        FROM documents WHERE organization_id=$1 AND source_document_id=$2
          AND type IN ('credit_note','debit_note') AND status IN ('issued','paid','partially_paid') AND deleted_at IS NULL`, [organizationId, source.id])
      const available = availableCreditAmount(Number(source.total), Number(prior.rows[0].credits), Number(prior.rows[0].debits))
      if (total > available + 0.005) return { error: "CREDIT_EXCEEDS_AVAILABLE" as const, available }
    }
    await client.query("INSERT INTO document_sequences(organization_id,document_type,next_number) VALUES($1,$2,1) ON CONFLICT(organization_id,document_type) DO NOTHING", [organizationId, body.type])
    const sequence = await client.query("SELECT next_number FROM document_sequences WHERE organization_id=$1 AND document_type=$2 FOR UPDATE", [organizationId, body.type])
    const candidate = Number(sequence.rows[0].next_number)
    const number = `${body.type === "credit_note" ? "CN" : "DN"}-${String(candidate).padStart(5, "0")}`
    await client.query("UPDATE document_sequences SET next_number=$1 WHERE organization_id=$2 AND document_type=$3", [candidate + 1, organizationId, body.type])
    const id = randomUUID()
    const inserted = await client.query(`INSERT INTO documents(
      id,organization_id,customer_id,type,number,issue_date,status,prices_include_tax,subtotal,discount_total,
      tax_total,retention_total,total,collected_total,due_total,show_bank_details,show_stamp,show_signature,
      notes,uuid,issue_time,organization_snapshot,customer_snapshot,reference_data,source_document_id,correction_reason
    ) VALUES($1,$2,$3,$4,$5,$6,'issued',FALSE,$7,0,$8,0,$9,0,$9,FALSE,$10,$11,$12,$13,LOCALTIME,$14,$15,$16,$17,$12)
    RETURNING *`, [
      id, organizationId, source.customer_id, body.type, number, body.issue_date, adjustment.taxable, taxAmount, total,
      source.show_stamp, source.show_signature, body.reason, randomUUID(), JSON.stringify(source.organization_snapshot),
      JSON.stringify(source.customer_snapshot), JSON.stringify({ source_invoice_number: source.number }), source.id,
    ])
    await client.query(`INSERT INTO document_items(
      document_id,description,quantity,unit_price,discount,tax_rate,retention_rate,line_subtotal,line_tax,line_retention,line_total,sort_order
    ) VALUES($1,$2,1,$3,0,15,0,$3,$4,0,$5,0)`, [id, `تصحيح على الفاتورة رقم ${source.number}: ${body.reason}`, adjustment.taxable, taxAmount, total])
    await postJournalEntry(client,{organizationId,entryDate:body.issue_date,sourceType:"document",sourceId:id,idempotencyKey:`document:${id}:issued`,description:`${body.type === "credit_note" ? "إشعار دائن" : "إشعار مدين"} رقم ${number}`,customerId:String(source.customer_id),lines:documentJournal({type:body.type,total,taxTotal:taxAmount})})
    await client.query("INSERT INTO financial_audit_events(organization_id,entity_type,entity_id,action,reason,snapshot) VALUES($1,'document',$2,'issued',$3,$4)", [organizationId, id, body.reason, JSON.stringify(inserted.rows[0])])
    return { document: inserted.rows[0] }
  })
  if ("error" in result) {
    if (result.error === "SOURCE_NOT_FOUND") return c.json({ error: "لا يمكن إصدار إشعار إلا لفاتورة ضريبية صادرة" }, 404)
    if (result.error === "DATE_BEFORE_INVOICE") return c.json({ error: "تاريخ الإشعار لا يمكن أن يسبق تاريخ الفاتورة الأصلية" }, 400)
    if (result.error === "PERIOD_LOCKED") return c.json({ error: result.message }, 409)
    if (result.error === "CREDIT_EXCEEDS_AVAILABLE") return c.json({ error: `قيمة الإشعار الدائن تتجاوز الرصيد القابل للتصحيح وهو ${result.available.toFixed(2)} ر.س` }, 409)
    return c.json({ error: "تعذر إصدار الإشعار" }, 400)
  }
  return c.json(result, 201)
})

const cancelSchema=z.object({reason:z.string().trim().min(3).max(500)})
documentsRouter.post("/:id/cancel",zValidator("json",cancelSchema),async(c)=>{
  const organizationId=await getOrganizationId(c.req.raw.headers);if(!organizationId)return c.json({error:"غير مصرح"},401)
  const reason=c.req.valid("json").reason
  const result=await withTransaction(async(client)=>{
    const document=await client.query("SELECT * FROM documents WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL FOR UPDATE",[c.req.param("id"),organizationId])
    const row=document.rows[0] as Record<string,unknown>|undefined
    if(!row)return {error:"NOT_FOUND" as const}
    if(row.status==="cancelled")return {error:"ALREADY_CANCELLED" as const}
    if(row.status==="draft")return {error:"DRAFT" as const}
    const issueDate=dateOnly(row.issue_date)
    const periodLock=await activePeriodLock(client,organizationId,issueDate)
    if(periodLock)return {error:"PERIOD_LOCKED" as const,message:lockedPeriodMessage(periodLock)}
    if(row.type==="invoice"){
      const corrections=await client.query("SELECT 1 FROM documents WHERE source_document_id=$1 AND type IN ('credit_note','debit_note') AND status<>'cancelled' AND deleted_at IS NULL LIMIT 1",[row.id])
      if(corrections.rows[0])return {error:"ACTIVE_ADJUSTMENTS" as const}
    }
    const activeReceipts=await client.query(`
      SELECT 1
      WHERE EXISTS (
        SELECT 1 FROM customer_receipts
        WHERE source_document_id=$1 AND status='issued'
      ) OR EXISTS (
        SELECT 1 FROM document_payments
        WHERE document_id=$1 AND is_collected=TRUE
      )
      LIMIT 1
    `,[row.id])
    if(activeReceipts.rows[0])return {error:"ACTIVE_RECEIPTS" as const}
    await reverseSourceJournalEntries(client,{organizationId,sourceType:"document",sourceId:String(row.id),reversalDate:issueDate,reason})
    const cancelled=await client.query("UPDATE documents SET status='cancelled',cancelled_at=NOW(),cancellation_reason=$1,updated_at=NOW(),sync_version=sync_version+1 WHERE id=$2 RETURNING *",[reason,row.id])
    await client.query("INSERT INTO financial_audit_events(organization_id,entity_type,entity_id,action,reason,snapshot) VALUES($1,'document',$2,'cancelled',$3,$4)",[organizationId,row.id,reason,JSON.stringify(cancelled.rows[0])])
    return {document:cancelled.rows[0]}
  })
  if("document" in result)return c.json(result)
  if(result.error==="PERIOD_LOCKED")return c.json({error:result.message},409)
  const messages={NOT_FOUND:"المستند غير موجود",ALREADY_CANCELLED:"المستند ملغى مسبقًا",DRAFT:"احذف المسودة أو عدلها بدل إلغائها",ACTIVE_RECEIPTS:"اعكس سندات القبض المرتبطة أولًا قبل إلغاء الفاتورة",ACTIVE_ADJUSTMENTS:"ألغِ الإشعارات الدائنة والمدينة المرتبطة أولًا قبل إلغاء الفاتورة الأصلية"} as const
  return c.json({error:messages[result.error]},result.error==="NOT_FOUND"?404:409)
})
