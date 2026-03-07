import { verifyPasskeyAuthentication } from '@/lib/passkeys'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { challengeId, response } = await request.json()

  const result = await verifyPasskeyAuthentication(challengeId, response)

  if (!result.success || !result.userId) {
    return NextResponse.json({ error: result.error ?? 'Authentication failed' }, { status: 401 })
  }

  // Create a Supabase session for the verified user.
  // We use admin.generateLink() to create an OTP link, then return the
  // token data so the client can call supabase.auth.verifyOtp() to establish
  // the session with proper cookies.
  const supabase = createAdminClient()

  const { data: { user: authUser } } = await supabase.auth.admin.getUserById(result.userId)
  if (!authUser?.email) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 })
  }

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: authUser.email,
  })

  if (linkError || !linkData) {
    return NextResponse.json({ error: 'Session creation failed' }, { status: 500 })
  }

  // Extract the OTP token hash from the generated link
  const url = new URL(linkData.properties.action_link)
  const tokenHash = url.searchParams.get('token_hash') || url.searchParams.get('token')
  const type = url.searchParams.get('type') || 'magiclink'

  return NextResponse.json({
    success: true,
    tokenHash,
    type,
    email: authUser.email,
  })
}
