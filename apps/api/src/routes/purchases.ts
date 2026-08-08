import { randomUUID } from "node:crypto"
import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { auth } from "../lib/auth"
import { sql, withTransaction } from "../lib/db"
import { applyExpensePayment, reverseRecordedPayment } from "../lib/expensePayments"
import { activePeriodLock, lockedPeriodMessage } from "../lib/periodLocks"
import { postJournalEntry, reverseSourceJournalEntries } from "../lib/accountingEngine"
import { payablePaymentJournal, purchaseJournal, purchaseTaxExclusionJournal } from "../lib/accountingRules"
import { dateOnly } from "../lib/dateOnly"

export const purchasesRouter = new Hono()
const paymentMethods = ["cash", "bank_transfer", "card", "sadad"] as const
const ibanPattern = /^SA\d{22}$/

const initialPaymentSchema = z.object({
  amount: z.number().positive(),
  payment_method: z.enum(paymentMethods),
  reference_number: z.string().trim().max(120).optional(),
})

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
  source: z.enum(["qr", "manual"]).default("qr"),
  supplier_name: z.string().trim().min(1).max(300),
  supplier_vat_number: z.string().trim().regex(/^3\d{13}3$/),
  invoice_number: z.string().trim().min(1).max(120),
  invoice_timestamp: z.string().datetime(),
  total: z.number().positive(),
  tax_total: z.number().min(0),
  qr_payload: z.string().trim().min(1).max(4000).optional(),
  qr_fields: z.record(z.string(), z.string()).default({}),
  duplicate_override: z.boolean().default(false),
  responsibility_confirmed: z.literal(true),
  payment_status: z.enum(["paid", "partially_paid", "unpaid"]).default("unpaid"),
  initial_payment: initialPaymentSchema.optional(),
  notes: z.string().trim().max(1000).optional(),
}).superRefine((body, context) => {
  if (body.source === "qr" && !body.qr_payload) context.addIssue({ code: "custom", path: ["qr_payload"], message: "بيانات QR مطلوبة للفاتورة الممسوحة" })
  if (body.tax_total > body.total) context.addIssue({ code: "custom", path: ["tax_total"], message: "مبلغ الضريبة لا يمكن أن يتجاوز إجمالي الفاتورة" })
  if (body.payment_status === "unpaid" && body.initial_payment) {
    context.addIssue({ code: "custom", path: ["initial_payment"], message: "الفاتورة غير المدفوعة لا تقبل دفعة أولى" })
  }
  if (body.payment_status !== "unpaid" && !body.initial_payment) {
    context.addIssue({ code: "custom", path: ["initial_payment"], message: "أدخل بيانات الدفعة" })
  }
  if (body.payment_status === "paid" && body.initial_payment && Math.abs(body.initial_payment.amount - body.total) > 0.005) {
    context.addIssue({ code: "custom", path: ["initial_payment", "amount"], message: "الفاتورة المدفوعة يجب أن تكون مسددة بالكامل" })
  }
  if (body.payment_status === "partially_paid" && body.initial_payment && body.initial_payment.amount >= body.total) {
    context.addIssue({ code: "custom", path: ["initial_payment", "amount"], message: "الدفعة الجزئية يجب أن تكون أقل من إجمالي الفاتورة" })
  }
  if (body.initial_payment?.payment_method === "sadad" && !body.initial_payment.reference_number) {
    context.addIssue({ code: "custom", path: ["initial_payment", "reference_number"], message: "رقم سداد أو رقم الفاتورة مطلوب" })
  }
})

purchasesRouter.get("/", async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const purchases = await sql`
    SELECT id,internal_number,supplier_name,supplier_vat_number,invoice_number,invoice_date,invoice_timestamp,
           subtotal,tax_total,total,status,exclusion_reason,cancelled_at,cancellation_reason,
           accounting_status,payment_status,paid_amount,last_payment_method,beneficiary_iban,
           source,duplicate_override,duplicate_of_id,created_at
    FROM purchase_invoices
    WHERE organization_id=${orgId} AND deleted_at IS NULL
    ORDER BY invoice_date DESC,created_at DESC`
  return c.json({ purchases })
})

