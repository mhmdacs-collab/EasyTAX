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
  // Persist a per-user onboarding-complete flag so we can detect returning users
  // whose Dexie org was cleared by a different company's activation
  localStorage.setItem(`et_onboarded_${authUserId}`, "1")
}


export type BootstrapOrganization = {
  id: string
  business_name: string
  vat_number: string
  phone: string | null
  email: string | null
  commercial_registration: string | null
  city: string | null
  district: string | null
  street: string | null
  building_number: string | null
  postal_code: string | null
}

export async function hydrateOrganizationFromBootstrap(
  organization: BootstrapOrganization,
  authUserId: string
): Promise<void> {
  const existing = await db.organizations
    .where("vat_number")
    .equals(organization.vat_number)
    .first()

  // Preserve an existing local-first tenant and all records linked to its local
  // identifier. Newly provisioned customers use the centralized identifier.
  if (existing) {
    await bindOrganizationToAuthUser(existing.id, authUserId)
    return
  }

  const now = new Date().toISOString()
  await db.organizations.put({
    id: organization.id,
    auth_user_id: authUserId,
    business_name: organization.business_name,
    vat_number: organization.vat_number,
    phone: organization.phone ?? undefined,
    email: organization.email ?? undefined,
    commercial_registration: organization.commercial_registration ?? undefined,
    city: organization.city ?? undefined,
    district: organization.district ?? undefined,
    street: organization.street ?? undefined,
    building_number: organization.building_number ?? undefined,
    postal_code: organization.postal_code ?? undefined,
    subscription_status: "active",
    created_at: now,
    updated_at: now,
    sync_status: "synced",
    version: 1,
  })
  await bindOrganizationToAuthUser(organization.id, authUserId)
}
