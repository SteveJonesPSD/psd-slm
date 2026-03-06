-- =============================================================================
-- Add is_shipping and is_portal_user flags to contacts
-- =============================================================================

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_shipping BOOLEAN DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_portal_user BOOLEAN DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_portal_admin BOOLEAN DEFAULT false;

-- Portal admin and portal user are mutually exclusive
ALTER TABLE contacts ADD CONSTRAINT chk_portal_role
  CHECK (NOT (is_portal_user AND is_portal_admin));
