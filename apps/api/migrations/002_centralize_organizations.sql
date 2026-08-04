-- Centralize one organization per user in Neon.
-- subscriptions.organization_id remains nullable during the legacy-data transition.

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id),
  business_name TEXT NOT NULL,
  vat_number TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Upgrade the existing phase-0 organizations table in place.
ALTER TABLE organizations
  ALTER COLUMN user_id SET NOT NULL,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_status_check;

ALTER TABLE organizations
  ADD CONSTRAINT organizations_status_check
  CHECK (status IN ('active', 'inactive', 'suspended'));

CREATE UNIQUE INDEX IF NOT EXISTS organizations_vat_unique
  ON organizations (vat_number)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_user_unique
  ON organizations (user_id)
  WHERE deleted_at IS NULL;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS subscriptions_organization_id_idx
  ON subscriptions (organization_id);
