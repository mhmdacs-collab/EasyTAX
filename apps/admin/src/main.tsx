import React from "react"
import ReactDOM from "react-dom/client"
import { RouterProvider } from "@tanstack/react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { router } from "./router"
import "./index.css"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60, retry: 1 },
  },
})

const rootElement = document.getElementById("root")
if (!rootElement) throw new Error("Root element #root not found")

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
)
