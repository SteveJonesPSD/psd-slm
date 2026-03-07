import { generatePasskeyAuthenticationOptions } from '@/lib/passkeys'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { email } = await request.json()

  let userId: string | undefined

  if (email) {
    const supabase = createAdminClient()
    const { data: { users } } = await supabase.auth.admin.listUsers()
    const authUser = users?.find(
      u => u.email?.toLowerCase() === email.toLowerCase()
    )

    if (authUser) {
      userId = authUser.id
    }
    // If user not found, don't reveal — just generate discoverable options
  }

  try {
    const { options, challengeId } = await generatePasskeyAuthenticationOptions(userId)
    return NextResponse.json({ options, challengeId })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}
