'use server'

import { requireAuth } from '@/lib/auth'
import { getUserMfaStatus, unenrolMfaFactor } from '@/lib/auth'
import {
  getTrustedDevices,
  revokeTrustedDevice,
  revokeAllTrustedDevices,
} from '@/lib/session'
import { getLoginMethodForEmail } from '@/lib/login-methods'
import { createClient } from '@/lib/supabase/server'

export async function getMfaStatus() {
  const user = await requireAuth()
  const status = await getUserMfaStatus()

  // Check if user's role requires MFA
  const loginConfig = await getLoginMethodForEmail(user.email)
  const mfaRequired = loginConfig.method === 'password_mfa'

  return {
    enrolled: status.enrolled,
    factorId: status.factorId,
    mfaRequired,
  }
}

export async function removeMfa(factorId: string): Promise<{ error?: string }> {
  try {
    const user = await requireAuth()

    // Prevent removal if role requires MFA
    const loginConfig = await getLoginMethodForEmail(user.email)
    if (loginConfig.method === 'password_mfa') {
      return { error: 'MFA cannot be removed while your role requires it' }
    }

    await unenrolMfaFactor(factorId)
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function fetchTrustedDevices() {
  const user = await requireAuth()
  return getTrustedDevices(user.authId)
}

export async function revokeDevice(deviceId: string): Promise<{ error?: string }> {
  try {
    await requireAuth()
    await revokeTrustedDevice(deviceId)
    return {}
  } catch {
    return { error: 'Failed to revoke device' }
  }
}

export async function revokeAllDevices(): Promise<{ error?: string }> {
  try {
    const user = await requireAuth()
    await revokeAllTrustedDevices(user.authId)
    return {}
  } catch {
    return { error: 'Failed to revoke devices' }
  }
}

export async function updatePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ error?: string }> {
  const user = await requireAuth()
  const supabase = await createClient()

  if (newPassword.length < 8) {
    return { error: 'New password must be at least 8 characters' }
  }

  // Re-authenticate
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })
  if (signInError) {
    return { error: 'Current password is incorrect' }
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  })
  if (updateError) {
    return { error: updateError.message }
  }

  return {}
}

export async function setNewPassword(newPassword: string): Promise<{ error?: string }> {
  await requireAuth()
  const supabase = await createClient()

  if (newPassword.length < 8) {
    return { error: 'Password must be at least 8 characters' }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) {
    return { error: error.message }
  }

  return {}
}

// --- Passkey management ---

export async function fetchPasskeys() {
  const user = await requireAuth()
  const { getUserPasskeys } = await import('@/lib/passkeys')
  const passkeys = await getUserPasskeys(user.authId)
  return passkeys.map(pk => ({
    id: pk.id,
    device_name: pk.device_name,
    last_used_at: pk.last_used_at,
    created_at: pk.created_at,
  }))
}

export async function removePasskey(passkeyId: string): Promise<{ error?: string }> {
  try {
    await requireAuth()
    const { deletePasskey } = await import('@/lib/passkeys')
    await deletePasskey(passkeyId)
    return {}
  } catch {
    return { error: 'Failed to remove passkey' }
  }
}

export async function renamePasskeyAction(passkeyId: string, newName: string): Promise<{ error?: string }> {
  try {
    await requireAuth()
    const { renamePasskey } = await import('@/lib/passkeys')
    await renamePasskey(passkeyId, newName)
    return {}
  } catch {
    return { error: 'Failed to rename passkey' }
  }
}
