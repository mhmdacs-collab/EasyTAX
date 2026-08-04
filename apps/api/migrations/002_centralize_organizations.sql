-- Centralize organizations and their user memberships in Neon.
-- subscriptions.organization_id remains nullable during the legacy-data transition.

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  user_id TEXT,
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

-- Upgrade the existing phase-0 organizations table in place. Membership is
-- moved to organization_users, so legacy user_id must no longer be required.
ALTER TABLE organizations
  ALTER COLUMN user_id DROP NOT NULL,
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

CREATE TABLE IF NOT EXISTS organization_users (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES "user"(id),
  role TEXT NOT NULL DEFAULT 'owner'
    CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_users_user_unique
  ON organization_users (user_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS organization_users_membership_unique
  ON organization_users (organization_id, user_id)
  WHERE deleted_at IS NULL;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS subscriptions_organization_id_idx
  ON subscriptions (organization_id);
