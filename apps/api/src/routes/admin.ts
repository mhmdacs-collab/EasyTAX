import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { sql, withTransaction } from "../lib/db"
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
  phone: z.string().min(9, "رقم الجوال غير صالح").max(15, "رقم الجوال غير صالح").regex(/^\d+$/, "أرقام فقط"),
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
  const loginEmail = `${body.vat_number}@easytax.local`
  let createdUserId: string | null = null

  try {
    const existing = await sql`
      SELECT id FROM subscriptions WHERE vat_number = ${body.vat_number} LIMIT 1
    `
    if (existing.length > 0) {
      return c.json(fail("الرقم الضريبي مستخدم مسبقاً.", "DUPLICATE_VAT"), 409)
    }

    // Better Auth owns password hashing and account creation.
    // If the following database transaction fails, the newly-created auth rows
    // are removed in the catch block so no half-created customer remains.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const signUpResult = await (auth.api as any).signUpEmail({
      body: {
        email: loginEmail,
        password: body.phone,
        name: body.business_name,
      },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createdUserId = (signUpResult as any).user?.id as string | undefined ?? null
    if (!createdUserId) {
      throw new Error("AUTH_USER_NOT_CREATED")
    }

    const organizationId = crypto.randomUUID()
    const userId = createdUserId

    const subscription = await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO organizations (
          id, user_id, business_name, vat_number, phone, email, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'active')`,
        [organizationId, userId, body.business_name, body.vat_number, body.phone, null],
      )

      const result = await client.query(
        `INSERT INTO subscriptions (
          business_name, vat_number, phone, plan, status, starts_at, expires_at,
          activated_at, user_id, organization_id
        ) VALUES (
          $1, $2, $3, $4, 'active', NOW(),
          NOW() + ($5 * INTERVAL '1 day'), NOW(), $6, $7
        )
        RETURNING
          id, business_name, vat_number, phone, plan, status, starts_at,
          expires_at, activated_at, user_id, organization_id`,
        [
          body.business_name,
          body.vat_number,
          body.phone,
          body.plan,
          body.duration_days,
          userId,
          organizationId,
        ],
      )

      return result.rows[0]
    })

    return c.json(ok({
      message: "تم إنشاء العميل وحساب الدخول بنجاح.",
      login: {
        vat_number: body.vat_number,
        email: loginEmail,
      },
      organization: {
        id: organizationId,
        business_name: body.business_name,
        vat_number: body.vat_number,
      },
      subscription,
    }), 201)
  } catch (error) {
    if (createdUserId) {
      try {
        await sql`DELETE FROM session WHERE user_id = ${createdUserId}`
        await sql`DELETE FROM account WHERE user_id = ${createdUserId}`
        await sql`DELETE FROM "user" WHERE id = ${createdUserId}`
      } catch (cleanupError) {
        console.error("Failed to compensate auth user creation", cleanupError)
      }
    }

    const message = error instanceof Error ? error.message : String(error)
    if (
      message.includes("subscriptions_vat_unique") ||
      message.includes("organizations_vat_unique") ||
      message.includes("duplicate key")
    ) {
      return c.json(fail("الرقم الضريبي مستخدم مسبقاً.", "DUPLICATE_VAT"), 409)
    }
    if (/user already exists|email.*exists|already registered/i.test(message)) {
      return c.json(fail("يوجد حساب مرتبط بهذا الرقم الضريبي مسبقاً.", "DUPLICATE_USER"), 409)
    }
    return c.json(fail("تعذر إنشاء العميل.", "CREATE_FAILED"), 400)
  }
})

// ── Phase 2: lookup, renew, suspend, reactivate ──────────────────────────────

const VAT_RE = /^\d{15}$/

const subDetailQuery = (vatNumber: string) => sql`
  SELECT
    id, business_name, vat_number, phone, plan, status,
    starts_at, expires_at,
    CASE
      WHEN status = 'suspended' THEN 'suspended'
      WHEN status = 'inactive'  THEN 'inactive'
      WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 'expired'
      WHEN status = 'active' AND (expires_at IS NULL OR expires_at >= NOW()) THEN 'active'
      ELSE status
    END AS derived_status,
    CASE
      WHEN expires_at IS NULL THEN NULL
      ELSE CEIL(EXTRACT(EPOCH FROM (expires_at - NOW())) / 86400.0)::int
    END AS remaining_days
  FROM subscriptions
  WHERE vat_number = ${vatNumber}
  LIMIT 1
`

adminRouter.get("/subscriptions/:vatNumber", async (c) => {
  const authz = await requireAdminUser(c.req.raw.headers)
  if (!authz) return c.json(fail("غير مصرح لك بالوصول.", "FORBIDDEN"), 403)

  const { vatNumber } = c.req.param()
  if (!VAT_RE.test(vatNumber)) {
    return c.json(fail("الرقم الضريبي يجب أن يكون 15 رقماً.", "INVALID_VAT"), 422)
  }

  const rows = await subDetailQuery(vatNumber)
  if (rows.length === 0) {
    return c.json(fail("لا يوجد اشتراك بهذا الرقم الضريبي.", "NOT_FOUND"), 404)
  }
  return c.json(ok(rows[0]))
})

const renewBodySchema = z.object({
  duration_days: z.union([z.literal(30), z.literal(90), z.literal(180), z.literal(365)]),
})

adminRouter.post("/subscriptions/:vatNumber/renew", zValidator("json", renewBodySchema), async (c) => {
  const authz = await requireAdminUser(c.req.raw.headers)
  if (!authz) return c.json(fail("غير مصرح لك بالوصول.", "FORBIDDEN"), 403)

  const { vatNumber } = c.req.param()
  if (!VAT_RE.test(vatNumber)) {
    return c.json(fail("الرقم الضريبي يجب أن يكون 15 رقماً.", "INVALID_VAT"), 422)
  }

  const { duration_days } = c.req.valid("json")

  // Atomic CTE: capture old value at snapshot, compute new value in UPDATE
  const rows = await sql`
    WITH before_update AS (
      SELECT expires_at AS old_expires_at FROM subscriptions WHERE vat_number = ${vatNumber}
    ),
    after_update AS (
      UPDATE subscriptions
      SET
        expires_at = CASE
          WHEN expires_at IS NULL OR expires_at < NOW()
            THEN NOW() + (${duration_days} * INTERVAL '1 day')
          ELSE expires_at + (${duration_days} * INTERVAL '1 day')
        END,
        updated_at = NOW()
      WHERE vat_number = ${vatNumber}
      RETURNING
        expires_at AS new_expires_at,
        CEIL(EXTRACT(EPOCH FROM (expires_at - NOW())) / 86400.0)::int AS remaining_days
    )
    SELECT before_update.old_expires_at, after_update.new_expires_at, after_update.remaining_days
    FROM before_update CROSS JOIN after_update
  `

  if (rows.length === 0) {
    return c.json(fail("لا يوجد اشتراك بهذا الرقم الضريبي.", "NOT_FOUND"), 404)
  }

  const row = rows[0] as {
    old_expires_at: string | null
    new_expires_at: string
    remaining_days: number | null
  }

  return c.json(ok({
    message: "تم تجديد الاشتراك بنجاح.",
    previous_expires_at: row.old_expires_at,
    new_expires_at: row.new_expires_at,
    remaining_days: row.remaining_days,
    duration_days,
  }))
})

adminRouter.post("/subscriptions/:vatNumber/suspend", async (c) => {
  const authz = await requireAdminUser(c.req.raw.headers)
  if (!authz) return c.json(fail("غير مصرح لك بالوصول.", "FORBIDDEN"), 403)

  const { vatNumber } = c.req.param()
  if (!VAT_RE.test(vatNumber)) {
    return c.json(fail("الرقم الضريبي يجب أن يكون 15 رقماً.", "INVALID_VAT"), 422)
  }

  const updated = await sql`
    UPDATE subscriptions SET status = 'suspended', updated_at = NOW()
    WHERE vat_number = ${vatNumber} AND status = 'active'
    RETURNING id
  `

  if (updated.length === 0) {
    const exists = await sql`SELECT status FROM subscriptions WHERE vat_number = ${vatNumber} LIMIT 1`
    if (exists.length === 0) return c.json(fail("لا يوجد اشتراك بهذا الرقم الضريبي.", "NOT_FOUND"), 404)
    return c.json(fail("لا يمكن إيقاف هذا الاشتراك في حالته الحالية.", "INVALID_STATE"), 409)
  }

  return c.json(ok({ message: "تم إيقاف الاشتراك بنجاح." }))
})

adminRouter.post("/subscriptions/:vatNumber/reactivate", async (c) => {
  const authz = await requireAdminUser(c.req.raw.headers)
  if (!authz) return c.json(fail("غير مصرح لك بالوصول.", "FORBIDDEN"), 403)

  const { vatNumber } = c.req.param()
  if (!VAT_RE.test(vatNumber)) {
    return c.json(fail("الرقم الضريبي يجب أن يكون 15 رقماً.", "INVALID_VAT"), 422)
  }

  const updated = await sql`
    UPDATE subscriptions SET status = 'active', updated_at = NOW()
    WHERE vat_number = ${vatNumber} AND status IN ('suspended', 'inactive')
    RETURNING id
  `

  if (updated.length === 0) {
    const exists = await sql`SELECT status FROM subscriptions WHERE vat_number = ${vatNumber} LIMIT 1`
    if (exists.length === 0) return c.json(fail("لا يوجد اشتراك بهذا الرقم الضريبي.", "NOT_FOUND"), 404)
    return c.json(fail("الاشتراك نشط بالفعل.", "ALREADY_ACTIVE"), 409)
  }

  return c.json(ok({ message: "تم إعادة تفعيل الاشتراك بنجاح." }))
})

export { adminRouter }
