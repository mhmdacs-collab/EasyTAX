import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { auth } from "../lib/auth"
import { sql, withTransaction } from "../lib/db"
import { activePeriodLock, lockedPeriodMessage } from "../lib/periodLocks"
import { postJournalEntry, reverseSourceJournalEntries } from "../lib/accountingEngine"
import { documentJournal } from "../lib/accountingRules"

const syncRouter = new Hono()

const documentItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  unit: z.string().optional(),
  quantity: z.number().positive().optional(),
  unit_price: z.number().nonnegative(),
  discount_percent: z.number().optional(),
  retention_percent: z.number().optional(),
  subtotal: z.number(),
})

const documentSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  type: z.enum(["tax_invoice", "simplified_invoice", "quotation", "proforma", "receipt_voucher"]),
  status: z.enum(["draft", "issued", "archived", "cancelled"]),
  number: z.string(),
  date: z.string(),
  due_date: z.string().nullish(),
  customer_name: z.string(),
  customer_id: z.string().nullish(),
  customer_vat_number: z.string().nullish(),
  customer_phone: z.string().nullish(),
  customer_email: z.string().nullish(),
  customer_address: z.string().nullish(),
  operation_type: z.string().default("service"),
  purchase_order: z.string().nullish(),
  items: z.array(documentItemSchema),
  subtotal: z.number(),
  discount_amount: z.number(),
  retention_amount: z.number(),
  vat_amount: z.number(),
  total: z.number(),
  vat_rate: z.number(),
  vat_inclusive: z.boolean(),
  payment_method: z.string().nullish(),
  notes: z.string().nullish(),
  terms_and_conditions: z.string().nullish(),
  issued_at: z.string().nullish(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullish(),
  version: z.number().int().positive(),
})

const customerSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  name: z.string(),
  vat_number: z.string().nullish(),
  commercial_registration: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  address: z.string().nullish(),
  notes: z.string().nullish(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullish(),
  version: z.number().int().positive(),
})

const syncPayload = z.object({
  organization_id: z.string(),
  documents: z.array(documentSchema).default([]),
  customers: z.array(customerSchema).default([]),
})

const documentType = (type: z.infer<typeof documentSchema>["type"]): "invoice" | "quotation" | "receipt" => {
  if (type === "quotation" || type === "proforma") return "quotation"
  if (type === "receipt_voucher") return "receipt"
  return "invoice"
}

const documentStatus = (status: z.infer<typeof documentSchema>["status"]): "draft" | "issued" | "cancelled" => {
  if (status === "cancelled" || status === "archived") return "cancelled"
  return status
}

