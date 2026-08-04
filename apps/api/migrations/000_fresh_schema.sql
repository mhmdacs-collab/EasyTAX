-- EasyTAX canonical schema. Destructive by design: use only for a full reset.
DROP SCHEMA IF EXISTS neon_auth CASCADE;

DROP TABLE IF EXISTS
  sync_log, tax_returns, tax_periods, expenses, purchase_invoice_items,
  purchase_invoices, expense_categories, document_terms, document_payments,
  document_items, documents, projects, catalog_items, suppliers, customers,
  document_sequences, quotation_terms, payment_methods, activation_tokens,
  subscriptions, subscription_events, organizations, admin_users, verification, session, account,
  "user"
CASCADE;

CREATE TABLE "user" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  image TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE account (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  access_token TEXT, refresh_token TEXT, id_token TEXT,
  access_token_expires_at TIMESTAMPTZ, refresh_token_expires_at TIMESTAMPTZ,
  scope TEXT, password TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider_id, account_id)
);

CREATE TABLE session (
  id TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT, user_agent TEXT,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE TABLE verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE admin_users (
  user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE organizations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE RESTRICT,
  business_name TEXT NOT NULL,
  vat_number TEXT NOT NULL UNIQUE CHECK (vat_number ~ '^\d{15}$'),
  commercial_registration TEXT,
  phone TEXT NOT NULL,
  phone_e164 TEXT,
  email TEXT,
  show_phone_on_documents BOOLEAN NOT NULL DEFAULT FALSE,
  show_email_on_documents BOOLEAN NOT NULL DEFAULT FALSE,
  country TEXT NOT NULL DEFAULT 'Saudi Arabia',
  country_code TEXT NOT NULL DEFAULT 'SA',
  city TEXT, district TEXT, street TEXT,
  building_number TEXT, postal_code TEXT, additional_number TEXT,
  short_address TEXT,
  plan TEXT NOT NULL,
  subscription_duration_days INTEGER NOT NULL CHECK (subscription_duration_days > 0),
  subscription_starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  subscription_expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
  onboarding_completed_at TIMESTAMPTZ,
  bank_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  bank_name TEXT, bank_account_name TEXT, iban TEXT,
  logo_url TEXT, stamp_url TEXT, signature_url TEXT,
  stamp_on_invoice BOOLEAN NOT NULL DEFAULT FALSE,
  stamp_on_quotation BOOLEAN NOT NULL DEFAULT FALSE,
  stamp_on_receipt BOOLEAN NOT NULL DEFAULT FALSE,
  signature_on_invoice BOOLEAN NOT NULL DEFAULT FALSE,
  signature_on_quotation BOOLEAN NOT NULL DEFAULT FALSE,
  signature_on_receipt BOOLEAN NOT NULL DEFAULT FALSE,
  tax_name TEXT NOT NULL DEFAULT 'ضريبة القيمة المضافة' CHECK (tax_name = 'ضريبة القيمة المضافة'),
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 15.00 CHECK (tax_rate = 15.00),
  tax_code TEXT NOT NULL DEFAULT 'S' CHECK (tax_code = 'S'),
  prices_include_tax BOOLEAN,
  retention_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  invoice_default_notes TEXT, quotation_default_notes TEXT,
  receipt_default_notes TEXT, receipt_default_phrase TEXT,
  document_settings_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT organizations_completed_profile_check CHECK (
    onboarding_completed_at IS NULL OR (
      NULLIF(BTRIM(commercial_registration), '') IS NOT NULL AND
      NULLIF(BTRIM(city), '') IS NOT NULL AND
      NULLIF(BTRIM(district), '') IS NOT NULL AND
      NULLIF(BTRIM(street), '') IS NOT NULL AND
      country = 'Saudi Arabia' AND country_code = 'SA' AND
      prices_include_tax IS NOT NULL AND
      (NOT bank_enabled OR (
        NULLIF(BTRIM(bank_name), '') IS NOT NULL AND
        NULLIF(BTRIM(bank_account_name), '') IS NOT NULL AND
        NULLIF(BTRIM(iban), '') IS NOT NULL
      ))
    )
  )
);

CREATE TABLE subscription_events (
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

CREATE TABLE payment_methods (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_collected BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

CREATE TABLE quotation_terms (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  text TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE document_sequences (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('invoice','quotation','receipt')),
  prefix TEXT NOT NULL DEFAULT '', next_number BIGINT NOT NULL DEFAULT 1 CHECK (next_number > 0),
  UNIQUE (organization_id, document_type)
);

CREATE TABLE customers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, vat_number TEXT, commercial_registration TEXT,
  phone TEXT, phone_e164 TEXT, email TEXT, address TEXT, notes TEXT,
  country TEXT NOT NULL DEFAULT 'Saudi Arabia', country_code TEXT NOT NULL DEFAULT 'SA',
  city TEXT, district TEXT, street TEXT, building_number TEXT, postal_code TEXT,
  additional_number TEXT, short_address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ,
  sync_version INTEGER NOT NULL DEFAULT 1 CHECK (sync_version > 0)
);

CREATE TABLE suppliers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, vat_number TEXT, phone TEXT, email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ
);

CREATE TABLE catalog_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, description TEXT, unit TEXT, default_price NUMERIC(18,4),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ
);

