'use server'

import { requireAuth } from '@/lib/auth'
import { getLoginMethodSettings, setLoginMethodForRole, type LoginMethod } from '@/lib/login-methods'
import { createAdminClient } from '@/lib/supabase/admin'

function requireAdmin(user: { role: { name: string } }) {
  if (!['super_admin', 'admin'].includes(user.role.name)) {
    throw new Error('Permission denied')
  }
}

export async function fetchLoginMethods() {
  const user = await requireAuth()
  requireAdmin(user)

  const settings = await getLoginMethodSettings(user.orgId)

  // Get user counts per role
  const supabase = createAdminClient()
  const { data: roleCounts } = await supabase
    .from('users')
    .select('roles!inner(name)')
    .eq('org_id', user.orgId)
    .eq('is_active', true)

  const countsByRole: Record<string, number> = {}
  for (const row of roleCounts ?? []) {
    const roleName = (row.roles as unknown as { name: string }).name
    countsByRole[roleName] = (countsByRole[roleName] || 0) + 1
  }

  return { settings, countsByRole }
}

export async function updateLoginMethod(
  role: string,
  method: LoginMethod
): Promise<{ error?: string }> {
  const user = await requireAuth()
  requireAdmin(user)

  // Guard: super_admin cannot be set to magic_link
  if (role === 'super_admin' && method === 'magic_link') {
    return { error: 'Super Admin requires at least password authentication' }
  }

  await setLoginMethodForRole(user.orgId, role, method)
  return {}
}
