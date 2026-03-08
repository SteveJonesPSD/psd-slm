import { getUser } from '@/lib/auth'
import { verifyPasskeyRegistration } from '@/lib/passkeys'
import { logAuthEvent } from '@/lib/auth-log'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { challengeId, response, deviceName } = await request.json()

  console.log('[passkey-register]', { authId: user.authId, orgId: user.orgId, deviceName })
  const result = await verifyPasskeyRegistration(
    challengeId,
    user.authId,
    user.orgId,
    response,
    deviceName || 'Passkey'
  )

  if (!result.success) {
    logAuthEvent({ orgId: user.orgId, userId: user.authId, eventType: 'passkey_auth_failure', authMethod: 'passkey', success: false, failureReason: 'registration_failed', request })
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  logAuthEvent({ orgId: user.orgId, userId: user.authId, eventType: 'passkey_registered', authMethod: 'passkey', request })
  return NextResponse.json({ success: true })
}
