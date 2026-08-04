CREATE TABLE IF NOT EXISTS subscription_events (
  id BIGSERIAL PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  admin_user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('created','renewed','suspended','reactivated')),
  duration_days INTEGER,
  previous_expires_at TIMESTAMPTZ,
  new_expires_at TIMESTAMPTZ,
  previous_status TEXT,
  new_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subscription_events_org_idx
  ON subscription_events(organization_id, created_at DESC);

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS sync_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS sync_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS customers_sync_version_check;
ALTER TABLE customers
  ADD CONSTRAINT customers_sync_version_check CHECK (sync_version > 0);

ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_sync_version_check;
ALTER TABLE documents
  ADD CONSTRAINT documents_sync_version_check CHECK (sync_version > 0);
