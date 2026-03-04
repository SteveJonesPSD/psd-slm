-- ============================================================================
-- Departments & Escalation Routing
-- Migration: 20260303000003_departments
-- ============================================================================

-- ============================================================================
-- 1. DEPARTMENTS
-- ============================================================================
CREATE TABLE departments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  escalation_type TEXT NOT NULL DEFAULT 'sideways' CHECK (escalation_type IN ('sideways', 'upward')),
  priority_uplift INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_departments_org ON departments(org_id);

-- ============================================================================
-- 2. DEPARTMENT MEMBERS
-- ============================================================================
CREATE TABLE department_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('manager', 'member')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(department_id, user_id)
);

CREATE INDEX idx_department_members_dept ON department_members(department_id);
CREATE INDEX idx_department_members_user ON department_members(user_id);

-- ============================================================================
-- 3. EXTEND TICKETS TABLE
-- ============================================================================
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);

CREATE INDEX idx_tickets_department ON tickets(department_id) WHERE department_id IS NOT NULL;

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_members ENABLE ROW LEVEL SECURITY;

-- departments
CREATE POLICY departments_select ON departments FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY departments_insert ON departments FOR INSERT
  WITH CHECK (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));
CREATE POLICY departments_update ON departments FOR UPDATE
  USING (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));
CREATE POLICY departments_delete ON departments FOR DELETE
  USING (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));

-- department_members (org-scoped via department join)
CREATE POLICY department_members_select ON department_members FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM departments d WHERE d.id = department_members.department_id AND d.org_id = auth_org_id()
  ));
CREATE POLICY department_members_insert ON department_members FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM departments d WHERE d.id = department_members.department_id AND d.org_id = auth_org_id()
  ) AND auth_has_permission('helpdesk', 'admin'));
CREATE POLICY department_members_delete ON department_members FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM departments d WHERE d.id = department_members.department_id AND d.org_id = auth_org_id()
  ) AND auth_has_permission('helpdesk', 'admin'));
CREATE POLICY department_members_update ON department_members FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM departments d WHERE d.id = department_members.department_id AND d.org_id = auth_org_id()
  ) AND auth_has_permission('helpdesk', 'admin'));
