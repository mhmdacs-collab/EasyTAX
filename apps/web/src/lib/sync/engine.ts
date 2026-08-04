import { db } from "@/lib/db"

const resolveApiUrl = (): string => {
  const value: unknown = Reflect.get(import.meta.env, "VITE_API_URL")
  return typeof value === "string" && value.length > 0 ? value : "http://localhost:3000"
}

const API_URL = resolveApiUrl()

export class SyncEngine {
  private running = false
  private intervalId: ReturnType<typeof setInterval> | null = null
  private onlineHandler = () => {
    void this.sync()
  }

  start(intervalMs = 30_000): void {
    if (this.running) return
    this.running = true
    window.addEventListener("online", this.onlineHandler)
    this.intervalId = setInterval(() => {
      void this.sync()
    }, intervalMs)
    setTimeout(() => {
      void this.sync()
    }, 3_000)
  }

  stop(): void {
    this.running = false
    if (this.intervalId) clearInterval(this.intervalId)
    window.removeEventListener("online", this.onlineHandler)
  }

  async sync(): Promise<void> {
    if (!navigator.onLine) return

    try {
      const org = await db.organizations.toArray().then((r) => r[0])
      if (!org) return

      const [pendingDocs, pendingCustomers] = await Promise.all([
        db.documents.where("sync_status").equals("pending").toArray(),
        db.customers.where("sync_status").equals("pending").toArray(),
      ])

      if (pendingDocs.length === 0 && pendingCustomers.length === 0) return

      const res = await fetch(`${API_URL}/api/v1/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          organization_id: org.id,
          documents: pendingDocs,
          customers: pendingCustomers,
        }),
      })

      if (!res.ok) return

      const { synced } = (await res.json()) as {
        synced: { document_ids: string[]; customer_ids: string[] }
      }

      // Mark only the exact rows acknowledged by the server. New edits that
      // appeared while the request was in flight remain pending.
      await db.transaction("rw", [db.documents, db.customers], async () => {
        for (const id of synced.document_ids) {
          const sent = pendingDocs.find((item) => item.id === id)
          const current = await db.documents.get(id)
          if (sent && current?.version === sent.version) {
            await db.documents.update(id, { sync_status: "synced" })
          }
        }
        for (const id of synced.customer_ids) {
          const sent = pendingCustomers.find((item) => item.id === id)
          const current = await db.customers.get(id)
          if (sent && current?.version === sent.version) {
            await db.customers.update(id, { sync_status: "synced" })
          }
        }
      })
    } catch {
      // Silent fail — retries on next tick or reconnect
    }
  }
}

export const syncEngine = new SyncEngine()
