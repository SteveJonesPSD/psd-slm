import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export interface AuthUser {
  id: string
  authId: string
  orgId: string
  email: string
  firstName: string
  lastName: string
  initials: string | null
  color: string | null
  avatarUrl: string | null
  themePreference: string
  mustChangePassword: boolean
  role: {
    id: string
    name: string
    displayName: string
  }
  permissions: string[] // ['customers.view', 'customers.create', ...]
}

/**
 * Get the authenticated user with role and permissions.
 * Cached per request via React cache() — safe to call multiple times.
 */
export const getUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) return null

  // Fetch app user with role join
  const { data: appUser } = await supabase
    .from('users')
    .select('id, org_id, email, first_name, last_name, initials, color, avatar_url, theme_preference, must_change_password, role_id, roles(id, name, display_name)')
    .eq('auth_id', authUser.id)
    .eq('is_active', true)
    .single()

  if (!appUser) return null

  // Fetch permissions for this role
  const { data: rolePerms } = await supabase
    .from('role_permissions')
    .select('permissions(module, action)')
    .eq('role_id', appUser.role_id)

  const role = appUser.roles as unknown as { id: string; name: string; display_name: string }
  const permissions = (rolePerms || []).map((rp) => {
    const perm = rp.permissions as unknown as { module: string; action: string }
    return `${perm.module}.${perm.action}`
  })

  return {
    id: appUser.id,
    authId: authUser.id,
    orgId: appUser.org_id,
    email: appUser.email,
    firstName: appUser.first_name,
    lastName: appUser.last_name,
    initials: appUser.initials,
    color: appUser.color,
    avatarUrl: appUser.avatar_url,
    themePreference: appUser.theme_preference ?? 'system',
    mustChangePassword: appUser.must_change_password,
    role: {
      id: role.id,
      name: role.name,
      displayName: role.display_name,
    },
    permissions,
  }
})

/**
 * Require authentication — redirects to login if not authenticated.
 * Use in Server Components and Server Actions.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getUser()
  if (!user) {
    redirect('/auth/login')
  }
  return user
}

/**
 * Require a specific permission — redirects if not authenticated,
 * throws if permission missing.
 */
export async function requirePermission(
  module: string,
  action: string
): Promise<AuthUser> {
  const user = await requireAuth()
  if (!hasPermission(user, module, action)) {
    throw new Error(`Permission denied: ${module}.${action}`)
  }
  return user
}

/**
 * Check if a user has a specific permission.
 */
export function hasPermission(
  user: AuthUser,
  module: string,
  action: string
): boolean {
  return user.permissions.includes(`${module}.${action}`)
}

/**
 * Check if a user has any of the given permissions.
 */
export function hasAnyPermission(
  user: AuthUser,
  checks: { module: string; action: string }[]
): boolean {
  return checks.some((c) => hasPermission(user, c.module, c.action))
}
