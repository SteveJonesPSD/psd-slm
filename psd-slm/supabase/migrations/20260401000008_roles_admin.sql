-- ============================================================================
-- Roles & Permissions Admin
-- Allows admin users (not just super_admin) to manage roles and permissions
-- via the Settings → Roles & Permissions UI.
-- ============================================================================

-- 1. Update RLS on roles: allow admin to insert/update custom roles
DROP POLICY IF EXISTS "roles_insert" ON roles;
DROP POLICY IF EXISTS "roles_update" ON roles;
DROP POLICY IF EXISTS "roles_delete" ON roles;

CREATE POLICY "roles_insert" ON roles FOR INSERT
  WITH CHECK (org_id = auth_org_id() AND auth_has_permission('settings', 'edit_all'));

CREATE POLICY "roles_update" ON roles FOR UPDATE
  USING (org_id = auth_org_id() AND auth_has_permission('settings', 'edit_all'));

CREATE POLICY "roles_delete" ON roles FOR DELETE
  USING (org_id = auth_org_id() AND auth_has_permission('settings', 'edit_all') AND is_system = false);

-- 2. Update RLS on role_permissions: allow admin to manage assignments
DROP POLICY IF EXISTS "role_perms_insert" ON role_permissions;
DROP POLICY IF EXISTS "role_perms_delete" ON role_permissions;

CREATE POLICY "role_perms_insert" ON role_permissions FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM roles r WHERE r.id = role_id AND r.org_id = auth_org_id())
    AND auth_has_permission('settings', 'edit_all')
  );

CREATE POLICY "role_perms_delete" ON role_permissions FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM roles r WHERE r.id = role_id AND r.org_id = auth_org_id())
    AND auth_has_permission('settings', 'edit_all')
  );
