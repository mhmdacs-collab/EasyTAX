import { useSearch } from "@tanstack/react-router"
import { DocumentForm } from "../components/DocumentForm"
import type { DocumentType } from "@/lib/db"

export function NewDocumentPage() {
  const search: { type?: DocumentType } = useSearch({ from: "/app/documents/new" })
  return <DocumentForm initialType={search.type ?? "tax_invoice"} />
}