CREATE TABLE documents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('invoice','quotation','receipt')),
  number TEXT NOT NULL, issue_date DATE NOT NULL DEFAULT CURRENT_DATE, due_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','paid','partially_paid','cancelled')),
  prices_include_tax BOOLEAN NOT NULL,
  retention_basis TEXT CHECK (retention_basis IN ('before_tax','including_tax')),
  subtotal NUMERIC(18,4) NOT NULL DEFAULT 0, discount_total NUMERIC(18,4) NOT NULL DEFAULT 0, tax_total NUMERIC(18,4) NOT NULL DEFAULT 0,
  retention_total NUMERIC(18,4) NOT NULL DEFAULT 0, total NUMERIC(18,4) NOT NULL DEFAULT 0,
  collected_total NUMERIC(18,4) NOT NULL DEFAULT 0, due_total NUMERIC(18,4) NOT NULL DEFAULT 0,
  show_bank_details BOOLEAN NOT NULL DEFAULT FALSE,
  show_stamp BOOLEAN NOT NULL DEFAULT FALSE, show_signature BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT, pdf_url TEXT, uuid TEXT, issue_time TIME,
  organization_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  customer_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  bank_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  appearance_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  payment_details JSONB NOT NULL DEFAULT '[]'::jsonb,
  reference_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_document_id TEXT REFERENCES documents(id) ON DELETE RESTRICT,
  correction_reason TEXT,
  zatca_status TEXT NOT NULL DEFAULT 'not_submitted', zatca_icv BIGINT,
  zatca_pih TEXT, zatca_invoice_hash TEXT, zatca_qr_payload TEXT,
  zatca_response JSONB NOT NULL DEFAULT '{}'::jsonb, zatca_cleared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ,
  sync_version INTEGER NOT NULL DEFAULT 1 CHECK (sync_version > 0),
  UNIQUE (organization_id, type, number)
);

