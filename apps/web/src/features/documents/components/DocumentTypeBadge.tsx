import { Badge } from "@/shared/components/ui/badge"
import { DOCUMENT_TYPE_LABELS } from "../lib/calculations"
import type { DocumentType } from "@/lib/db"

const typeVariant: Record<DocumentType, "default" | "secondary" | "outline"> = {
  tax_invoice: "default",
  simplified_invoice: "secondary",
  quotation: "outline",
  proforma: "outline",
  receipt_voucher: "secondary",
}

export function DocumentTypeBadge({ type }: { type: DocumentType }) {
  return <Badge variant={typeVariant[type]}>{DOCUMENT_TYPE_LABELS[type]}</Badge>
}
