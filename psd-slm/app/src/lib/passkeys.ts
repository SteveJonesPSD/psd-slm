// lib/passkeys.ts
// WebAuthn passkey registration and authentication using @simplewebauthn/server.
// Credentials stored in user_passkeys table. Challenges stored ephemerally in passkey_challenges.
// All DB operations use admin client (server-side only).

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/types'
import { createAdminClient } from '@/lib/supabase/admin'

// --- Config from env ---
const RP_ID = process.env.WEBAUTHN_RP_ID!
const RP_NAME = process.env.WEBAUTHN_RP_NAME || 'Innov8iv Engage'
const ORIGIN = process.env.WEBAUTHN_ORIGIN!

// --- Types ---

export interface StoredPasskey {
  id: string
  user_id: string
  org_id: string
  credential_id: string
  public_key: string
  counter: number
  credential_device_type: string
  credential_backed_up: boolean
  device_name: string
  last_used_at: string | null
  created_at: string
  transports: string[] | null
}

// --- Passkey CRUD ---

export async function getUserPasskeys(userId: string): Promise<StoredPasskey[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('user_passkeys')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return (data ?? []) as StoredPasskey[]
}

export async function getPasskeyByCredentialId(credentialId: string): Promise<StoredPasskey | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('user_passkeys')
    .select('*')
    .eq('credential_id', credentialId)
    .single()
  return (data as StoredPasskey) ?? null
}

export async function deletePasskey(passkeyId: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase.from('user_passkeys').delete().eq('id', passkeyId)
}

export async function renamePasskey(passkeyId: string, newName: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase
    .from('user_passkeys')
    .update({ device_name: newName })
    .eq('id', passkeyId)
}

export async function hasPasskeyEnrolled(userId: string): Promise<boolean> {
  const passkeys = await getUserPasskeys(userId)
  return passkeys.length > 0
}

// --- Challenge management ---

async function storeChallenge(
  challenge: string,
  type: 'registration' | 'authentication',
  userId?: string
): Promise<string> {
  const supabase = createAdminClient()

  // Clean up expired challenges opportunistically
  await supabase.rpc('cleanup_expired_challenges')

  const { data } = await supabase
    .from('passkey_challenges')
    .insert({
      user_id: userId ?? null,
      challenge,
      type,
    })
    .select('id')
    .single()

  return data!.id
}

async function consumeChallenge(challengeId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('passkey_challenges')
    .select('challenge, expires_at')
    .eq('id', challengeId)
    .single()

  if (!data) return null
  if (new Date(data.expires_at) < new Date()) return null

  // Delete after consuming (one-time use)
  await supabase.from('passkey_challenges').delete().eq('id', challengeId)

  return data.challenge
}

// --- Registration ---

export async function generatePasskeyRegistrationOptions(
  userId: string,
  userEmail: string,
  userName: string
) {
  const existingPasskeys = await getUserPasskeys(userId)

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: userEmail,
    userDisplayName: userName,
    excludeCredentials: existingPasskeys.map(pk => ({
      id: pk.credential_id,
      transports: (pk.transports ?? []) as AuthenticatorTransportFuture[],
    })),
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      residentKey: 'preferred',
      userVerification: 'required',
    },
    attestationType: 'none',
  })

  const challengeId = await storeChallenge(options.challenge, 'registration', userId)

  return { options, challengeId }
}

export async function verifyPasskeyRegistration(
  challengeId: string,
  userId: string,
  orgId: string,
  response: RegistrationResponseJSON,
  deviceName: string
): Promise<{ success: boolean; error?: string }> {
  const expectedChallenge = await consumeChallenge(challengeId)
  if (!expectedChallenge) {
    return { success: false, error: 'Challenge expired or invalid' }
  }

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    })

    if (!verification.verified || !verification.registrationInfo) {
      return { success: false, error: 'Verification failed' }
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo

    const supabase = createAdminClient()
    await supabase.from('user_passkeys').insert({
      user_id: userId,
      org_id: orgId,
      credential_id: credential.id,
      public_key: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      credential_device_type: credentialDeviceType,
      credential_backed_up: credentialBackedUp,
      device_name: deviceName,
      transports: response.response.transports ?? [],
    })

    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// --- Authentication ---

export async function generatePasskeyAuthenticationOptions(userId?: string) {
  let allowCredentials: { id: string; transports?: AuthenticatorTransportFuture[] }[] | undefined

  if (userId) {
    const passkeys = await getUserPasskeys(userId)
    allowCredentials = passkeys.map(pk => ({
      id: pk.credential_id,
      transports: (pk.transports ?? []) as AuthenticatorTransportFuture[],
    }))

    if (allowCredentials.length === 0) {
      throw new Error('No passkeys enrolled for this user')
    }
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'required',
    allowCredentials,
  })

  const challengeId = await storeChallenge(
    options.challenge,
    'authentication',
    userId
  )

  return { options, challengeId }
}

export async function verifyPasskeyAuthentication(
  challengeId: string,
  response: AuthenticationResponseJSON
): Promise<{ success: boolean; userId?: string; error?: string }> {
  const expectedChallenge = await consumeChallenge(challengeId)
  if (!expectedChallenge) {
    return { success: false, error: 'Challenge expired or invalid' }
  }

  const passkey = await getPasskeyByCredentialId(response.id)
  if (!passkey) {
    return { success: false, error: 'Passkey not recognised' }
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: passkey.credential_id,
        publicKey: Buffer.from(passkey.public_key, 'base64url'),
        counter: passkey.counter,
        transports: (passkey.transports ?? []) as AuthenticatorTransportFuture[],
      },
    })

    if (!verification.verified) {
      return { success: false, error: 'Verification failed' }
    }

    // Update counter + last_used_at
    const supabase = createAdminClient()
    await supabase
      .from('user_passkeys')
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', passkey.id)

    return { success: true, userId: passkey.user_id }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// --- Admin passkey management ---

export async function clearUserPasskeys(userId: string): Promise<number> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('user_passkeys')
    .delete()
    .eq('user_id', userId)
    .select('id')
  return data?.length ?? 0
}

export async function clearAllOrgPasskeys(orgId: string): Promise<number> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('user_passkeys')
    .delete()
    .eq('org_id', orgId)
    .select('id')
  return data?.length ?? 0
}

export async function getPasskeyCount(userId: string): Promise<number> {
  const supabase = createAdminClient()
  const { count } = await supabase
    .from('user_passkeys')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  return count ?? 0
}

// --- Device name detection ---

export function derivePasskeyDeviceName(userAgent?: string): string {
  if (!userAgent) return 'Passkey'
  if (/iPhone/i.test(userAgent)) return 'iPhone Face ID'
  if (/iPad/i.test(userAgent)) return 'iPad Face ID'
  if (/Macintosh/i.test(userAgent)) return 'Mac Touch ID'
  if (/Windows/i.test(userAgent)) return 'Windows Hello'
  if (/Android/i.test(userAgent)) return 'Android Biometric'
  return 'Passkey'
}
