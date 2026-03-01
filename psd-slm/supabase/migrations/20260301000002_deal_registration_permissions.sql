-- ============================================================================
-- Deal Registrations Module — Permissions & RLS Policy Updates
-- Migration: 20260301000002_deal_registration_permissions
-- ============================================================================

-- 1. Add deal_registrations permissions
INSERT INTO permissions (module, action, description) VALUES
  ('deal_registrations', 'view', 'View deal registrations'),
  ('deal_registrations', 'create', 'Create deal registrations'),
  ('deal_registrations', 'edit_own', 'Edit own deal registrations'),
  ('deal_registrations', 'edit_all', 'Edit any deal registration'),
  ('deal_registrations', 'delete', 'Delete deal registrations')
ON CONFLICT (module, action) DO NOTHING;

-- 2. Drop old RLS policies that used suppliers permissions
DROP POLICY IF EXISTS "deal_regs_select" ON deal_registrations;
DROP POLICY IF EXISTS "deal_regs_insert" ON deal_registrations;
DROP POLICY IF EXISTS "deal_regs_update" ON deal_registrations;
DROP POLICY IF EXISTS "deal_regs_delete" ON deal_registrations;
DROP POLICY IF EXISTS "deal_reg_lines_select" ON deal_registration_lines;
DROP POLICY IF EXISTS "deal_reg_lines_insert" ON deal_registration_lines;
DROP POLICY IF EXISTS "deal_reg_lines_update" ON deal_registration_lines;
DROP POLICY IF EXISTS "deal_reg_lines_delete" ON deal_registration_lines;

-- 3. Create new RLS policies using deal_registrations permissions

-- Deal Registrations (org-scoped header table)
CREATE POLICY "deal_regs_select" ON deal_registrations FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "deal_regs_insert" ON deal_registrations FOR INSERT
  WITH CHECK (org_id = auth_org_id() AND auth_has_permission('deal_registrations', 'create'));

CREATE POLICY "deal_regs_update" ON deal_registrations FOR UPDATE
  USING (
    org_id = auth_org_id()
    AND (
      auth_has_permission('deal_registrations', 'edit_all')
      OR (auth_has_permission('deal_registrations', 'edit_own') AND registered_by = auth_user_id())
    )
  );

CREATE POLICY "deal_regs_delete" ON deal_registrations FOR DELETE
  USING (org_id = auth_org_id() AND auth_has_permission('deal_registrations', 'delete'));

-- Deal Registration Lines (child table, org scoped via parent)
CREATE POLICY "deal_reg_lines_select" ON deal_registration_lines FOR SELECT
  USING (EXISTS (SELECT 1 FROM deal_registrations dr WHERE dr.id = deal_reg_id AND dr.org_id = auth_org_id()));

CREATE POLICY "deal_reg_lines_insert" ON deal_registration_lines FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM deal_registrations dr WHERE dr.id = deal_reg_id AND dr.org_id = auth_org_id())
    AND auth_has_permission('deal_registrations', 'create')
  );

CREATE POLICY "deal_reg_lines_update" ON deal_registration_lines FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM deal_registrations dr
      WHERE dr.id = deal_reg_id
        AND dr.org_id = auth_org_id()
        AND (
          auth_has_permission('deal_registrations', 'edit_all')
          OR (auth_has_permission('deal_registrations', 'edit_own') AND dr.registered_by = auth_user_id())
        )
    )
  );

CREATE POLICY "deal_reg_lines_delete" ON deal_registration_lines FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM deal_registrations dr
      WHERE dr.id = deal_reg_id
        AND dr.org_id = auth_org_id()
    )
    AND (
      auth_has_permission('deal_registrations', 'delete')
      OR auth_has_permission('deal_registrations', 'edit_all')
      OR (auth_has_permission('deal_registrations', 'edit_own') AND EXISTS (
        SELECT 1 FROM deal_registrations dr
        WHERE dr.id = deal_reg_id AND dr.registered_by = auth_user_id()
      ))
    )
  );
