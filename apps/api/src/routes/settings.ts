import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { auth } from "../lib/auth"
import { sql, withTransaction } from "../lib/db"

export const settingsRouter = new Hono()

async function sessionUserId(headers: Headers): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await (auth.api as any).getSession({ headers })
  return session?.user?.id ?? null
}

settingsRouter.get("/", async (c) => {
  const userId = await sessionUserId(c.req.raw.headers)
  if (!userId) return c.json({ error: "غير مصرح" }, 401)
  const organizations = await sql`
    SELECT id, business_name, vat_number, commercial_registration, phone, email,
      show_phone_on_documents, show_email_on_documents, country, country_code,
      city, district, street, building_number, postal_code, additional_number, short_address,
      bank_enabled, bank_name, bank_account_name, iban,
      logo_url, stamp_url, signature_url,
      stamp_on_invoice, stamp_on_quotation, stamp_on_receipt,
      signature_on_invoice, signature_on_quotation, signature_on_receipt,
      prices_include_tax, retention_enabled, invoice_default_notes,
      quotation_default_notes, receipt_default_notes, receipt_default_phrase
    FROM organizations WHERE user_id = ${userId} AND deleted_at IS NULL LIMIT 1`
  if (!organizations[0]) return c.json({ error: "المنشأة غير موجودة" }, 404)
  const organization = organizations[0] as Record<string, unknown>
  const organizationId = organization.id as string
  const [paymentMethods, quotationTerms, sequences] = await Promise.all([
    sql`SELECT id, name, is_collected, is_default, is_active FROM payment_methods WHERE organization_id = ${organizationId} ORDER BY created_at`,
    sql`SELECT id, text, sort_order, is_active FROM quotation_terms WHERE organization_id = ${organizationId} ORDER BY sort_order, created_at`,
    sql`SELECT document_type, next_number FROM document_sequences WHERE organization_id = ${organizationId} ORDER BY document_type`,
  ])
  return c.json({ organization, payment_methods: paymentMethods, quotation_terms: quotationTerms, sequences })
})

const settingsSchema = z.object({
  commercial_registration: z.string().trim().min(1), phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  show_phone_on_documents: z.boolean(), show_email_on_documents: z.boolean(),
  city: z.string().trim().min(1), district: z.string().trim().min(1), street: z.string().trim().min(1),
  building_number: z.string().regex(/^\d{4}$/, "رقم المبنى يجب أن يكون 4 أرقام"),
  postal_code: z.string().regex(/^\d{5}$/, "الرمز البريدي يجب أن يكون 5 أرقام"),
  additional_number: z.string().regex(/^\d{4}$/).optional().or(z.literal("")), short_address: z.string().optional(),
  bank_enabled: z.boolean(), bank_name: z.string().optional(), bank_account_name: z.string().optional(), iban: z.string().optional(),
  prices_include_tax: z.boolean(), retention_enabled: z.boolean(),
  invoice_default_notes: z.string().optional(), quotation_default_notes: z.string().optional(),
  receipt_default_notes: z.string().optional(), receipt_default_phrase: z.string().optional(),
  stamp_on_invoice: z.boolean(), stamp_on_quotation: z.boolean(), stamp_on_receipt: z.boolean(),
  signature_on_invoice: z.boolean(), signature_on_quotation: z.boolean(), signature_on_receipt: z.boolean(),
  payment_methods: z.array(z.object({ name: z.string().trim().min(1), is_collected: z.boolean(), is_default: z.boolean(), is_active: z.boolean() })),
  quotation_terms: z.array(z.string().trim().min(1)),
  sequences: z.object({ invoice: z.number().int().positive(), quotation: z.number().int().positive(), receipt: z.number().int().positive() }),
}).superRefine((value, ctx) => {
  if (!value.bank_enabled) return
  for (const key of ["bank_name", "bank_account_name", "iban"] as const) {
    if (!value[key]?.trim()) ctx.addIssue({ code: "custom", path: [key], message: "هذا الحقل مطلوب" })
  }
})

settingsRouter.put("/", zValidator("json", settingsSchema), async (c) => {
  const userId = await sessionUserId(c.req.raw.headers)
  if (!userId) return c.json({ error: "غير مصرح" }, 401)
  const body = c.req.valid("json")
  const saved = await withTransaction(async (client) => {
    const result = await client.query(`UPDATE organizations SET
      commercial_registration=$1, phone=$2, email=$3, show_phone_on_documents=$4, show_email_on_documents=$5,
      city=$6, district=$7, street=$8, building_number=$9, postal_code=$10, additional_number=$11, short_address=$12,
      country='Saudi Arabia', country_code='SA', bank_enabled=$13, bank_name=$14, bank_account_name=$15, iban=$16,
      prices_include_tax=$17, retention_enabled=$18, invoice_default_notes=$19, quotation_default_notes=$20,
      receipt_default_notes=$21, receipt_default_phrase=$22,
      stamp_on_invoice=$23, stamp_on_quotation=$24, stamp_on_receipt=$25,
      signature_on_invoice=$26, signature_on_quotation=$27, signature_on_receipt=$28,
      document_settings_version=document_settings_version+1, updated_at=NOW()
      WHERE user_id=$29 AND deleted_at IS NULL RETURNING id`, [
      body.commercial_registration, body.phone || null, body.email || null, body.show_phone_on_documents, body.show_email_on_documents,
      body.city, body.district, body.street, body.building_number, body.postal_code, body.additional_number || null, body.short_address || null,
      body.bank_enabled, body.bank_enabled ? body.bank_name : null, body.bank_enabled ? body.bank_account_name : null,
      body.bank_enabled ? body.iban : null, body.prices_include_tax, body.retention_enabled, body.invoice_default_notes || null,
      body.quotation_default_notes || null, body.receipt_default_notes || null, body.receipt_default_phrase || null,
      body.stamp_on_invoice, body.stamp_on_quotation, body.stamp_on_receipt,
      body.signature_on_invoice, body.signature_on_quotation, body.signature_on_receipt, userId])
    if (!result.rows[0]) return false
    const organizationId = result.rows[0].id as string
    await client.query("DELETE FROM payment_methods WHERE organization_id=$1", [organizationId])
    for (const method of body.payment_methods) await client.query(
      "INSERT INTO payment_methods(organization_id,name,is_collected,is_default,is_active) VALUES($1,$2,$3,$4,$5)",
      [organizationId, method.name, method.is_collected, method.is_default, method.is_active])
    await client.query("DELETE FROM quotation_terms WHERE organization_id=$1", [organizationId])
    for (const [sortOrder, term] of body.quotation_terms.entries()) await client.query(
      "INSERT INTO quotation_terms(organization_id,text,sort_order) VALUES($1,$2,$3)", [organizationId, term, sortOrder])
    for (const [type, nextNumber] of Object.entries(body.sequences)) await client.query(
      `INSERT INTO document_sequences(organization_id,document_type,next_number) VALUES($1,$2,$3)
       ON CONFLICT(organization_id,document_type) DO UPDATE SET next_number=EXCLUDED.next_number`, [organizationId, type, nextNumber])
    return true
  })
  return saved ? c.json({ ok: true }) : c.json({ error: "المنشأة غير موجودة" }, 404)
})
