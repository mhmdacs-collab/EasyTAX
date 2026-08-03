import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { sql } from "../lib/db"

const subscriptionRouter = new Hono()

const checkSchema = z.object({
  vat_number: z.string().length(15, "الرقم الضريبي يجب أن يكون 15 رقماً").regex(/^\d+$/, "أرقام فقط"),
  phone: z.string().min(9, "رقم جوال غير صالح"),
})

subscriptionRouter.post("/check", zValidator("json", checkSchema), async (c) => {
  const { vat_number, phone } = c.req.valid("json")

  // Ensure subscriptions table exists (idempotent)
  await sql`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      vat_number TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      business_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  const rows = await sql`
    SELECT vat_number, phone, business_name, status, expires_at
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
  }

  if (sub.status !== "active") {
    return c.json({ active: false, message: "لا يوجد اشتراك فعال." })
  }

  if (sub.expires_at && new Date(sub.expires_at) < new Date()) {
    return c.json({ active: false, message: "لا يوجد اشتراك فعال." })
  }

  // Normalize phone for comparison (digits only)
  const normalize = (p: string) => p.replace(/\D/g, "")
  if (normalize(sub.phone) !== normalize(phone)) {
    return c.json({ active: false, message: "رقم الجوال غير متطابق مع الاشتراك." })
  }

  return c.json({
    active: true,
    vat_number: sub.vat_number,
    phone: sub.phone,
    business_name: sub.business_name,
  })
})

export { subscriptionRouter }
