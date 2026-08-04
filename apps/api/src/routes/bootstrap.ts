import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { sql, withTransaction } from "../lib/db"
import { auth } from "../lib/auth"

const bootstrapRouter = new Hono()

bootstrapRouter.get("/me", async (c) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await (auth.api as any).getSession({ headers: c.req.raw.headers })
  if (!session?.user?.id) {
    return c.json({ error: "غير مصرح" }, 401)
  }

  const rows = await sql`
    SELECT
      o.id AS organization_id,
      o.business_name,
      o.vat_number,
      o.phone,
      o.email,
      o.show_phone_on_documents,
      o.show_email_on_documents,
      o.country,
      o.country_code,
      o.commercial_registration,
      o.city,
      o.district,
      o.street,
      o.building_number,
      o.postal_code,
      o.short_address,
      o.bank_enabled,
      o.bank_name,
      o.bank_account_name,
      o.iban,
      o.logo_url,
      o.stamp_url,
      o.signature_url,
      o.stamp_on_invoice,
      o.stamp_on_quotation,
      o.stamp_on_receipt,
      o.signature_on_invoice,
      o.signature_on_quotation,
      o.signature_on_receipt,
      o.prices_include_tax,
      o.retention_enabled,
      o.onboarding_completed_at,
      u.must_change_password,
      EXISTS (
        SELECT 1 FROM account a
        WHERE a.user_id = u.id
          AND a.provider_id = 'credential'
          AND a.updated_at > a.created_at
      ) AS password_changed,
      o.status AS organization_status,
      o.id AS subscription_id,
      o.plan,
      o.status AS subscription_status,
      o.subscription_starts_at AS starts_at,
      o.subscription_expires_at AS expires_at,
      CASE
        WHEN o.status = 'suspended' THEN 'suspended'
        WHEN o.status = 'inactive' THEN 'inactive'
        WHEN o.subscription_expires_at < NOW() THEN 'expired'
        WHEN o.status = 'active' THEN 'active'
        ELSE 'inactive'
      END AS effective_status
    FROM organizations o
    JOIN "user" u ON u.id = o.user_id
    WHERE o.user_id = ${session.user.id as string}
      AND o.deleted_at IS NULL
    LIMIT 1
  `

  if (rows.length === 0) {
    return c.json({ error: "لا توجد منشأة مرتبطة بهذا الحساب." }, 404)
  }

  const row = rows[0] as {
    organization_id: string
    business_name: string
    vat_number: string
    phone: string | null
    email: string | null
    show_phone_on_documents: boolean
    show_email_on_documents: boolean
    country: string
    country_code: string
    commercial_registration: string | null
    city: string | null
    district: string | null
    street: string | null
    building_number: string | null
    postal_code: string | null
    short_address: string | null
    bank_enabled: boolean
    bank_name: string | null
    bank_account_name: string | null
    iban: string | null
    logo_url: string | null
    stamp_url: string | null
    signature_url: string | null
    stamp_on_invoice: boolean
    stamp_on_quotation: boolean
    stamp_on_receipt: boolean
    signature_on_invoice: boolean
    signature_on_quotation: boolean
    signature_on_receipt: boolean
    prices_include_tax: boolean | null
    retention_enabled: boolean
    onboarding_completed_at: string | null
    must_change_password: boolean
    password_changed: boolean
    organization_status: string
    subscription_id: string | null
    plan: string | null
    subscription_status: string | null
    starts_at: string | null
    expires_at: string | null
    effective_status: string
  }

  return c.json({
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: "owner",
      must_change_password: row.must_change_password,
      password_changed: !row.must_change_password || row.password_changed,
    },
    organization: {
      id: row.organization_id,
      business_name: row.business_name,
      vat_number: row.vat_number,
      phone: row.phone,
      email: row.email,
      show_phone_on_documents: row.show_phone_on_documents,
      show_email_on_documents: row.show_email_on_documents,
      country: row.country,
      country_code: row.country_code,
      commercial_registration: row.commercial_registration,
      city: row.city,
      district: row.district,
      street: row.street,
      building_number: row.building_number,
      postal_code: row.postal_code,
      short_address: row.short_address,
      bank_enabled: row.bank_enabled,
      bank_name: row.bank_name,
      bank_account_name: row.bank_account_name,
      iban: row.iban,
      logo_url: row.logo_url,
      stamp_url: row.stamp_url,
      signature_url: row.signature_url,
      stamp_on_invoice: row.stamp_on_invoice,
      stamp_on_quotation: row.stamp_on_quotation,
      stamp_on_receipt: row.stamp_on_receipt,
      signature_on_invoice: row.signature_on_invoice,
      signature_on_quotation: row.signature_on_quotation,
      signature_on_receipt: row.signature_on_receipt,
      prices_include_tax: row.prices_include_tax,
      retention_enabled: row.retention_enabled,
      onboarding_completed_at: row.onboarding_completed_at,
      status: row.organization_status,
    },
    subscription: {
      id: row.subscription_id,
      plan: row.plan,
      status: row.subscription_status,
      effective_status: row.effective_status,
      starts_at: row.starts_at,
      expires_at: row.expires_at,
    },
  })
})

