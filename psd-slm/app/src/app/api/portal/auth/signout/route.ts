import { NextRequest, NextResponse } from 'next/server'
import { clearPortalSession } from '@/lib/portal/session'

export async function POST(request: NextRequest) {
  const token = request.cookies.get('portal_sid')?.value

  if (token) {
    await clearPortalSession(token)
  }

  const baseUrl = request.nextUrl.origin
  const response = NextResponse.redirect(`${baseUrl}/portal/login`)
  response.cookies.set('portal_sid', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/portal',
    maxAge: 0,
  })

  return response
}
