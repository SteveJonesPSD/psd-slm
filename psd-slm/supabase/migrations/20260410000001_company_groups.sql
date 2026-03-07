-- ============================================================================
-- COMPANY GROUPS
-- Allows grouping customers into parent-child relationships
-- (MATs, franchise groups, NHS trusts, etc.)
-- Migration: 20260410000001_company_groups
-- ============================================================================

-- 1. Tables
CREATE TABLE company_groups (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    parent_company_id   UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    group_type          TEXT NOT NULL DEFAULT 'group',
    billing_model       TEXT NOT NULL DEFAULT 'individual',
    notes               TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, parent_company_id)
);

CREATE TABLE company_group_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    group_id        UUID NOT NULL REFERENCES company_groups(id) ON DELETE CASCADE,
    company_id      UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    colour          TEXT NOT NULL DEFAULT '#6366f1',
    display_order   INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(group_id, company_id)
);

-- 2. Indexes
CREATE INDEX idx_company_groups_org ON company_groups(org_id);
CREATE INDEX idx_company_groups_parent ON company_groups(parent_company_id);
CREATE INDEX idx_company_group_members_group ON company_group_members(group_id);
CREATE INDEX idx_company_group_members_company ON company_group_members(company_id);
CREATE INDEX idx_company_group_members_org ON company_group_members(org_id);

-- 3. RLS
ALTER TABLE company_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_groups" ON company_groups
    FOR ALL USING (org_id = auth_org_id());

CREATE POLICY "org_isolation_group_members" ON company_group_members
    FOR ALL USING (org_id = auth_org_id());

-- 4. Updated_at trigger
CREATE TRIGGER set_updated_at_company_groups
    BEFORE UPDATE ON company_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Permissions
INSERT INTO permissions (module, action, description) VALUES
    ('companies', 'manage_groups', 'Create and manage company groups')
ON CONFLICT (module, action) DO NOTHING;

-- Grant to admin and super_admin roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('super_admin', 'admin', 'sales')
  AND p.module = 'companies' AND p.action = 'manage_groups'
ON CONFLICT DO NOTHING;

-- 6. Add is_group_admin flag to portal_users
ALTER TABLE portal_users
    ADD COLUMN IF NOT EXISTS is_group_admin BOOLEAN NOT NULL DEFAULT false;
