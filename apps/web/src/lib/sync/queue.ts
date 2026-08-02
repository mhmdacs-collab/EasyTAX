import { db } from "@/lib/db"
import type { Customer, Project, Document } from "@/lib/db"

export interface SyncItem {
  table: string
  record_id: string
  operation: "insert" | "update" | "delete"
  payload: unknown
}

type SyncableRecord = (Customer | Project | Document) & { deleted_at?: string }

export async function getPendingSyncItems(): Promise<SyncItem[]> {
  const [customers, projects, documents] = await Promise.all([
    db.customers.where("sync_status").equals("pending").toArray(),
    db.projects.where("sync_status").equals("pending").toArray(),
    db.documents.where("sync_status").equals("pending").toArray(),
  ])

  const toItems = (table: string, records: SyncableRecord[]): SyncItem[] =>
    records.map((r) => ({
      table,
      record_id: r.id,
      operation: r.deleted_at ? ("delete" as const) : ("update" as const),
      payload: r,
    }))

  return [
    ...toItems("customers", customers),
    ...toItems("projects", projects),
    ...toItems("documents", documents),
  ]
}

export async function markSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await db.transaction("rw", [db.customers, db.projects, db.documents], async () => {
    await Promise.all(
      ids.flatMap((id) => [
        db.customers.where("id").equals(id).modify({ sync_status: "synced" }),
        db.projects.where("id").equals(id).modify({ sync_status: "synced" }),
        db.documents.where("id").equals(id).modify({ sync_status: "synced" }),
      ])
    )
  })
}
