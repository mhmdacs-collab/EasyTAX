import React from "react"
import ReactDOM from "react-dom/client"
import { RouterProvider } from "@tanstack/react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { router } from "./router"
import { syncEngine } from "./lib/sync"
import { Toaster } from "@/shared/components/Toaster"
import "./index.css"

const chunkReloadKey = "easytax:chunk-reload"

function recoverFromStaleChunk(message: string) {
  const failedChunk = message.match(/https?:\/\/[^\s]+\.js/)?.[0] ?? message
  if (sessionStorage.getItem(chunkReloadKey) === failedChunk) return
  sessionStorage.setItem(chunkReloadKey, failedChunk)
  void navigator.serviceWorker.getRegistration().then((registration) => registration?.update()).finally(() => {
    window.location.reload()
  })
}

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault()
  const payload = (event as Event & { payload?: unknown }).payload
  recoverFromStaleChunk(payload instanceof Error ? payload.message : String(payload))
})

window.addEventListener("unhandledrejection", (event) => {
  const message = event.reason instanceof Error ? event.reason.message : String(event.reason)
  if (/dynamically imported module|module script failed|loading chunk/i.test(message)) {
    event.preventDefault()
    recoverFromStaleChunk(message)
  }
})

window.setTimeout(() => { sessionStorage.removeItem(chunkReloadKey) }, 15_000)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
})

syncEngine.start()

const rootElement = document.getElementById("root")
if (!rootElement) throw new Error("Root element #root not found")
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  </React.StrictMode>,
)
