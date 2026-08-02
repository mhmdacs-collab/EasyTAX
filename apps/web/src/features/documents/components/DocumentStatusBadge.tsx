import { Badge } from "@/shared/components/ui/badge"
import { DOCUMENT_STATUS_LABELS, DOCUMENT_STATUS_COLORS } from "../lib/calculations"
import type { DocumentStatus } from "@/lib/db"

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <Badge variant={DOCUMENT_STATUS_COLORS[status]}>
      {DOCUMENT_STATUS_LABELS[status]}
    </Badge>
  )
}
