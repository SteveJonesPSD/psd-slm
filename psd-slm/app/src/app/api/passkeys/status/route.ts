import { getUser } from '@/lib/auth'
import { getPasskeyCount } from '@/lib/passkeys'
import { NextResponse } from 'next/server'

export async function GET() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const count = await getPasskeyCount(user.authId)
  return NextResponse.json({ count })
}
