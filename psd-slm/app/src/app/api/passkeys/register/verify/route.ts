import { getUser } from '@/lib/auth'
import { verifyPasskeyRegistration } from '@/lib/passkeys'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { challengeId, response, deviceName } = await request.json()

  const result = await verifyPasskeyRegistration(
    challengeId,
    user.authId,
    user.orgId,
    response,
    deviceName || 'Passkey'
  )

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
