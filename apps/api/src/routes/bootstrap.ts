import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { sql } from "../lib/db"
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
      o.commercial_registration,
      o.city,
      o.district,
      o.street,
      o.building_number,
      o.postal_code,
      o.onboarding_completed_at,
      o.status AS organization_status,
      s.id AS subscription_id,
      s.plan,
      s.status AS subscription_status,
      s.starts_at,
      s.expires_at,
      CASE
        WHEN s.status = 'suspended' THEN 'suspended'
        WHEN s.status = 'inactive' THEN 'inactive'
        WHEN s.expires_at IS NOT NULL AND s.expires_at < NOW() THEN 'expired'
        WHEN s.status = 'active' THEN 'active'
        ELSE 'inactive'
      END AS effective_status
    FROM organizations o
    LEFT JOIN subscriptions s
      ON s.organization_id = o.id
    WHERE o.user_id = ${session.user.id as string}
      AND o.deleted_at IS NULL
    ORDER BY s.created_at DESC NULLS LAST
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
    commercial_registration: string | null
    city: string | null
    district: string | null
    street: string | null
    building_number: string | null
    postal_code: string | null
    onboarding_completed_at: string | null
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
    },
    organization: {
      id: row.organization_id,
      business_name: row.business_name,
      vat_number: row.vat_number,
      phone: row.phone,
      email: row.email,
      commercial_registration: row.commercial_registration,
      city: row.city,
      district: row.district,
      street: row.street,
      building_number: row.building_number,
      postal_code: row.postal_code,
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
  commercial_registration: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  city: z.string().optional(),
  district: z.string().optional(),
  street: z.string().optional(),
  building_number: z.string().optional(),
  postal_code: z.string().optional(),
})

bootstrapRouter.post("/onboarding-complete", zValidator("json", completeOnboardingSchema), async (c) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await (auth.api as any).getSession({ headers: c.req.raw.headers })
  if (!session?.user?.id) return c.json({ error: "غير مصرح" }, 401)

  const body = c.req.valid("json")
  const rows = await sql`
    UPDATE organizations
    SET
      commercial_registration = ${body.commercial_registration || null},
      phone = ${body.phone || null},
      email = ${body.email || null},
      city = ${body.city || null},
      district = ${body.district || null},
      street = ${body.street || null},
      building_number = ${body.building_number || null},
      postal_code = ${body.postal_code || null},
      onboarding_completed_at = COALESCE(onboarding_completed_at, NOW()),
      updated_at = NOW()
    WHERE user_id = ${session.user.id as string}
      AND deleted_at IS NULL
    RETURNING id, onboarding_completed_at
  `

  if (rows.length === 0) return c.json({ error: "لا توجد منشأة مرتبطة بالحساب." }, 404)
  return c.json({ success: true, ...rows[0] })
})

export { bootstrapRouter }
