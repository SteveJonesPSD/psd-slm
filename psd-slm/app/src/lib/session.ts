// lib/session.ts
// Remember-device logic for reducing MFA friction on trusted devices.
// Uses httpOnly, secure, sameSite=strict cookies — never accessible from client JS.
// Device tokens are HMAC-signed with SESSION_DEVICE_SECRET to prevent forgery.

import { createHmac, randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

const COOKIE_NAME = 'engage_trusted_device'
const DEVICE_EXPIRY_DAYS = 30
const SECRET = process.env.SESSION_DEVICE_SECRET ?? ''

export function generateDeviceToken(): string {
  const raw = randomBytes(32).toString('hex')
  const hmac = createHmac('sha256', SECRET).update(raw).digest('hex')
  return `${raw}.${hmac}`
}

export function validateDeviceToken(token: string): boolean {
  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [raw, hmac] = parts
  if (!raw || !hmac) return false
  const expected = createHmac('sha256', SECRET).update(raw).digest('hex')
  return hmac === expected
}

export async function getDeviceTokenFromCookie(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value ?? null
}

export async function setDeviceTokenCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * DEVICE_EXPIRY_DAYS,
    path: '/',
  })
}

export async function clearDeviceTokenCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function isDeviceTrusted(userId: string): Promise<boolean> {
  const token = await getDeviceTokenFromCookie()
  if (!token || !validateDeviceToken(token)) return false

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('trusted_devices')
    .select('id, expires_at')
    .eq('user_id', userId)
    .eq('device_token', token)
    .single()

  if (!data) return false

  if (new Date(data.expires_at) < new Date()) {
    await supabase.from('trusted_devices').delete().eq('id', data.id)
    await clearDeviceTokenCookie()
    return false
  }

  // Update last_used_at
  await supabase
    .from('trusted_devices')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)

  return true
}

export async function trustDevice(
  userId: string,
  orgId: string,
  userAgent?: string
): Promise<string> {
  const token = generateDeviceToken()
  const supabase = createAdminClient()
  const deviceName = deriveDeviceName(userAgent)

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + DEVICE_EXPIRY_DAYS)

  await supabase.from('trusted_devices').insert({
    user_id: userId,
    org_id: orgId,
    device_token: token,
    device_name: deviceName,
    expires_at: expiresAt.toISOString(),
  })

  await setDeviceTokenCookie(token)
  return token
}

export async function revokeTrustedDevice(deviceId: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase.from('trusted_devices').delete().eq('id', deviceId)
}

export async function revokeAllTrustedDevices(userId: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase.from('trusted_devices').delete().eq('user_id', userId)
}

export async function getTrustedDevices(userId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('trusted_devices')
    .select('id, device_name, last_used_at, created_at, expires_at')
    .eq('user_id', userId)
    .order('last_used_at', { ascending: false })

  return data ?? []
}

function deriveDeviceName(userAgent?: string): string {
  if (!userAgent) return 'Unknown device'
  if (/iPhone|iPad/i.test(userAgent)) return 'iPhone/iPad'
  if (/Android/i.test(userAgent)) return 'Android device'
  if (/Macintosh/i.test(userAgent)) return 'Mac'
  if (/Windows/i.test(userAgent)) return 'Windows PC'
  if (/Linux/i.test(userAgent)) return 'Linux'
  return 'Browser'
}
