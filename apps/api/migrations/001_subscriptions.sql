-- Subscriptions (managed externally / by admin)
CREATE TABLE IF NOT EXISTS subscriptions (
  id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  business_name TEXT        NOT NULL,
  vat_number    TEXT        NOT NULL,
  phone         TEXT        NOT NULL,
  plan          TEXT        NOT NULL DEFAULT 'basic',
  status        TEXT        NOT NULL DEFAULT 'inactive'
                            CHECK (status IN ('active','inactive','suspended')),
  starts_at     TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  activated_at  TIMESTAMPTZ,
  user_id       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT subscriptions_vat_unique   UNIQUE (vat_number),
  CONSTRAINT subscriptions_vat_format   CHECK  (vat_number ~ '^\d{15}$')
);

-- Short-lived single-use tokens that prove a subscription was verified
CREATE TABLE IF NOT EXISTS activation_tokens (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  vat_number  TEXT        NOT NULL REFERENCES subscriptions(vat_number) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activation_tokens_vat ON activation_tokens(vat_number);
