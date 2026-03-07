'use server'

import { getLoginMethodForEmail, type LoginMethod } from '@/lib/login-methods'
import { getUserMfaStatus, verifyMfaLogin } from '@/lib/auth'
import { isDeviceTrusted, trustDevice } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'

export async function resolveLoginMethod(email: string): Promise<{
  method: LoginMethod
  hasPassword: boolean
  hasPasskey: boolean
  error?: string
}> {
  if (!email || !email.includes('@')) {
    return { method: 'password', hasPassword: false, hasPasskey: false, error: 'Please enter a valid email address' }
  }

  const result = await getLoginMethodForEmail(email)
  return result
}

export async function sendMagicLink(email: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }
  return {}
}

export async function signInWithPassword(email: string, password: string): Promise<{
  error?: string
  mfaRequired?: boolean
  mfaNotEnrolled?: boolean
  factorId?: string
  deviceTrusted?: boolean
}> {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    console.error('[login] signInWithPassword failed:', error.message, 'email:', email)
    return { error: error.message }
  }

  // Check if this role requires MFA
  const result = await getLoginMethodForEmail(email)
  if (result.method === 'password_mfa') {
    const mfaStatus = await getUserMfaStatus()

    if (!mfaStatus.enrolled) {
      return { mfaNotEnrolled: true }
    }

    // Check trusted device
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const trusted = await isDeviceTrusted(user.id)
      if (trusted) {
        return { deviceTrusted: true }
      }
    }

    return { mfaRequired: true, factorId: mfaStatus.factorId! }
  }

  // For password_passkey, check if TOTP is available as fallback
  if (result.method === 'password_passkey') {
    const mfaStatus = await getUserMfaStatus()
    if (mfaStatus.enrolled && mfaStatus.factorId) {
      return { factorId: mfaStatus.factorId }
    }
  }

  return {}
}

export async function verifyMfaCode(factorId: string, code: string): Promise<{
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Challenge and verify must use the same client instance
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId })

    if (challengeError) {
      console.error('[mfa] challenge failed:', challengeError.message)
      return { error: `Challenge failed: ${challengeError.message}` }
    }
    if (!challenge) {
      console.error('[mfa] challenge returned no data')
      return { error: 'MFA challenge failed — no data returned' }
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    })

    if (verifyError) {
      console.error('[mfa] verify failed:', verifyError.message)
      return { error: verifyError.message }
    }

    return {}
  } catch (e) {
    console.error('[mfa] unexpected error:', e)
    return { error: (e as Error).message }
  }
}

export async function trustCurrentDevice(): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    // Get org_id from users table
    const adminClient = createAdminClient()
    const { data: profile } = await adminClient
      .from('users')
      .select('org_id')
      .eq('auth_id', user.id)
      .single()

    if (!profile) return { error: 'User profile not found' }

    const headerStore = await headers()
    const userAgent = headerStore.get('user-agent') ?? undefined
    await trustDevice(user.id, profile.org_id, userAgent)
    return {}
  } catch {
    return { error: 'Failed to trust device' }
  }
}
