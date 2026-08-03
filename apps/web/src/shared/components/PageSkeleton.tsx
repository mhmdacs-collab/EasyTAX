import { Skeleton } from "@/shared/components/ui/skeleton"

export function TablePageSkeleton() {
  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="h-10 w-72" />
      <div className="rounded-lg border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-32 flex-1" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16 ms-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function CardPageSkeleton() {
  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="h-10 w-72" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FormPageSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <Skeleton className="h-8 w-48" />
      <div className="space-y-4 rounded-lg border p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
