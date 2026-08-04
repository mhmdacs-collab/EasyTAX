-- EasyTAX currently supports exactly one user for each organization.

DROP TABLE IF EXISTS organization_users;

ALTER TABLE organizations
  ALTER COLUMN user_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_user_unique
  ON organizations (user_id)
  WHERE deleted_at IS NULL;
