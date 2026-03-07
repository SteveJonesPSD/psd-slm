// lib/login-methods.ts
// Resolves which login method a user should use, based on their role
// and the org's configured login method policy in org_settings.

import { createAdminClient } from '@/lib/supabase/admin'

export type LoginMethod = 'magic_link' | 'password' | 'password_mfa'
// FUTURE: Add 'passkey' | 'password_passkey' to LoginMethod type when WebAuthn phase is built
// FUTURE: Add 'microsoft_sso' | 'microsoft_sso_mfa' to LoginMethod type when M365 SSO phase is built

// Default fallback if no setting exists for a role.
// 'password' is the safest middle ground — not locked out, not wide open.
const DEFAULT_LOGIN_METHOD: LoginMethod = 'password'

/**
 * Look up the login method for a user by email.
 * Called BEFORE authentication — uses admin client.
 *
 * IMPORTANT: Must not leak whether an account exists.
 * Returns 'password' for unknown emails (same as default).
 *
 * TODO: When field-level encryption is added, this function queries
 * by email and will need updating to use the blind index.
 */
export async function getLoginMethodForEmail(email: string): Promise<{
  method: LoginMethod
  hasPassword: boolean
}> {
  const supabase = createAdminClient()

  // TODO: Replace listUsers() with direct email lookup for scale.
  // For PSD Group with ~10 users, pagination isn't an issue.
  const { data: { users }, error } = await supabase.auth.admin.listUsers()

  // Find matching user (case-insensitive)
  const user = error ? null : users?.find(
    u => u.email?.toLowerCase() === email.toLowerCase()
  )

  if (!user) {
    // Don't reveal that the account doesn't exist
    return { method: DEFAULT_LOGIN_METHOD, hasPassword: false }
  }

  // Get user's role from users table
  const { data: profile } = await supabase
    .from('users')
    .select('role:roles!inner(name), org_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile) {
    return { method: DEFAULT_LOGIN_METHOD, hasPassword: false }
  }

  const roleName = (profile.role as unknown as { name: string }).name

  // Get org's login method config for this role
  const { data: setting } = await supabase
    .from('org_settings')
    .select('setting_value')
    .eq('org_id', profile.org_id)
    .eq('category', 'login_methods')
    .eq('setting_key', roleName)
    .single()

  const method = (setting?.setting_value as LoginMethod) ?? DEFAULT_LOGIN_METHOD

  // Check if user has a password set.
  // Users created via admin API with a password will have identities with provider 'email'.
  const hasPassword = user.identities?.some(
    i => i.provider === 'email'
  ) ?? false

  return { method, hasPassword }
}

/**
 * Get all login method settings for an org (for the settings page).
 */
export async function getLoginMethodSettings(orgId: string): Promise<
  Record<string, LoginMethod>
> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('org_settings')
    .select('setting_key, setting_value')
    .eq('org_id', orgId)
    .eq('category', 'login_methods')

  const settings: Record<string, LoginMethod> = {}
  for (const row of data ?? []) {
    settings[row.setting_key] = row.setting_value as LoginMethod
  }
  return settings
}

/**
 * Update the login method for a specific role in an org.
 * Admin/super_admin only.
 */
export async function setLoginMethodForRole(
  orgId: string,
  role: string,
  method: LoginMethod
): Promise<void> {
  const supabase = createAdminClient()

  await supabase
    .from('org_settings')
    .upsert({
      org_id: orgId,
      category: 'login_methods',
      setting_key: role,
      setting_value: method,
    }, {
      onConflict: 'org_id,setting_key'
    })
}
