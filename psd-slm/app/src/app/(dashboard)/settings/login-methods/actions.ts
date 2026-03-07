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

export async function getOrgPasskeyStats() {
  const user = await requireAuth()
  if (user.role.name !== 'super_admin') {
    return { totalPasskeys: 0, totalUsers: 0 }
  }

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('user_passkeys')
    .select('user_id')
    .eq('org_id', user.orgId)

  const totalPasskeys = data?.length ?? 0
  const uniqueUsers = new Set(data?.map(d => d.user_id) ?? [])
  return { totalPasskeys, totalUsers: uniqueUsers.size }
}

export async function clearAllOrgPasskeysAction(): Promise<{ error?: string; count?: number }> {
  const user = await requireAuth()
  if (user.role.name !== 'super_admin') {
    return { error: 'Super admin only' }
  }

  const { clearAllOrgPasskeys } = await import('@/lib/passkeys')
  const count = await clearAllOrgPasskeys(user.orgId)

  const supabase = createAdminClient()
  await supabase.from('activity_log').insert({
    org_id: user.orgId,
    user_id: user.id,
    entity_type: 'organisation',
    entity_id: user.orgId,
    action: 'all_passkeys_cleared',
    details: { cleared_count: count },
  })

  return { count }
}

export async function updateLoginMethod(
  role: string,
  method: LoginMethod
): Promise<{ error?: string }> {
  const user = await requireAuth()
  requireAdmin(user)

  // Guard: super_admin cannot be set to magic_link or passkey-only
  if (role === 'super_admin' && (method === 'magic_link' || method === 'passkey')) {
    return { error: 'Super Admin requires at least password authentication' }
  }

  await setLoginMethodForRole(user.orgId, role, method)
  return {}
}
