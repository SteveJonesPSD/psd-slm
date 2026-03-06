import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { RolesAdmin } from './roles-admin'
import type { Role, Permission } from '@/types/database'

export default async function RolesPage() {
  const user = await requirePermission('settings', 'view')
  const supabase = await createClient()

  const [{ data: roles }, { data: permissions }] = await Promise.all([
    supabase
      .from('roles')
      .select('*, users(count)')
      .eq('org_id', user.orgId)
      .order('sort_order'),
    supabase
      .from('permissions')
      .select('*')
      .order('module')
      .order('action'),
  ])

  const rolesWithCount = (roles ?? []).map((r: Record<string, unknown>) => ({
    ...(r as unknown as Role),
    user_count: Array.isArray(r.users) ? (r.users[0] as { count: number })?.count ?? 0 : 0,
  }))

  // Fetch all role_permissions for all roles in one query
  const { data: allRolePerms } = await supabase
    .from('role_permissions')
    .select('role_id, permission_id')

  const rolePermMap: Record<string, string[]> = {}
  for (const rp of allRolePerms ?? []) {
    if (!rolePermMap[rp.role_id]) rolePermMap[rp.role_id] = []
    rolePermMap[rp.role_id].push(rp.permission_id)
  }

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        subtitle="Manage team roles and what each role can access"
      />
      <RolesAdmin
        initialRoles={rolesWithCount}
        permissions={permissions ?? []}
        rolePermMap={rolePermMap}
        canEdit={user.permissions.includes('settings.edit_all')}
      />
    </div>
  )
}
