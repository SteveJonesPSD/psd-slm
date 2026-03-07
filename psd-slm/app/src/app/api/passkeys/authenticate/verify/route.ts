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
  // We use admin.generateLink() to create a magic link, then return the
  // hashed token so the client can call supabase.auth.verifyOtp() to
  // establish the session with proper cookies.
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
    console.error('[passkey-auth] generateLink failed:', linkError?.message)
    return NextResponse.json({ error: 'Session creation failed' }, { status: 500 })
  }

  // Return the OTP token so the client can call verifyOtp with email + token.
  // Using email_otp avoids token_hash format mismatches between generateLink
  // and the GoTrue /verify endpoint.
  const emailOtp = linkData.properties.email_otp
  const tokenHash = linkData.properties.hashed_token

  if (!emailOtp && !tokenHash) {
    console.error('[passkey-auth] no token data in generateLink response')
    return NextResponse.json({ error: 'Session creation failed' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    ...(emailOtp
      ? { emailOtp, verifyMethod: 'otp' }
      : { tokenHash, verifyMethod: 'token_hash' }),
    email: authUser.email,
  })
}
