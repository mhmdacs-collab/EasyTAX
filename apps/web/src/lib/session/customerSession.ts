import { db } from "@/lib/db"

const SESSION_META_KEY = "customer-session"

const normalizeVat = (value: string) => value.replace(/\D/g, "")

async function setSessionMeta(
  patch: Partial<{ auth_user_id?: string; organization_id?: string }>
): Promise<void> {
  const current = await db.app_meta.get(SESSION_META_KEY)
  await db.app_meta.put({
    key: SESSION_META_KEY,
    auth_user_id: "auth_user_id" in patch ? patch.auth_user_id : current?.auth_user_id,
    organization_id: "organization_id" in patch ? patch.organization_id : current?.organization_id,
    updated_at: new Date().toISOString(),
  })
}

export async function clearTenantScopedState(): Promise<void> {
  await db.transaction(
    "rw",
    [db.organizations, db.customers, db.projects, db.documents, db.purchase_invoices, db.expenses, db.settings, db.app_meta],
    async () => {
      await Promise.all([
        db.organizations.clear(),
        db.customers.clear(),
        db.projects.clear(),
        db.documents.clear(),
        db.purchase_invoices.clear(),
        db.expenses.clear(),
        db.settings.clear(),
      ])
      await setSessionMeta({ organization_id: undefined })
    }
  )
}

export async function clearTenantStateIfVatDiff(targetVatNumber: string): Promise<void> {
  const org = await db.organizations.toArray().then((rows) => rows[0])
  if (!org) return

  if (normalizeVat(org.vat_number) !== normalizeVat(targetVatNumber)) {
    await clearTenantScopedState()
  }
}

export async function ensureTenantContextForUser(authUserId: string): Promise<boolean> {
  const [meta, org] = await Promise.all([
    db.app_meta.get(SESSION_META_KEY),
    db.organizations.toArray().then((rows) => rows[0]),
  ])

  if (meta?.auth_user_id && meta.auth_user_id !== authUserId) {
    await clearTenantScopedState()
    await setSessionMeta({ auth_user_id: authUserId, organization_id: undefined })
    return false
  }

  if (org?.auth_user_id && org.auth_user_id !== authUserId) {
    await clearTenantScopedState()
    await setSessionMeta({ auth_user_id: authUserId, organization_id: undefined })
    return false
  }

  if (org && !org.auth_user_id) {
    await db.organizations.update(org.id, { auth_user_id: authUserId })
  }

  await setSessionMeta({
    auth_user_id: authUserId,
    organization_id: org?.id,
  })

  return Boolean(org)
}

export async function bindOrganizationToAuthUser(
  organizationId: string,
  authUserId: string
): Promise<void> {
  await db.organizations.update(organizationId, { auth_user_id: authUserId })
  await setSessionMeta({ auth_user_id: authUserId, organization_id: organizationId })
}
