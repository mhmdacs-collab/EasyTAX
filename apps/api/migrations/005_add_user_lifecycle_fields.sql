ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE "user"
  DROP CONSTRAINT IF EXISTS user_status_check;

ALTER TABLE "user"
  ADD CONSTRAINT user_status_check
  CHECK (status IN ('active', 'inactive', 'suspended'));

CREATE INDEX IF NOT EXISTS user_status_idx
  ON "user" (status)
  WHERE deleted_at IS NULL;
