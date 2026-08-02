import { db } from "@/lib/db"

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000"

export class SyncEngine {
  private running = false
  private intervalId: ReturnType<typeof setInterval> | null = null
  private onlineHandler = () => this.sync()

  start(intervalMs = 30_000): void {
    if (this.running) return
    this.running = true
    window.addEventListener("online", this.onlineHandler)
    this.intervalId = setInterval(() => this.sync(), intervalMs)
    setTimeout(() => this.sync(), 3_000)
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
        synced: { documents: number; customers: number }
      }

      // Mark synced in Dexie
      await db.transaction("rw", [db.documents, db.customers], async () => {
        if (synced.documents > 0) {
          await db.documents
            .where("sync_status").equals("pending")
            .modify({ sync_status: "synced" })
        }
        if (synced.customers > 0) {
          await db.customers
            .where("sync_status").equals("pending")
            .modify({ sync_status: "synced" })
        }
      })
    } catch {
      // Silent fail — retries on next tick or reconnect
    }
  }
}

export const syncEngine = new SyncEngine()
