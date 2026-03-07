import { getUser } from '@/lib/auth'
import { generatePasskeyRegistrationOptions, derivePasskeyDeviceName } from '@/lib/passkeys'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

export async function POST() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const headersList = await headers()
  const userAgent = headersList.get('user-agent') ?? undefined
  const suggestedName = derivePasskeyDeviceName(userAgent)

  try {
    const { options, challengeId } = await generatePasskeyRegistrationOptions(
      user.authId,
      user.email,
      `${user.firstName} ${user.lastName}`
    )

    return NextResponse.json({ options, challengeId, suggestedName })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}
