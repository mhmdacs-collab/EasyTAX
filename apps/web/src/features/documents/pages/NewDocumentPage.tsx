import { useSearch } from "@tanstack/react-router"
import { DocumentForm } from "../components/DocumentForm"
import type { DocumentType } from "@/lib/db"

export function NewDocumentPage() {
  const search = useSearch({ from: "/app/documents/new" }) as { type?: DocumentType }
  return <DocumentForm initialType={search.type ?? "tax_invoice"} />
}
