import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { sql } from "../lib/db"
import { auth } from "../lib/auth"

const subscriptionRouter = new Hono()

const normalize = (p: string) => p.replace(/\D/g, "")

// ─── POST /check ──────────────────────────────────────────────────────────────
const checkSchema = z.object({
  vat_number: z.string().length(15, "الرقم الضريبي يجب أن يكون 15 رقماً").regex(/^\d+$/, "أرقام فقط"),
  phone: z.string().min(9, "رقم جوال غير صالح"),
})

subscriptionRouter.post("/check", zValidator("json", checkSchema), async (c) => {
  const { vat_number, phone } = c.req.valid("json")

  const rows = await sql`
    SELECT vat_number, phone, business_name, status, expires_at, activated_at
    FROM subscriptions
    WHERE vat_number = ${vat_number}
    LIMIT 1
  `

  if (rows.length === 0) {
    return c.json({ active: false, message: "لا يوجد اشتراك فعال." })
  }

  const sub = rows[0] as {
    vat_number: string
    phone: string
    business_name: string
    status: string
    expires_at: string | null
    activated_at: string | null
  }

  if (sub.status !== "active") {
    return c.json({ active: false, message: "لا يوجد اشتراك فعال." })
  }

  if (sub.expires_at && new Date(sub.expires_at) < new Date()) {
    return c.json({ active: false, message: "انتهت صلاحية الاشتراك." })
  }

  if (normalize(sub.phone) !== normalize(phone)) {
    return c.json({ active: false, message: "رقم الجوال غير متطابق مع الاشتراك." })
  }

  if (sub.activated_at !== null) {
    return c.json({
      active: false,
      already_activated: true,
      message: "تم تفعيل هذا الاشتراك مسبقاً. يرجى تسجيل الدخول.",
    })
  }

  // Issue a short-lived single-use activation token (10 min)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  const tokenRows = await sql`
    INSERT INTO activation_tokens (vat_number, expires_at)
    VALUES (${vat_number}, ${expiresAt})
    RETURNING id
  `
  const token = (tokenRows[0] as { id: string }).id

  return c.json({
    active: true,
    token,
    vat_number: sub.vat_number,
    phone: sub.phone,
    business_name: sub.business_name,
  })
})

// ─── POST /activate ───────────────────────────────────────────────────────────
const activateSchema = z.object({
  token: z.string().min(1),
  phone: z.string().min(9, "رقم جوال غير صالح"),
  password: z.string().min(8, "8 أحرف على الأقل"),
})

subscriptionRouter.post("/activate", zValidator("json", activateSchema), async (c) => {
  const body = c.req.valid("json")

  // Validate token
  const tokenRows = await sql`
    SELECT id, vat_number, expires_at, used_at
    FROM activation_tokens
    WHERE id = ${body.token}
    LIMIT 1
  `
  if (tokenRows.length === 0) {
    return c.json({ error: "رمز التفعيل غير صالح." }, 400)
  }
  const tok = tokenRows[0] as {
    id: string
    vat_number: string
    expires_at: string
    used_at: string | null
  }
  if (tok.used_at !== null) {
    return c.json({ error: "تم استخدام رمز التفعيل مسبقاً." }, 400)
  }
  if (new Date(tok.expires_at) <= new Date()) {
    return c.json({ error: "انتهت صلاحية رمز التفعيل." }, 400)
  }

  // Re-verify subscription from DB using token.vat_number (NOT from frontend)
  const subRows = await sql`
    SELECT vat_number, business_name, phone, status, expires_at, activated_at
    FROM subscriptions
    WHERE vat_number = ${tok.vat_number}
    LIMIT 1
  `
  if (subRows.length === 0) {
    return c.json({ error: "لا يوجد اشتراك مرتبط بهذا الرمز." }, 400)
  }
  const sub = subRows[0] as {
    vat_number: string
    business_name: string
    phone: string
    status: string
    expires_at: string | null
    activated_at: string | null
  }

  if (sub.status !== "active") {
    return c.json({ error: "الاشتراك غير فعال." }, 400)
  }
  if (sub.expires_at && new Date(sub.expires_at) < new Date()) {
    return c.json({ error: "انتهت صلاحية الاشتراك." }, 400)
  }
  if (sub.activated_at !== null) {
    return c.json({ error: "تم تفعيل هذا الاشتراك مسبقاً." }, 400)
  }

  // Create Better Auth user
  let userId: string
  let email: string
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (auth.api as any).signUpEmail({
      body: {
        email: `${sub.vat_number}@easytax.local`,
        password: body.password,
        name: sub.business_name,
      },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    userId = (result as any).user?.id as string
    email = `${sub.vat_number}@easytax.local`
  } catch (err) {
    const msg = err instanceof Error ? err.message : "فشل إنشاء الحساب"
    return c.json({ error: msg }, 400)
  }

  // Mark token used
  await sql`UPDATE activation_tokens SET used_at = NOW() WHERE id = ${tok.id}`

  // Mark subscription activated
  await sql`
    UPDATE subscriptions
    SET activated_at = NOW(),
        user_id = ${userId},
        phone = ${body.phone},
        updated_at = NOW()
    WHERE vat_number = ${sub.vat_number}
  `

  return c.json({ success: true, email })
})

// ─── GET /me ──────────────────────────────────────────────────────────────────
subscriptionRouter.get("/me", async (c) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await (auth.api as any).getSession({ headers: c.req.raw.headers })
  if (!session?.user?.id) {
    return c.json({ error: "غير مصرح" }, 401)
  }

  const rows = await sql`
    SELECT vat_number, business_name, phone
    FROM subscriptions
    WHERE user_id = ${session.user.id as string}
    LIMIT 1
  `

  if (rows.length === 0) {
    return c.json({ subscription: null })
  }

  const sub = rows[0] as { vat_number: string; business_name: string; phone: string }
  return c.json({ subscription: { vat_number: sub.vat_number, business_name: sub.business_name, phone: sub.phone } })
})

export { subscriptionRouter }
