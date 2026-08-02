import { db } from "@/lib/db"
import { generateId } from "@/shared/utils"
import { DOCUMENT_TYPE_PREFIX } from "./calculations"
import type { DocumentType } from "@/lib/db"

/** توليد رقم مستند تسلسلي — يُقفل Dexie لضمان عدم التكرار */
export async function nextDocumentNumber(
  organizationId: string,
  type: DocumentType
): Promise<string> {
  const prefix = DOCUMENT_TYPE_PREFIX[type]
  const key = `seq_${type}`

  return db.transaction("rw", db.settings, async () => {
    const existing = await db.settings
      .where("organization_id").equals(organizationId)
      .filter((s) => s.key === key)
      .first()

    const next = existing ? parseInt(existing.value, 10) + 1 : 1

    const now = new Date().toISOString()
    if (existing) {
      await db.settings.update(existing.id, { value: String(next), updated_at: now })
    } else {
      await db.settings.add({ id: generateId(), organization_id: organizationId, key, value: String(next), updated_at: now })
    }

    return `${prefix}-${String(next).padStart(4, "0")}`
  })
}

/** معاينة الرقم التالي دون حجزه */
export async function peekNextNumber(organizationId: string, type: DocumentType): Promise<string> {
  const prefix = DOCUMENT_TYPE_PREFIX[type]
  const key = `seq_${type}`
  const existing = await db.settings
    .where("organization_id").equals(organizationId)
    .filter((s) => s.key === key)
    .first()
  const next = existing ? parseInt(existing.value, 10) + 1 : 1
  return `${prefix}-${String(next).padStart(4, "0")}`
}