purchasesRouter.get("/:id", async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const rows = await sql`SELECT pi.*,
    COALESCE((SELECT json_agg(pip ORDER BY pip.payment_date,pip.created_at) FROM purchase_invoice_payments pip WHERE pip.purchase_invoice_id=pi.id),'[]'::json) AS payments
    FROM purchase_invoices pi WHERE pi.id=${c.req.param("id")} AND pi.organization_id=${orgId} AND pi.deleted_at IS NULL LIMIT 1`
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
      AND (invoice_number=${body.invoice_number} OR (${body.qr_payload ?? ""} <> '' AND qr_payload=${body.qr_payload ?? ""}))
    ORDER BY created_at DESC LIMIT 1`
  const duplicate = duplicates[0] as Record<string, unknown> | undefined
  if (duplicate && !body.duplicate_override) return c.json({ error: "DUPLICATE_WARNING", duplicate }, 409)

  const purchase = await withTransaction(async (client) => {
    const periodLock = await activePeriodLock(client, orgId, invoiceDate)
    if (periodLock) return { error: "PERIOD_LOCKED" as const, message: lockedPeriodMessage(periodLock) }
    await client.query("INSERT INTO purchase_invoice_sequences(organization_id,next_number) VALUES($1,1) ON CONFLICT(organization_id) DO NOTHING", [orgId])
    const sequence = await client.query("SELECT next_number FROM purchase_invoice_sequences WHERE organization_id=$1 FOR UPDATE", [orgId])
    const nextNumber = Number(sequence.rows[0].next_number)
    const internalNumber = `${body.source === "qr" ? "PQR" : "PMN"}-${String(nextNumber).padStart(5, "0")}`
    await client.query("UPDATE purchase_invoice_sequences SET next_number=$1 WHERE organization_id=$2", [nextNumber + 1, orgId])
    const subtotal = Math.max(0, body.total - body.tax_total)
    const paidAmount = body.initial_payment?.amount ?? 0
    const result = await client.query(`
      INSERT INTO purchase_invoices(
        organization_id,internal_number,supplier_name,supplier_vat_number,invoice_number,invoice_date,invoice_timestamp,
        subtotal,tax_total,total,include_in_tax_return,qr_payload,qr_extraction_status,qr_fields,source,status,
        duplicate_override,duplicate_of_id,payment_status,paid_amount,last_payment_method
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE,$11,$12,$13,$14,'included',$15,$16,$17,$18,$19)
      RETURNING *`, [orgId, internalNumber, body.supplier_name, body.supplier_vat_number, body.invoice_number, invoiceDate,
      body.invoice_timestamp, subtotal, body.tax_total, body.total, body.qr_payload ?? null, body.source === "qr" ? "extracted" : "manual", JSON.stringify(body.qr_fields), body.source,
      body.duplicate_override, duplicate?.id ?? null, body.payment_status, paidAmount, body.initial_payment?.payment_method ?? null])
    await postJournalEntry(client,{organizationId:orgId,entryDate:invoiceDate,sourceType:"purchase_invoice",sourceId:String(result.rows[0].id),idempotencyKey:`purchase_invoice:${String(result.rows[0].id)}:recorded`,description:`فاتورة مشتريات ${internalNumber}`,supplierReference:body.supplier_vat_number,lines:purchaseJournal({subtotal,taxTotal:body.tax_total,total:body.total})})
    if (body.initial_payment) {
      const paymentId = randomUUID()
      const payment = await client.query(`INSERT INTO purchase_invoice_payments(
        id,organization_id,purchase_invoice_id,payment_date,amount,payment_method,beneficiary_name,reference_number
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [
        paymentId, orgId, result.rows[0].id, invoiceDate, body.initial_payment.amount,
        body.initial_payment.payment_method, body.supplier_name, body.initial_payment.reference_number ?? null,
      ])
      await postJournalEntry(client,{organizationId:orgId,entryDate:invoiceDate,sourceType:"purchase_payment",sourceId:paymentId,idempotencyKey:`purchase_payment:${paymentId}:issued`,description:`دفعة أولى لفاتورة مشتريات ${internalNumber}`,supplierReference:body.supplier_vat_number,lines:payablePaymentJournal(body.initial_payment.amount)})
      await client.query("INSERT INTO financial_audit_events(organization_id,entity_type,entity_id,action,snapshot) VALUES($1,'purchase_payment',$2,'payment_recorded',$3)", [orgId, paymentId, JSON.stringify(payment.rows[0])])
    }
    await client.query("INSERT INTO financial_audit_events(organization_id,entity_type,entity_id,action,snapshot) VALUES($1,'purchase_invoice',$2,'created',$3)", [orgId, result.rows[0].id, JSON.stringify(result.rows[0])])
    return result.rows[0]
  })
  if ("error" in purchase) return c.json({ error: purchase.message }, 409)
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
    const invoiceDate = dateOnly(current.rows[0].invoice_date)
    const periodLock = await activePeriodLock(client, orgId, invoiceDate)
    if (periodLock) return { error: "PERIOD_LOCKED" as const, message: lockedPeriodMessage(periodLock) }
    if (body.status === "cancelled" && Number(current.rows[0].paid_amount) > 0) return { error: "ACTIVE_PAYMENTS" as const }
    if(body.status==="excluded"&&current.rows[0].status==="included"&&Number(current.rows[0].tax_total)>0)await postJournalEntry(client,{organizationId:orgId,entryDate:invoiceDate,sourceType:"purchase_tax_adjustment",sourceId:String(current.rows[0].id),idempotencyKey:`purchase_invoice:${String(current.rows[0].id)}:tax_excluded`,description:`استبعاد ضريبة فاتورة ${String(current.rows[0].internal_number??"")}`,supplierReference:String(current.rows[0].supplier_vat_number??""),lines:purchaseTaxExclusionJournal(Number(current.rows[0].tax_total))})
    if(body.status==="included"&&current.rows[0].status==="excluded")await reverseSourceJournalEntries(client,{organizationId:orgId,sourceType:"purchase_tax_adjustment",sourceId:String(current.rows[0].id),reversalDate:invoiceDate,reason:"إعادة إدراج الفاتورة في الإقرار الضريبي"})
    if(body.status==="cancelled"&&current.rows[0].status==="excluded")await reverseSourceJournalEntries(client,{organizationId:orgId,sourceType:"purchase_tax_adjustment",sourceId:String(current.rows[0].id),reversalDate:invoiceDate,reason:body.reason!})
    if(body.status === "cancelled") await reverseSourceJournalEntries(client,{organizationId:orgId,sourceType:"purchase_invoice",sourceId:String(current.rows[0].id),reversalDate:invoiceDate,reason:body.reason!})
    const updated = await client.query(`UPDATE purchase_invoices SET status=$1,include_in_tax_return=$2,
      accounting_status=CASE WHEN $1='cancelled' THEN 'cancelled' ELSE accounting_status END,
      exclusion_reason=$3,cancelled_at=CASE WHEN $1='cancelled' THEN NOW() ELSE NULL END,
      cancellation_reason=CASE WHEN $1='cancelled' THEN $3 ELSE NULL END,updated_at=NOW()
      WHERE id=$4 RETURNING *`, [body.status, body.status === "included", body.status === "included" ? null : body.reason, c.req.param("id")])
    await client.query("INSERT INTO financial_audit_events(organization_id,entity_type,entity_id,action,reason,snapshot) VALUES($1,'purchase_invoice',$2,$3,$4,$5)", [orgId, c.req.param("id"), body.status === "cancelled" ? "cancelled" : body.status, body.reason ?? null, JSON.stringify(updated.rows[0])])
    return updated.rows[0]
  })
  if (!result) return c.json({ error: "فاتورة المشتريات غير موجودة" }, 404)
  if ("error" in result) return c.json({ error: result.error === "PERIOD_LOCKED" ? result.message : result.error === "ACTIVE_PAYMENTS" ? "ألغِ دفعات فاتورة المشتريات أولًا قبل إلغائها" : "الفاتورة الملغاة مغلقة ولا يمكن إعادتها إلى الإقرار" }, 409)
  return c.json({ purchase: result })
})

