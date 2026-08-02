import { useParams } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { DocumentForm } from "../components/DocumentForm"

export function DocumentEditPage() {
  const { id } = useParams({ from: "/app/documents/$id/edit" })
  const draft = useLiveQuery(() => db.documents.get(id), [id])

  if (!draft) return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      جاري التحميل...
    </div>
  )

  if (draft.status !== "draft") return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
      <p className="text-lg font-medium">المستند لا يمكن تعديله</p>
      <p className="text-sm">يمكن تعديل المسودات فقط. هذا المستند حالته: {draft.status}</p>
    </div>
  )

  return <DocumentForm draft={draft} />
}
