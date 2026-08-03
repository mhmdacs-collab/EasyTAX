import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { sql } from "../lib/db"
import { auth } from "../lib/auth"

type SessionUser = {
  id: string
  email?: string
}

const adminRouter = new Hono()

const ok = <T>(data: T) => ({ ok: true as const, data })
const fail = (message: string, code: string) => ({ ok: false as const, error: { code, message } })

const getSessionUser = async (headers: Headers): Promise<SessionUser | null> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await (auth.api as any).getSession({ headers }) as { user?: SessionUser } | null
  if (!session?.user?.id) return null
  return session.user
}

const requireAdminUser = async (headers: Headers): Promise<{ user: SessionUser } | null> => {
  const user = await getSessionUser(headers)
  if (!user) return null

  const rows = await sql`SELECT user_id FROM admin_users WHERE user_id = ${user.id} LIMIT 1`
  if (rows.length === 0) return null
  return { user }
}

adminRouter.get("/summary", async (c) => {
  const authz = await requireAdminUser(c.req.raw.headers)
  if (!authz) return c.json(fail("غير مصرح لك بالوصول.", "FORBIDDEN"), 403)

  const rows = await sql`
    SELECT
      COUNT(*)::int AS total_subscribers,
      COUNT(*) FILTER (
        WHERE status = 'active' AND (expires_at IS NULL OR expires_at >= NOW())
      )::int AS active_subscriptions,
      COUNT(*) FILTER (
        WHERE expires_at IS NOT NULL AND expires_at < NOW()
      )::int AS expired_subscriptions,
      COUNT(*) FILTER (
        WHERE status = 'active'
          AND expires_at IS NOT NULL
          AND expires_at >= NOW()
          AND expires_at < NOW() + INTERVAL '30 days'
      )::int AS expiring_in_30_days
    FROM subscriptions
  `

  const row = rows[0] as {
    total_subscribers: number
    active_subscriptions: number
    expired_subscriptions: number
    expiring_in_30_days: number
  }

  return c.json(ok({
    total_subscribers: row?.total_subscribers ?? 0,
    active_subscriptions: row?.active_subscriptions ?? 0,
    expired_subscriptions: row?.expired_subscriptions ?? 0,
    expiring_in_30_days: row?.expiring_in_30_days ?? 0,
  }))
})

const listQuerySchema = z.object({
  q: z.string().trim().optional(),
})

adminRouter.get("/subscriptions", zValidator("query", listQuerySchema), async (c) => {
  const authz = await requireAdminUser(c.req.raw.headers)
  if (!authz) return c.json(fail("غير مصرح لك بالوصول.", "FORBIDDEN"), 403)

  const { q } = c.req.valid("query")
  const search = q?.length ? `%${q}%` : null

  const rows = search
    ? await sql`
      SELECT
        id,
        business_name,
        vat_number,
        phone,
        plan,
        status,
        starts_at,
        expires_at,
        CASE
          WHEN status = 'suspended' THEN 'suspended'
          WHEN status = 'inactive' THEN 'inactive'
          WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 'expired'
          WHEN status = 'active' AND (expires_at IS NULL OR expires_at >= NOW()) THEN 'active'
          ELSE status
        END AS derived_status,
        CASE
          WHEN expires_at IS NULL THEN NULL
          ELSE CEIL(EXTRACT(EPOCH FROM (expires_at - NOW())) / 86400.0)::int
        END AS remaining_days
      FROM subscriptions
      WHERE business_name ILIKE ${search} OR vat_number ILIKE ${search}
      ORDER BY expires_at ASC NULLS LAST
    `
    : await sql`
      SELECT
        id,
        business_name,
        vat_number,
        phone,
        plan,
        status,
        starts_at,
        expires_at,
        CASE
          WHEN status = 'suspended' THEN 'suspended'
          WHEN status = 'inactive' THEN 'inactive'
          WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 'expired'
          WHEN status = 'active' AND (expires_at IS NULL OR expires_at >= NOW()) THEN 'active'
          ELSE status
        END AS derived_status,
        CASE
          WHEN expires_at IS NULL THEN NULL
          ELSE CEIL(EXTRACT(EPOCH FROM (expires_at - NOW())) / 86400.0)::int
        END AS remaining_days
      FROM subscriptions
      ORDER BY expires_at ASC NULLS LAST
    `

  return c.json(ok(rows))
})

const createSubscriptionSchema = z.object({
  business_name: z.string().min(2, "اسم المنشأة مطلوب"),
  vat_number: z.string().length(15, "الرقم الضريبي يجب أن يكون 15 رقماً").regex(/^\d+$/, "أرقام فقط"),
  phone: z.string().min(9, "رقم الجوال غير صالح"),
  plan: z.string().min(1, "الباقة مطلوبة"),
  duration_days: z.union([
    z.literal(30),
    z.literal(90),
    z.literal(180),
    z.literal(365),
  ]),
})

adminRouter.post("/subscriptions", zValidator("json", createSubscriptionSchema), async (c) => {
  const authz = await requireAdminUser(c.req.raw.headers)
  if (!authz) return c.json(fail("غير مصرح لك بالوصول.", "FORBIDDEN"), 403)

  const body = c.req.valid("json")
  try {
    const rows = await sql`
      INSERT INTO subscriptions (
        business_name, vat_number, phone, plan, status, starts_at, expires_at, activated_at, user_id
      ) VALUES (
        ${body.business_name},
        ${body.vat_number},
        ${body.phone},
        ${body.plan},
        'active',
        NOW(),
        NOW() + (${String(body.duration_days) + " days"})::interval,
        NULL,
        NULL
      )
      RETURNING
        id, business_name, vat_number, phone, plan, status, starts_at, expires_at, activated_at, user_id
    `

    return c.json(ok({
      message: "تم إنشاء الاشتراك بنجاح.",
      subscription: rows[0],
    }), 201)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes("subscriptions_vat_unique") || message.includes("duplicate key")) {
      return c.json(fail("الرقم الضريبي مستخدم مسبقاً.", "DUPLICATE_VAT"), 409)
    }
    return c.json(fail("تعذر إنشاء الاشتراك.", "CREATE_FAILED"), 400)
  }
})

export { adminRouter }
