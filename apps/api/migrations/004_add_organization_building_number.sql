ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS building_number TEXT;