CREATE TABLE document_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  catalog_item_id TEXT REFERENCES catalog_items(id) ON DELETE SET NULL,
  description TEXT NOT NULL, unit TEXT, quantity NUMERIC(18,4) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(18,4) NOT NULL CHECK (unit_price >= 0), discount NUMERIC(18,4) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 15.00, retention_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  line_subtotal NUMERIC(18,4) NOT NULL, line_tax NUMERIC(18,4) NOT NULL,
  line_retention NUMERIC(18,4) NOT NULL DEFAULT 0, line_total NUMERIC(18,4) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE document_payments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  payment_method_id TEXT REFERENCES payment_methods(id) ON DELETE SET NULL,
  payment_method_name TEXT NOT NULL, amount NUMERIC(18,4) NOT NULL CHECK (amount > 0),
  is_collected BOOLEAN NOT NULL, paid_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE document_terms (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  text TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE zatca_connections (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','simulation','production')),
  status TEXT NOT NULL DEFAULT 'not_configured' CHECK (status IN ('not_configured','configured','suspended','expired')),
  egs_serial_number TEXT, encrypted_private_key TEXT, encrypted_certificate TEXT, encrypted_secret TEXT,
  certificate_expires_at TIMESTAMPTZ, last_invoice_hash TEXT,
  next_icv BIGINT NOT NULL DEFAULT 1 CHECK (next_icv > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE expense_categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (organization_id, name)
);

CREATE TABLE purchase_invoices (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
  invoice_number TEXT, invoice_date DATE, subtotal NUMERIC(18,4) NOT NULL DEFAULT 0,
  tax_total NUMERIC(18,4) NOT NULL DEFAULT 0, total NUMERIC(18,4) NOT NULL DEFAULT 0,
  include_in_tax_return BOOLEAN NOT NULL DEFAULT FALSE,
  qr_payload TEXT, qr_extraction_status TEXT CHECK (qr_extraction_status IN ('extracted','failed','manual')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('qr','manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ
);

CREATE TABLE purchase_invoice_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  purchase_invoice_id TEXT NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL, quantity NUMERIC(18,4) NOT NULL DEFAULT 1,
  unit_price NUMERIC(18,4) NOT NULL DEFAULT 0, tax_rate NUMERIC(5,2) NOT NULL DEFAULT 15,
  line_subtotal NUMERIC(18,4) NOT NULL DEFAULT 0, line_tax NUMERIC(18,4) NOT NULL DEFAULT 0,
  line_total NUMERIC(18,4) NOT NULL DEFAULT 0
);

CREATE TABLE expenses (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES expense_categories(id) ON DELETE SET NULL,
  supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
  description TEXT NOT NULL, expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(18,4) NOT NULL CHECK (amount >= 0), tax_amount NUMERIC(18,4) NOT NULL DEFAULT 0,
  include_in_tax_return BOOLEAN NOT NULL DEFAULT FALSE, attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ
);

CREATE TABLE tax_periods (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  starts_on DATE NOT NULL, ends_on DATE NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','filed','closed')),
  UNIQUE (organization_id, starts_on, ends_on), CHECK (ends_on >= starts_on)
);

CREATE TABLE tax_returns (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tax_period_id TEXT NOT NULL UNIQUE REFERENCES tax_periods(id) ON DELETE CASCADE,
  sales_tax NUMERIC(18,4) NOT NULL DEFAULT 0, purchase_tax NUMERIC(18,4) NOT NULL DEFAULT 0,
  net_tax NUMERIC(18,4) NOT NULL DEFAULT 0, snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','filed')),
  filed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sync_log (
  id BIGSERIAL PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, operation TEXT NOT NULL CHECK (operation IN ('create','update','delete')),
  version INTEGER NOT NULL, payload JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX account_user_idx ON account(user_id);
CREATE INDEX session_user_idx ON session(user_id);
CREATE INDEX organization_status_idx ON organizations(status) WHERE deleted_at IS NULL;
CREATE INDEX subscription_events_org_idx ON subscription_events(organization_id, created_at DESC);
CREATE INDEX customer_org_idx ON customers(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX supplier_org_idx ON suppliers(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX document_org_date_idx ON documents(organization_id, issue_date DESC) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX documents_org_uuid_idx ON documents(organization_id, uuid) WHERE uuid IS NOT NULL;
CREATE INDEX purchase_org_date_idx ON purchase_invoices(organization_id, invoice_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX expense_org_date_idx ON expenses(organization_id, expense_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX sync_log_org_idx ON sync_log(organization_id, id);
