import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/portal/impersonate/start?token=...
 * Sets the portal_sid cookie from an impersonation session token and redirects to portal.
 * The token must be a valid, non-expired impersonation session.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const baseUrl = request.nextUrl.origin

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/portal/login?error=invalid`)
  }

  // Verify the session token is a valid impersonation session
  const supabase = createAdminClient()
  const { data: session } = await supabase
    .from('portal_sessions')
    .select('id, is_impersonation, expires_at')
    .eq('session_token', token)
    .eq('is_impersonation', true)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!session) {
    return NextResponse.redirect(`${baseUrl}/portal/login?error=invalid`)
  }

  // Set cookie and redirect to portal dashboard
  const response = NextResponse.redirect(`${baseUrl}/portal/dashboard`)
  response.cookies.set('portal_sid', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/portal',
    maxAge: 60 * 60, // 1 hour for impersonation
  })

  return response
}
