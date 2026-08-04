import { Hono } from "hono"
import { sql } from "../lib/db"
import { auth } from "../lib/auth"

const subscriptionRouter = new Hono()

subscriptionRouter.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store")
  c.header("Pragma", "no-cache")
  await next()
})

const getUserId = async (headers: Headers): Promise<string | null> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await (auth.api as any).getSession({ headers })
  return session?.user?.id ?? null
}

subscriptionRouter.get("/status", async (c) => {
  const userId = await getUserId(c.req.raw.headers)
  if (!userId) return c.json({ error: "غير مصرح" }, 401)

  const rows = await sql`
    SELECT
      vat_number, business_name, status,
      subscription_starts_at AS starts_at,
      subscription_expires_at AS expires_at,
      CASE
        WHEN status = 'suspended' THEN 'suspended'
        WHEN status = 'inactive' THEN 'inactive'
        WHEN subscription_expires_at < NOW() THEN 'expired'
        ELSE 'active'
      END AS effective_status,
      GREATEST(0, CEIL(EXTRACT(EPOCH FROM (subscription_expires_at - NOW())) / 86400.0)::int) AS remaining_days
    FROM organizations
    WHERE user_id = ${userId} AND deleted_at IS NULL
    LIMIT 1
  `

  if (rows.length === 0) {
    return c.json({
      vat_number: null, business_name: null, stored_status: null,
      effective_status: "inactive", starts_at: null, expires_at: null, remaining_days: null,
    })
  }

  const row = rows[0] as Record<string, unknown>
  return c.json({
    vat_number: row.vat_number,
    business_name: row.business_name,
    stored_status: row.status,
    effective_status: row.effective_status,
    starts_at: row.starts_at,
    expires_at: row.expires_at,
    remaining_days: row.remaining_days,
  })
})

subscriptionRouter.get("/me", async (c) => {
  const userId = await getUserId(c.req.raw.headers)
  if (!userId) return c.json({ error: "غير مصرح" }, 401)

  const rows = await sql`
    SELECT vat_number, business_name, phone
    FROM organizations
    WHERE user_id = ${userId} AND deleted_at IS NULL
    LIMIT 1
  `
  return c.json({ subscription: rows[0] ?? null })
})

export { subscriptionRouter }
