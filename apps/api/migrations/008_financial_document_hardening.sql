ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

ALTER TABLE customer_receipts
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'issued',
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS source_document_id TEXT REFERENCES documents(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS source_payment_id TEXT REFERENCES document_payments(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS request_id TEXT;

ALTER TABLE customer_receipts
  ADD CONSTRAINT customer_receipts_status_check CHECK (status IN ('issued','cancelled'));

CREATE UNIQUE INDEX IF NOT EXISTS customer_receipts_source_payment_uidx
  ON customer_receipts (source_payment_id) WHERE source_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS customer_receipts_request_uidx
  ON customer_receipts (organization_id, request_id) WHERE request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS financial_audit_events (
  id BIGSERIAL PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('document','receipt')),
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('issued','cancelled','reversed')),
  reason TEXT,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS financial_audit_org_created_idx
  ON financial_audit_events (organization_id, created_at DESC);