const paymentSchema = z.object({
  amount: z.coerce.number().positive(),
  payment_method: z.enum(paymentMethods),
  payment_date: z.iso.date(),
  beneficiary_name: z.string().trim().max(300).optional(),
  beneficiary_iban: z.preprocess(
    (value) => typeof value === "string" ? value.replace(/\s+/g, "").toUpperCase() : value,
    z.union([z.string().regex(ibanPattern, "رقم الآيبان السعودي يجب أن يبدأ بـ SA ويتكون من 24 خانة"), z.literal(""), z.undefined()]),
  ),
  reference_number: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
}).superRefine((value, context) => {
  if (value.payment_method === "sadad" && !value.reference_number) context.addIssue({ code: "custom", path: ["reference_number"], message: "رقم سداد أو رقم الفاتورة مطلوب" })
})

purchasesRouter.post("/:id/payments", zValidator("json", paymentSchema, (result, c) => {
  if (!result.success) return c.json({ error: result.error.issues[0]?.message ?? "راجع بيانات السداد" }, 400)
  return undefined
}), async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const input = c.req.valid("json")
  const result = await withTransaction(async (client) => {
    const current = await client.query("SELECT * FROM purchase_invoices WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL FOR UPDATE", [c.req.param("id"), orgId])
    const purchase = current.rows[0]
    if (!purchase) return { error: "NOT_FOUND" as const }
    if (purchase.accounting_status === "cancelled") return { error: "CANCELLED" as const }
    const periodLock = await activePeriodLock(client, orgId, input.payment_date)
    if (periodLock) return { error: "PERIOD_LOCKED" as const, message: lockedPeriodMessage(periodLock) }
    const applied = applyExpensePayment(Number(purchase.total), Number(purchase.paid_amount), input.amount)
    if (!applied.ok) return { error: applied.reason, remaining: applied.remaining }
    const beneficiaryName = input.beneficiary_name || String(purchase.supplier_name || "المورد")
    const paymentId = randomUUID()
    const inserted = await client.query(`INSERT INTO purchase_invoice_payments(
      id,organization_id,purchase_invoice_id,payment_date,amount,payment_method,beneficiary_name,beneficiary_iban,reference_number,notes
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [
      paymentId, orgId, purchase.id, input.payment_date, input.amount, input.payment_method, beneficiaryName,
      input.beneficiary_iban || null, input.reference_number || null, input.notes || null,
    ])
    await postJournalEntry(client,{organizationId:orgId,entryDate:input.payment_date,sourceType:"purchase_payment",sourceId:paymentId,idempotencyKey:`purchase_payment:${paymentId}:issued`,description:`سداد فاتورة مشتريات ${String(purchase.internal_number??purchase.invoice_number??"")}`,supplierReference:String(purchase.supplier_vat_number??""),lines:payablePaymentJournal(input.amount)})
    const updated = await client.query(`UPDATE purchase_invoices SET
      paid_amount=$1,payment_status=$2,last_payment_method=$3,beneficiary_iban=COALESCE($4,beneficiary_iban),updated_at=NOW()
      WHERE id=$5 RETURNING *`, [applied.paid, applied.status, input.payment_method, input.beneficiary_iban || null, purchase.id])
    await client.query("INSERT INTO financial_audit_events(organization_id,entity_type,entity_id,action,snapshot) VALUES($1,'purchase_payment',$2,'payment_recorded',$3)", [orgId, paymentId, JSON.stringify(inserted.rows[0])])
    return { purchase: updated.rows[0], payment: inserted.rows[0] }
  })
  if ("error" in result) {
    if (result.error === "NOT_FOUND") return c.json({ error: "فاتورة المشتريات غير موجودة" }, 404)
    if (result.error === "CANCELLED") return c.json({ error: "لا يمكن سداد فاتورة ملغاة" }, 409)
    if (result.error === "PERIOD_LOCKED") return c.json({ error: result.message }, 409)
    if (result.error === "ALREADY_PAID") return c.json({ error: "الفاتورة مدفوعة بالكامل" }, 409)
    if (result.error === "INVALID_AMOUNT") return c.json({ error: `المبلغ يتجاوز المتبقي وهو ${result.remaining.toFixed(2)} ر.س` }, 400)
    return c.json({ error: "تعذر تسجيل الدفعة" }, 400)
  }
  return c.json(result, 201)
})

const cancelPaymentSchema = z.object({ reason: z.string().trim().min(3).max(500) })

purchasesRouter.post("/:id/payments/:paymentId/cancel", zValidator("json", cancelPaymentSchema), async (c) => {
  const orgId = await organizationId(c.req.raw.headers)
  if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const reason = c.req.valid("json").reason
  const result = await withTransaction(async (client) => {
    const current = await client.query("SELECT * FROM purchase_invoices WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL FOR UPDATE", [c.req.param("id"), orgId])
    const purchase = current.rows[0]
    if (!purchase) return { error: "NOT_FOUND" as const }
    const payments = await client.query("SELECT * FROM purchase_invoice_payments WHERE id=$1 AND purchase_invoice_id=$2 AND organization_id=$3 FOR UPDATE", [c.req.param("paymentId"), purchase.id, orgId])
    const payment = payments.rows[0]
    if (!payment) return { error: "PAYMENT_NOT_FOUND" as const }
    if (payment.status === "cancelled") return { error: "ALREADY_CANCELLED" as const }
    const paymentDate = dateOnly(payment.payment_date)
    const periodLock = await activePeriodLock(client, orgId, paymentDate)
    if (periodLock) return { error: "PERIOD_LOCKED" as const, message: lockedPeriodMessage(periodLock) }
    const reversal = reverseRecordedPayment(Number(purchase.total), Number(purchase.paid_amount), Number(payment.amount))
    if (!reversal.ok) return { error: "INVALID_REVERSAL" as const }
    await reverseSourceJournalEntries(client,{organizationId:orgId,sourceType:"purchase_payment",sourceId:String(payment.id),reversalDate:paymentDate,reason})
    const cancelled = await client.query("UPDATE purchase_invoice_payments SET status='cancelled',cancelled_at=NOW(),cancellation_reason=$1,updated_at=NOW() WHERE id=$2 RETURNING *", [reason, payment.id])
    const updated = await client.query("UPDATE purchase_invoices SET paid_amount=$1,payment_status=$2,updated_at=NOW() WHERE id=$3 RETURNING *", [reversal.paid, reversal.status, purchase.id])
    await client.query("INSERT INTO financial_audit_events(organization_id,entity_type,entity_id,action,reason,snapshot) VALUES($1,'purchase_payment',$2,'payment_cancelled',$3,$4)", [orgId, payment.id, reason, JSON.stringify(cancelled.rows[0])])
    return { purchase: updated.rows[0], payment: cancelled.rows[0] }
  })
  if ("error" in result) {
    if (result.error === "PERIOD_LOCKED") return c.json({ error: result.message }, 409)
    const messages = { NOT_FOUND: "فاتورة المشتريات غير موجودة", PAYMENT_NOT_FOUND: "دفعة المشتريات غير موجودة", ALREADY_CANCELLED: "الدفعة ملغاة مسبقًا", INVALID_REVERSAL: "تعذر عكس الدفعة بسبب عدم تطابق رصيدها" } as const
    return c.json({ error: messages[result.error] }, result.error === "NOT_FOUND" || result.error === "PAYMENT_NOT_FOUND" ? 404 : 409)
  }
  return c.json(result)
})
