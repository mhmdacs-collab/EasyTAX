ALTER TABLE organizations
  ALTER COLUMN tax_name SET DEFAULT 'ضريبة القيمة المضافة';

UPDATE organizations
SET tax_name = 'ضريبة القيمة المضافة', tax_rate = 15.00, tax_code = 'S'
WHERE tax_name IS DISTINCT FROM 'ضريبة القيمة المضافة'
   OR tax_rate IS DISTINCT FROM 15.00
   OR tax_code IS DISTINCT FROM 'S';

ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_tax_rate_check;

ALTER TABLE organizations
  ADD CONSTRAINT organizations_tax_name_fixed_check CHECK (tax_name = 'ضريبة القيمة المضافة'),
  ADD CONSTRAINT organizations_tax_rate_fixed_check CHECK (tax_rate = 15.00),
  ADD CONSTRAINT organizations_tax_code_fixed_check CHECK (tax_code = 'S'),
  ADD CONSTRAINT organizations_completed_profile_check CHECK (
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
  ) NOT VALID;

ALTER TABLE organizations VALIDATE CONSTRAINT organizations_completed_profile_check;
