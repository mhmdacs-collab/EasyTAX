-- Central settings, compliant B2B customer addresses, and document-platform foundations.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS invoice_default_notes TEXT,
  ADD COLUMN IF NOT EXISTS quotation_default_notes TEXT,
  ADD COLUMN IF NOT EXISTS receipt_default_notes TEXT,
  ADD COLUMN IF NOT EXISTS receipt_default_phrase TEXT,
  ADD COLUMN IF NOT EXISTS document_settings_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'Saudi Arabia',
  ADD COLUMN IF NOT EXISTS country_code TEXT NOT NULL DEFAULT 'SA',
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS street TEXT,
  ADD COLUMN IF NOT EXISTS building_number TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS additional_number TEXT,
  ADD COLUMN IF NOT EXISTS short_address TEXT;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS uuid TEXT,
  ADD COLUMN IF NOT EXISTS issue_time TIME,
  ADD COLUMN IF NOT EXISTS organization_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS customer_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS bank_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS appearance_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS payment_details JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reference_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_document_id TEXT REFERENCES documents(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS correction_reason TEXT,
  ADD COLUMN IF NOT EXISTS zatca_status TEXT NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS zatca_icv BIGINT,
  ADD COLUMN IF NOT EXISTS zatca_pih TEXT,
  ADD COLUMN IF NOT EXISTS zatca_invoice_hash TEXT,
  ADD COLUMN IF NOT EXISTS zatca_qr_payload TEXT,
  ADD COLUMN IF NOT EXISTS zatca_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS zatca_cleared_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS documents_org_uuid_idx
  ON documents(organization_id, uuid) WHERE uuid IS NOT NULL;

CREATE TABLE IF NOT EXISTS zatca_connections (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','simulation','production')),
  status TEXT NOT NULL DEFAULT 'not_configured' CHECK (status IN ('not_configured','configured','suspended','expired')),
  egs_serial_number TEXT,
  encrypted_private_key TEXT,
  encrypted_certificate TEXT,
  encrypted_secret TEXT,
  certificate_expires_at TIMESTAMPTZ,
  last_invoice_hash TEXT,
  next_icv BIGINT NOT NULL DEFAULT 1 CHECK (next_icv > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