syncRouter.post("/", zValidator("json", syncPayload), async (c) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await (auth.api as any).getSession({ headers: c.req.raw.headers })
  if (!session?.user?.id) return c.json({ error: "غير مصرح" }, 401)

  const body = c.req.valid("json")
  const organizations = await sql`
    SELECT id FROM organizations
    WHERE id = ${body.organization_id}
      AND user_id = ${session.user.id as string}
      AND deleted_at IS NULL
    LIMIT 1
  `
  if (organizations.length === 0) return c.json({ error: "المنشأة غير مرتبطة بهذا الحساب" }, 403)

  if (
    body.documents.some((item) => item.organization_id !== body.organization_id) ||
    body.customers.some((item) => item.organization_id !== body.organization_id)
  ) {
    return c.json({ error: "معرف المنشأة غير متطابق", code: "TENANT_MISMATCH" }, 422)
  }

  const synced = {
    document_ids: [] as string[],
    customer_ids: [] as string[],
    errors: [] as Array<{ entity: "document" | "customer"; id: string; message: string }>,
  }

  for (const customer of body.customers) {
    try {
      const rows = await sql`
        INSERT INTO customers (
          id, organization_id, name, vat_number, commercial_registration,
          phone, email, address, notes, is_active,
          created_at, updated_at, deleted_at, sync_version
        ) VALUES (
          ${customer.id}, ${body.organization_id}, ${customer.name},
          ${customer.vat_number ?? null}, ${customer.commercial_registration ?? null},
          ${customer.phone ?? null}, ${customer.email ?? null},
          ${customer.address ?? null}, ${customer.notes ?? null}, ${customer.is_active},
          ${customer.created_at}, ${customer.updated_at}, ${customer.deleted_at ?? null}, ${customer.version}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          vat_number = EXCLUDED.vat_number,
          commercial_registration = EXCLUDED.commercial_registration,
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          address = EXCLUDED.address,
          notes = EXCLUDED.notes,
          is_active = EXCLUDED.is_active,
          updated_at = EXCLUDED.updated_at,
          deleted_at = EXCLUDED.deleted_at,
          sync_version = EXCLUDED.sync_version
        WHERE customers.organization_id = EXCLUDED.organization_id
          AND customers.sync_version <= EXCLUDED.sync_version
        RETURNING id
      `
      if (rows.length === 0) throw new Error("تعارض ملكية السجل أو وجود نسخة أحدث")
      synced.customer_ids.push(customer.id)
    } catch (error) {
      synced.errors.push({ entity: "customer", id: customer.id, message: error instanceof Error ? error.message : String(error) })
    }
  }

  for (const document of body.documents) {
    try {
      await withTransaction(async (client) => {
        const existing=await client.query("SELECT status,issue_date,type FROM documents WHERE id=$1 AND organization_id=$2 FOR UPDATE",[document.id,body.organization_id])
        if(document.status!=="draft"){
          const lock=await activePeriodLock(client,body.organization_id,document.date.slice(0,10))
          if(lock)throw new Error(lockedPeriodMessage(lock))
        }
        const result = await client.query(
          `INSERT INTO documents (
             id, organization_id, customer_id, type, number, issue_date, due_date,
             status, prices_include_tax, subtotal, tax_total, retention_total,
             total, collected_total, due_total, notes,
             created_at, updated_at, deleted_at, sync_version
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7,
             $8, $9, $10, $11, $12,
             $13, 0, $13, $14,
             $15, $16, $17, $18
           )
           ON CONFLICT (id) DO UPDATE SET
             customer_id = EXCLUDED.customer_id,
             type = EXCLUDED.type,
             number = EXCLUDED.number,
             issue_date = EXCLUDED.issue_date,
             due_date = EXCLUDED.due_date,
             status = EXCLUDED.status,
             prices_include_tax = EXCLUDED.prices_include_tax,
             subtotal = EXCLUDED.subtotal,
             tax_total = EXCLUDED.tax_total,
             retention_total = EXCLUDED.retention_total,
             total = EXCLUDED.total,
             due_total = EXCLUDED.due_total,
             notes = EXCLUDED.notes,
             updated_at = EXCLUDED.updated_at,
             deleted_at = EXCLUDED.deleted_at,
             sync_version = EXCLUDED.sync_version
           WHERE documents.organization_id = EXCLUDED.organization_id
             AND documents.sync_version <= EXCLUDED.sync_version
           RETURNING id`,
          [
            document.id, body.organization_id, document.customer_id ?? null,
            documentType(document.type), document.number, document.date, document.due_date ?? null,
            documentStatus(document.status), document.vat_inclusive, document.subtotal,
            document.vat_amount, document.retention_amount, document.total, document.notes ?? null,
            document.created_at, document.updated_at, document.deleted_at ?? null, document.version,
          ],
        )
        if (result.rowCount === 0) throw new Error("تعارض ملكية السجل أو وجود نسخة أحدث")

        await client.query("DELETE FROM document_items WHERE document_id = $1", [document.id])
        for (const [index, item] of document.items.entries()) {
          const quantity = item.quantity ?? 1
          const share = document.subtotal > 0 ? item.subtotal / document.subtotal : 0
          const tax = document.vat_amount * share
          const retention = document.retention_amount * share
          const documentDiscount = document.discount_amount * share
          const itemDiscount = quantity * item.unit_price * ((item.discount_percent ?? 0) / 100)
          await client.query(
            `INSERT INTO document_items (
               id, document_id, description, quantity, unit_price, discount,
               tax_rate, retention_rate, line_subtotal, line_tax,
               line_retention, line_total, sort_order
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
            [
              item.id, document.id, item.description, quantity, item.unit_price,
              itemDiscount, document.vat_rate, item.retention_percent ?? 0,
              item.subtotal, tax, retention, item.subtotal - documentDiscount + tax - retention, index,
            ],
          )
        }
        const normalizedType=documentType(document.type),normalizedStatus=documentStatus(document.status)
        if(normalizedType==="invoice"&&normalizedStatus==="issued")await postJournalEntry(client,{organizationId:body.organization_id,entryDate:document.date.slice(0,10),sourceType:"document",sourceId:document.id,idempotencyKey:`document:${document.id}:issued`,description:`فاتورة ضريبية رقم ${document.number}`,customerId:document.customer_id??null,lines:documentJournal({type:"invoice",total:document.total,taxTotal:document.vat_amount,retentionTotal:document.retention_amount})})
        if(normalizedType==="invoice"&&normalizedStatus==="cancelled"&&existing.rows[0]?.status==="issued")await reverseSourceJournalEntries(client,{organizationId:body.organization_id,sourceType:"document",sourceId:document.id,reversalDate:document.date.slice(0,10),reason:"إلغاء مستند متزامن"})
      })
      synced.document_ids.push(document.id)
    } catch (error) {
      synced.errors.push({ entity: "document", id: document.id, message: error instanceof Error ? error.message : String(error) })
    }
  }

  return c.json({ ok: synced.errors.length === 0, synced })
})

export { syncRouter }
