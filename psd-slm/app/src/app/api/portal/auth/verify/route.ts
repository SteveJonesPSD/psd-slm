import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPortalSession } from '@/lib/portal/session'
import { logAuthEvent } from '@/lib/auth-log'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const baseUrl = request.nextUrl.origin

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/portal/login?error=invalid`)
  }

  const supabase = createAdminClient()

  // Look up the magic link
  const { data: magicLink } = await supabase
    .from('portal_magic_links')
    .select('id, portal_user_id, expires_at, used_at')
    .eq('token', token)
    .single()

  if (!magicLink) {
    return NextResponse.redirect(`${baseUrl}/portal/login?error=invalid`)
  }

  if (magicLink.used_at) {
    return NextResponse.redirect(`${baseUrl}/portal/login?error=used`)
  }

  if (new Date(magicLink.expires_at) < new Date()) {
    return NextResponse.redirect(`${baseUrl}/portal/login?error=expired`)
  }

  // Mark as used atomically
  const { error: updateError } = await supabase
    .from('portal_magic_links')
    .update({ used_at: new Date().toISOString() })
    .eq('id', magicLink.id)
    .is('used_at', null)

  if (updateError) {
    // Race condition — someone used it just before us
    return NextResponse.redirect(`${baseUrl}/portal/login?error=used`)
  }

  // Fetch portal user details
  const { data: portalUser } = await supabase
    .from('portal_users')
    .select('id, customer_id, org_id, is_active')
    .eq('id', magicLink.portal_user_id)
    .single()

  if (!portalUser || !portalUser.is_active) {
    logAuthEvent({ orgId: portalUser?.org_id, portalUserId: magicLink.portal_user_id, eventType: 'portal_login_failure', authMethod: 'magic_link', success: false, failureReason: 'inactive_user', request })
    return NextResponse.redirect(`${baseUrl}/portal/login?error=inactive`)
  }

  // Create session
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined
  const ua = request.headers.get('user-agent') || undefined
  const sessionToken = await createPortalSession(
    portalUser.id,
    portalUser.customer_id,
    portalUser.org_id,
    ip,
    ua
  )

  // Update last login
  await supabase
    .from('portal_users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', portalUser.id)

  logAuthEvent({ orgId: portalUser.org_id, portalUserId: portalUser.id, eventType: 'portal_login_success', authMethod: 'magic_link', request })

  // Set cookie and redirect
  const response = NextResponse.redirect(`${baseUrl}/portal/dashboard`)
  response.cookies.set('portal_sid', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/portal',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  })

  return response
}
