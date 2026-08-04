import { Hono } from "hono"
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
      o.status AS organization_status,
      ou.role,
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
    FROM organization_users ou
    INNER JOIN organizations o
      ON o.id = ou.organization_id AND o.deleted_at IS NULL
    LEFT JOIN subscriptions s
      ON s.organization_id = o.id
    WHERE ou.user_id = ${session.user.id as string}
      AND ou.deleted_at IS NULL
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
    organization_status: string
    role: string
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
      role: row.role,
    },
    organization: {
      id: row.organization_id,
      business_name: row.business_name,
      vat_number: row.vat_number,
      phone: row.phone,
      email: row.email,
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

export { bootstrapRouter }