const completeOnboardingSchema = z.object({
  commercial_registration: z.string().trim().min(1, "هذا الحقل مطلوب"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  show_phone_on_documents: z.boolean(),
  show_email_on_documents: z.boolean(),
  city: z.string().trim().min(1, "هذا الحقل مطلوب"),
  district: z.string().trim().min(1, "هذا الحقل مطلوب"),
  street: z.string().trim().min(1, "هذا الحقل مطلوب"),
  building_number: z.string().optional(),
  postal_code: z.string().optional(),
  short_address: z.string().optional(),
  bank_enabled: z.boolean(),
  bank_name: z.string().optional(),
  bank_account_name: z.string().optional(),
  iban: z.string().optional(),
  logo_url: z.string().optional(),
  stamp_url: z.string().optional(),
  signature_url: z.string().optional(),
  stamp_on_invoice: z.boolean(),
  stamp_on_quotation: z.boolean(),
  stamp_on_receipt: z.boolean(),
  signature_on_invoice: z.boolean(),
  signature_on_quotation: z.boolean(),
  signature_on_receipt: z.boolean(),
  prices_include_tax: z.boolean(),
  retention_enabled: z.boolean(),
  payment_methods: z.array(z.object({
    name: z.string().trim().min(1),
    is_collected: z.boolean(),
    is_default: z.boolean(),
    is_active: z.boolean(),
  })).min(1),
  quotation_terms: z.array(z.string().trim().min(1)).default([]),
}).superRefine((value, ctx) => {
  if (!value.bank_enabled) return
  for (const field of ["bank_name", "bank_account_name", "iban"] as const) {
    if (!value[field]?.trim()) ctx.addIssue({ code: "custom", path: [field], message: "هذا الحقل مطلوب" })
  }
})

bootstrapRouter.post("/onboarding-complete", zValidator("json", completeOnboardingSchema), async (c) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await (auth.api as any).getSession({ headers: c.req.raw.headers })
  if (!session?.user?.id) return c.json({ error: "غير مصرح" }, 401)

  const body = c.req.valid("json")
  const result = await withTransaction(async (client) => {
    const passwordState = await client.query(
      `SELECT u.must_change_password,
              EXISTS (
                SELECT 1 FROM account a
                WHERE a.user_id = u.id
                  AND a.provider_id = 'credential'
                  AND a.updated_at > a.created_at
              ) AS password_changed
       FROM "user" u WHERE u.id = $1 FOR UPDATE`,
      [session.user.id as string],
    )
    const state = passwordState.rows[0] as
      | { must_change_password: boolean; password_changed: boolean }
      | undefined
    if (!state || (state.must_change_password && !state.password_changed)) {
      return { error: "PASSWORD_CHANGE_REQUIRED" as const }
    }

    const updated = await client.query(
      `UPDATE organizations SET
        commercial_registration = $1, phone = $2, email = $3,
        city = $4, district = $5, street = $6, building_number = $7,
        postal_code = $8, short_address = $9,
        country = 'Saudi Arabia', country_code = 'SA',
        bank_enabled = $10, bank_name = $11, bank_account_name = $12, iban = $13,
        logo_url = $14, stamp_url = $15, signature_url = $16,
        stamp_on_invoice = $17, stamp_on_quotation = $18, stamp_on_receipt = $19,
        signature_on_invoice = $20, signature_on_quotation = $21, signature_on_receipt = $22,
        tax_name = 'ضريبة القيمة المضافة', tax_rate = 15, tax_code = 'S',
        prices_include_tax = $23, retention_enabled = $24,
        show_phone_on_documents = $25, show_email_on_documents = $26,
        onboarding_completed_at = COALESCE(onboarding_completed_at, NOW()), updated_at = NOW()
       WHERE user_id = $27 AND deleted_at IS NULL
       RETURNING id, onboarding_completed_at`,
      [body.commercial_registration, body.phone || null, body.email || null,
        body.city, body.district, body.street, body.building_number || null,
        body.postal_code || null, body.short_address || null,
        body.bank_enabled, body.bank_enabled ? body.bank_name : null,
        body.bank_enabled ? body.bank_account_name : null, body.bank_enabled ? body.iban : null,
        body.logo_url || null, body.stamp_url || null, body.signature_url || null,
        Boolean(body.stamp_url && body.stamp_on_invoice), Boolean(body.stamp_url && body.stamp_on_quotation),
        Boolean(body.stamp_url && body.stamp_on_receipt), Boolean(body.signature_url && body.signature_on_invoice),
        Boolean(body.signature_url && body.signature_on_quotation), Boolean(body.signature_url && body.signature_on_receipt),
        body.prices_include_tax, body.retention_enabled,
        body.show_phone_on_documents, body.show_email_on_documents, session.user.id as string],
    )
    if (updated.rowCount === 0) return { error: "ORGANIZATION_NOT_FOUND" as const }
    const organizationId = updated.rows[0].id as string
    await client.query("DELETE FROM payment_methods WHERE organization_id = $1", [organizationId])
    for (const method of body.payment_methods) {
      await client.query(
        `INSERT INTO payment_methods (organization_id, name, is_collected, is_default, is_active)
         VALUES ($1, $2, $3, $4, $5)`,
        [organizationId, method.name, method.is_collected, method.is_default, method.is_active],
      )
    }
    await client.query("DELETE FROM quotation_terms WHERE organization_id = $1", [organizationId])
    for (const [index, term] of body.quotation_terms.entries()) {
      await client.query(
        "INSERT INTO quotation_terms (organization_id, text, sort_order) VALUES ($1, $2, $3)",
        [organizationId, term, index],
      )
    }
    await client.query(
      `UPDATE "user" SET must_change_password = FALSE, updated_at = NOW() WHERE id = $1`,
      [session.user.id as string],
    )
    return { data: updated.rows[0] }
  })

  if ("error" in result) {
    if (result.error === "PASSWORD_CHANGE_REQUIRED") {
      return c.json({ error: "يجب تغيير كلمة المرور المؤقتة أولاً.", code: result.error }, 409)
    }
    return c.json({ error: "لا توجد منشأة مرتبطة بالحساب.", code: result.error }, 404)
  }
  return c.json({ success: true, ...result.data })
})

export { bootstrapRouter }
