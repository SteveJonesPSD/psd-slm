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
  viewPreferences: Record<string, string>
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
  // Try with theme_preference first; fall back without it if column doesn't exist yet
  let appUser: Record<string, unknown> | null = null
  const baseFields = 'id, org_id, email, first_name, last_name, initials, color, avatar_url, must_change_password, role_id, roles(id, name, display_name)'
  const { data: d1, error: e1 } = await supabase
    .from('users')
    .select(`${baseFields}, theme_preference, view_preferences`)
    .eq('auth_id', authUser.id)
    .eq('is_active', true)
    .single()
  if (!e1 && d1) {
    appUser = d1 as Record<string, unknown>
  } else {
    // Column may not exist yet — retry without it
    const { data: d2 } = await supabase
      .from('users')
      .select(baseFields)
      .eq('auth_id', authUser.id)
      .eq('is_active', true)
      .single()
    appUser = d2 as Record<string, unknown> | null
  }

  if (!appUser) return null

  // Fetch permissions for this role
  const { data: rolePerms } = await supabase
    .from('role_permissions')
    .select('permissions(module, action)')
    .eq('role_id', appUser.role_id as string)

  const role = appUser.roles as unknown as { id: string; name: string; display_name: string }
  const permissions = (rolePerms || []).map((rp) => {
    const perm = rp.permissions as unknown as { module: string; action: string }
    return `${perm.module}.${perm.action}`
  })

  return {
    id: appUser.id as string,
    authId: authUser.id,
    orgId: appUser.org_id as string,
    email: appUser.email as string,
    firstName: appUser.first_name as string,
    lastName: appUser.last_name as string,
    initials: (appUser.initials as string) ?? null,
    color: (appUser.color as string) ?? null,
    avatarUrl: (appUser.avatar_url as string) ?? null,
    themePreference: (appUser.theme_preference as string) ?? 'system',
    viewPreferences: (appUser.view_preferences as Record<string, string>) ?? {},
    mustChangePassword: appUser.must_change_password as boolean,
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

// --- MFA helpers ---

/**
 * Check if current user has TOTP enrolled and verified.
 */
export async function getUserMfaStatus(): Promise<{
  enrolled: boolean
  factorId: string | null
}> {
  const supabase = await createClient()
  const { data } = await supabase.auth.mfa.listFactors()
  const totp = data?.totp?.find(f => f.status === 'verified')
  return {
    enrolled: !!totp,
    factorId: totp?.id ?? null,
  }
}

/**
 * Get the AAL (Authenticator Assurance Level) for the current session.
 */
export async function getMfaAssuranceLevel() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) return null
  return data
}

/**
 * Enrol a new TOTP factor — returns QR code URI and secret.
 */
export async function enrollMfaFactor(): Promise<{
  factorId: string
  qrCode: string
  secret: string
}> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    issuer: 'Innov8iv Engage',
  })
  if (error || !data) throw new Error(error?.message ?? 'MFA enrolment failed')
  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  }
}

/**
 * Verify a TOTP code during enrolment (challenges the new factor).
 */
export async function verifyMfaEnrolment(
  factorId: string,
  code: string
): Promise<void> {
  const supabase = await createClient()
  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId })
  if (challengeError || !challenge) throw new Error('MFA challenge failed')

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  })
  if (verifyError) throw new Error('Invalid code — please try again')
}

/**
 * Verify TOTP at login time.
 */
export async function verifyMfaLogin(
  factorId: string,
  code: string
): Promise<void> {
  const supabase = await createClient()
  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId })
  if (challengeError || !challenge) throw new Error('MFA challenge failed')

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  })
  if (error) throw new Error('Invalid code')
}

/**
 * Unenrol MFA factor (remove TOTP).
 */
export async function unenrolMfaFactor(factorId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) throw new Error(error.message)
}
