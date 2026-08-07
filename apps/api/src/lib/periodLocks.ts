import type { PoolClient } from "pg"

export type ActivePeriodLock = {
  id: string
  lock_type: "tax_return" | "financial_year"
  starts_on: string
  ends_on: string
}

export async function activePeriodLock(client: PoolClient, organizationId: string, eventDate: string) {
  const result = await client.query<ActivePeriodLock>(`
    SELECT id,lock_type,starts_on::text,ends_on::text
    FROM accounting_period_locks
    WHERE organization_id=$1 AND status='locked' AND $2::date BETWEEN starts_on AND ends_on
    ORDER BY CASE lock_type WHEN 'financial_year' THEN 1 ELSE 2 END
    LIMIT 1
  `, [organizationId, eventDate])
  return result.rows[0] ?? null
}

export function lockedPeriodMessage(lock: ActivePeriodLock) {
  const label = lock.lock_type === "tax_return" ? "الإقرار الضريبي" : "القوائم المالية"
  return `الفترة من ${lock.starts_on} إلى ${lock.ends_on} مقفلة بسبب اعتماد ${label}. أعد فتح الفترة أولًا قبل تسجيل أو عكس أي حركة فيها.`
}

