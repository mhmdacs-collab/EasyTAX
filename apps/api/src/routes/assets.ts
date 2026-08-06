import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { Hono } from "hono"
import { auth } from "../lib/auth"
import { sql, withTransaction } from "../lib/db"

export const assetsRouter = new Hono()
const kinds = { logo: "logo_url", stamp: "stamp_url", signature: "signature_url" } as const
type AssetKind = keyof typeof kinds

function r2() {
  const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) throw new Error("R2_NOT_CONFIGURED")
  return new S3Client({ region: "auto", endpoint: R2_ENDPOINT, credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY } })
}

async function organization(headers: Headers) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await (auth.api as any).getSession({ headers })
  if (!session?.user?.id) return null
  const rows = await sql`SELECT id, logo_url, stamp_url, signature_url FROM organizations WHERE user_id=${session.user.id as string} AND deleted_at IS NULL LIMIT 1`
  return rows[0] as { id: string; logo_url: string | null; stamp_url: string | null; signature_url: string | null } | undefined
}

function kind(value: string): AssetKind | null { return value in kinds ? value as AssetKind : null }

assetsRouter.put("/:kind", async (c) => {
  const assetKind = kind(c.req.param("kind")); if (!assetKind) return c.json({ error: "نوع الملف غير صالح" }, 404)
  const org = await organization(c.req.raw.headers); if (!org) return c.json({ error: "غير مصرح" }, 401)
  if (c.req.header("content-type") !== "image/png") return c.json({ error: "يجب أن يكون الملف بصيغة PNG" }, 415)
  const bytes = new Uint8Array(await c.req.arrayBuffer())
  if (!bytes.length || bytes.length > 2 * 1024 * 1024) return c.json({ error: "حجم الملف يجب ألا يتجاوز 2MB" }, 413)
  if (!(bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)) return c.json({ error: "محتوى الملف ليس PNG صالحًا" }, 415)
  const key = `organizations/${org.id}/branding/${assetKind}.png`
  await r2().send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key, Body: bytes, ContentType: "image/png", CacheControl: "private, max-age=300" }))
  await withTransaction(async (client) => client.query(`UPDATE organizations SET ${kinds[assetKind]}=$1, updated_at=NOW() WHERE id=$2`, [key, org.id]))
  return c.json({ ok: true })
})

assetsRouter.get("/:kind", async (c) => {
  const assetKind = kind(c.req.param("kind")); if (!assetKind) return c.json({ error: "نوع الملف غير صالح" }, 404)
  const org = await organization(c.req.raw.headers); if (!org) return c.json({ error: "غير مصرح" }, 401)
  const key = org[kinds[assetKind]]; if (!key) return c.json({ error: "الملف غير موجود" }, 404)
  const result = await r2().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }))
  const bytes = await result.Body?.transformToByteArray(); if (!bytes) return c.json({ error: "الملف غير موجود" }, 404)
  return new Response(bytes, { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=300" } })
})

assetsRouter.delete("/:kind", async (c) => {
  const assetKind = kind(c.req.param("kind")); if (!assetKind) return c.json({ error: "نوع الملف غير صالح" }, 404)
  const org = await organization(c.req.raw.headers); if (!org) return c.json({ error: "غير مصرح" }, 401)
  const key = org[kinds[assetKind]]
  if (key) await r2().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }))
  await withTransaction(async (client) => client.query(`UPDATE organizations SET ${kinds[assetKind]}=NULL, ${assetKind === "stamp" ? "stamp_on_invoice=FALSE, stamp_on_quotation=FALSE, stamp_on_receipt=FALSE," : assetKind === "signature" ? "signature_on_invoice=FALSE, signature_on_quotation=FALSE, signature_on_receipt=FALSE," : ""} updated_at=NOW() WHERE id=$1`, [org.id]))
  return c.json({ ok: true })
})
