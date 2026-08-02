import { getPendingSyncItems, markSynced } from "./queue"

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
    // Initial sync after a short delay
    setTimeout(() => this.sync(), 2_000)
  }

  stop(): void {
    this.running = false
    if (this.intervalId) clearInterval(this.intervalId)
    window.removeEventListener("online", this.onlineHandler)
  }

  async sync(): Promise<void> {
    if (!navigator.onLine) return
    try {
      const items = await getPendingSyncItems()
      if (items.length === 0) return

      const res = await fetch(`${API_URL}/api/v1/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ items }),
      })

      if (!res.ok) return
      const { synced } = (await res.json()) as { synced: string[] }
      await markSynced(synced)
    } catch {
      // Silent fail - will retry on next interval or reconnect
    }
  }
}

export const syncEngine = new SyncEngine()
