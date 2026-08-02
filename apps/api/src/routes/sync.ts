import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { sql } from "../lib/db"

const syncRouter = new Hono()

// ── Schemas ───────────────────────────────────────────────────────────────────
const documentItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  unit: z.string().optional(),
  quantity: z.number().optional(),
  unit_price: z.number(),
  discount_percent: z.number().optional(),
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
  version: z.number(),
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
  version: z.number(),
})

const syncPayload = z.object({
  organization_id: z.string(),
  documents: z.array(documentSchema).optional().default([]),
  customers: z.array(customerSchema).optional().default([]),
})

// ── POST /api/v1/sync ────────────────────────────────────────────────────────
syncRouter.post("/", zValidator("json", syncPayload), async (c) => {
  const user = c.get("user" as never) as { id: string } | undefined
  if (!user) return c.json({ error: "Unauthorized" }, 401)

  const { organization_id, documents, customers } = c.req.valid("json")
  const synced = { documents: 0, customers: 0, errors: [] as string[] }

  // Ensure documents table exists (idempotent)
  await sql`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      number TEXT NOT NULL,
      date TEXT NOT NULL,
      due_date TEXT,
      customer_name TEXT NOT NULL,
      customer_id TEXT,
      customer_vat_number TEXT,
      customer_phone TEXT,
      customer_email TEXT,
      customer_address TEXT,
      operation_type TEXT DEFAULT 'service',
      purchase_order TEXT,
      items JSONB NOT NULL DEFAULT '[]',
      subtotal NUMERIC NOT NULL DEFAULT 0,
      discount_amount NUMERIC NOT NULL DEFAULT 0,
      retention_amount NUMERIC NOT NULL DEFAULT 0,
      vat_amount NUMERIC NOT NULL DEFAULT 0,
      total NUMERIC NOT NULL DEFAULT 0,
      vat_rate NUMERIC NOT NULL DEFAULT 15,
      vat_inclusive BOOLEAN NOT NULL DEFAULT false,
      payment_method TEXT,
      notes TEXT,
      terms_and_conditions TEXT,
      issued_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      version INTEGER NOT NULL DEFAULT 1
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      vat_number TEXT,
      commercial_registration TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      notes TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      version INTEGER NOT NULL DEFAULT 1
    )
  `

  for (const doc of documents) {
    try {
      await sql`
        INSERT INTO documents (
          id, organization_id, type, status, number, date, due_date,
          customer_name, customer_id, customer_vat_number, customer_phone,
          customer_email, customer_address, operation_type, purchase_order,
          items, subtotal, discount_amount, retention_amount, vat_amount, total,
          vat_rate, vat_inclusive, payment_method, notes, terms_and_conditions,
          issued_at, created_at, updated_at, deleted_at, version
        ) VALUES (
          ${doc.id}, ${organization_id}, ${doc.type}, ${doc.status}, ${doc.number},
          ${doc.date}, ${doc.due_date ?? null}, ${doc.customer_name},
          ${doc.customer_id ?? null}, ${doc.customer_vat_number ?? null},
          ${doc.customer_phone ?? null}, ${doc.customer_email ?? null},
          ${doc.customer_address ?? null}, ${doc.operation_type},
          ${doc.purchase_order ?? null},
          ${JSON.stringify(doc.items)}::jsonb,
          ${doc.subtotal}, ${doc.discount_amount}, ${doc.retention_amount},
          ${doc.vat_amount}, ${doc.total}, ${doc.vat_rate}, ${doc.vat_inclusive},
          ${doc.payment_method ?? null}, ${doc.notes ?? null},
          ${doc.terms_and_conditions ?? null}, ${doc.issued_at ?? null},
          ${doc.created_at}, ${doc.updated_at}, ${doc.deleted_at ?? null}, ${doc.version}
        )
        ON CONFLICT (id) DO UPDATE SET
          status            = EXCLUDED.status,
          number            = EXCLUDED.number,
          items             = EXCLUDED.items,
          subtotal          = EXCLUDED.subtotal,
          discount_amount   = EXCLUDED.discount_amount,
          retention_amount  = EXCLUDED.retention_amount,
          vat_amount        = EXCLUDED.vat_amount,
          total             = EXCLUDED.total,
          notes             = EXCLUDED.notes,
          issued_at         = EXCLUDED.issued_at,
          updated_at        = EXCLUDED.updated_at,
          deleted_at        = EXCLUDED.deleted_at,
          version           = EXCLUDED.version
        WHERE documents.version < EXCLUDED.version
      `
      synced.documents++
    } catch (err) {
      synced.errors.push(`doc:${doc.id} — ${String(err)}`)
    }
  }

  for (const cust of customers) {
    try {
      await sql`
        INSERT INTO customers (
          id, organization_id, name, vat_number, commercial_registration,
          phone, email, address, notes, is_active,
          created_at, updated_at, deleted_at, version
        ) VALUES (
          ${cust.id}, ${organization_id}, ${cust.name},
          ${cust.vat_number ?? null}, ${cust.commercial_registration ?? null},
          ${cust.phone ?? null}, ${cust.email ?? null},
          ${cust.address ?? null}, ${cust.notes ?? null}, ${cust.is_active},
          ${cust.created_at}, ${cust.updated_at},
          ${cust.deleted_at ?? null}, ${cust.version}
        )
        ON CONFLICT (id) DO UPDATE SET
          name       = EXCLUDED.name,
          vat_number = EXCLUDED.vat_number,
          phone      = EXCLUDED.phone,
          email      = EXCLUDED.email,
          address    = EXCLUDED.address,
          is_active  = EXCLUDED.is_active,
          updated_at = EXCLUDED.updated_at,
          deleted_at = EXCLUDED.deleted_at,
          version    = EXCLUDED.version
        WHERE customers.version < EXCLUDED.version
      `
      synced.customers++
    } catch (err) {
      synced.errors.push(`cust:${cust.id} — ${String(err)}`)
    }
  }

  return c.json({ ok: true, synced })
})

export { syncRouter }
