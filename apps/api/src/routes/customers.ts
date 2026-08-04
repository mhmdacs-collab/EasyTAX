import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { auth } from "../lib/auth"
import { sql } from "../lib/db"

export const customersRouter = new Hono()
async function organizationId(headers: Headers): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await (auth.api as any).getSession({ headers })
  if (!session?.user?.id) return null
  const rows = await sql`SELECT id FROM organizations WHERE user_id=${session.user.id as string} AND deleted_at IS NULL LIMIT 1`
  return (rows[0]?.id as string | undefined) ?? null
}
const vat = z.string().regex(/^3\d{13}3$/, "الرقم الضريبي يجب أن يكون 15 رقماً ويبدأ وينتهي بالرقم 3")
const customerSchema = z.object({
  name: z.string().trim().min(2), vat_number: vat, commercial_registration: z.string().optional(),
  phone: z.string().optional(), email: z.string().email().optional().or(z.literal("")), notes: z.string().optional(),
  city: z.string().trim().min(1), district: z.string().trim().min(1), street: z.string().trim().min(1),
  building_number: z.string().regex(/^\d{4}$/), postal_code: z.string().regex(/^\d{5}$/),
  additional_number: z.string().regex(/^\d{4}$/).optional().or(z.literal("")), short_address: z.string().optional(),
})
customersRouter.get("/", async (c) => {
  const orgId = await organizationId(c.req.raw.headers); if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const rows = await sql`SELECT * FROM customers WHERE organization_id=${orgId} AND deleted_at IS NULL ORDER BY name`
  return c.json({ customers: rows })
})
customersRouter.post("/", zValidator("json", customerSchema), async (c) => {
  const orgId = await organizationId(c.req.raw.headers); if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const b=c.req.valid("json")
  const rows=await sql`INSERT INTO customers(organization_id,name,vat_number,commercial_registration,phone,email,notes,country,country_code,city,district,street,building_number,postal_code,additional_number,short_address)
    VALUES(${orgId},${b.name},${b.vat_number},${b.commercial_registration||null},${b.phone||null},${b.email||null},${b.notes||null},'Saudi Arabia','SA',${b.city},${b.district},${b.street},${b.building_number},${b.postal_code},${b.additional_number||null},${b.short_address||null}) RETURNING *`
  return c.json({ customer: rows[0] }, 201)
})
customersRouter.put("/:id", zValidator("json", customerSchema), async (c) => {
  const orgId = await organizationId(c.req.raw.headers); if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const b=c.req.valid("json"), id=c.req.param("id")
  const rows=await sql`UPDATE customers SET name=${b.name},vat_number=${b.vat_number},commercial_registration=${b.commercial_registration||null},phone=${b.phone||null},email=${b.email||null},notes=${b.notes||null},city=${b.city},district=${b.district},street=${b.street},building_number=${b.building_number},postal_code=${b.postal_code},additional_number=${b.additional_number||null},short_address=${b.short_address||null},updated_at=NOW(),sync_version=sync_version+1 WHERE id=${id} AND organization_id=${orgId} AND deleted_at IS NULL RETURNING *`
  return rows[0] ? c.json({ customer: rows[0] }) : c.json({ error: "العميل غير موجود" }, 404)
})
customersRouter.delete("/:id", async (c) => {
  const orgId = await organizationId(c.req.raw.headers); if (!orgId) return c.json({ error: "غير مصرح" }, 401)
  const rows=await sql`UPDATE customers SET deleted_at=NOW(),updated_at=NOW(),sync_version=sync_version+1 WHERE id=${c.req.param("id")} AND organization_id=${orgId} AND deleted_at IS NULL RETURNING id`
  return rows[0] ? c.json({ ok: true }) : c.json({ error: "العميل غير موجود" }, 404)
})
