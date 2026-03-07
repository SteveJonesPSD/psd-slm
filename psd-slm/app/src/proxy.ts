import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/auth/login', '/auth/callback', '/auth/change-password', '/auth/mfa-setup', '/q/', '/t/', '/portal', '/collect/', '/api/collect/', '/api/email/poll', '/api/auth/mail-callback', '/api/portal/', '/api/tickets/portal-close', '/api/passkeys/authenticate/', '/sw-push.js', '/api/manifest', '/api/app-icon']

// Portal routes that don't require a portal session cookie
const PORTAL_PUBLIC_ROUTES = ['/portal/login', '/portal/auth/']

export async function proxy(request: NextRequest) {
  // Pass pathname to server components via request header
  request.headers.set('x-pathname', request.nextUrl.pathname)
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — IMPORTANT: must call getUser(), not getSession()
  // getUser() validates the JWT server-side, getSession() only decodes
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r))

  // Portal session check — lightweight cookie presence only
  // Full validation happens in requirePortalSession() per-request
  if (pathname.startsWith('/portal') && !PORTAL_PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    const portalSid = request.cookies.get('portal_sid')?.value
    if (!portalSid) {
      const url = request.nextUrl.clone()
      url.pathname = '/portal/login'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // Unauthenticated user on protected route → redirect to login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // For authenticated users: check MFA and password-change requirements.
  // This runs for ALL routes (including public ones like /auth/login) to
  // prevent redirect loops between login ↔ dashboard.
  if (user) {
    const { data: appUser } = await supabase
      .from('users')
      .select('must_change_password, roles!inner(name), org_id')
      .eq('auth_id', user.id)
      .single()

    // Determine if MFA verification is pending for this user
    let mfaPending = false

    if (appUser) {
      // Forced password change
      if (appUser.must_change_password && pathname !== '/auth/change-password') {
        const url = request.nextUrl.clone()
        url.pathname = '/auth/change-password'
        return NextResponse.redirect(url)
      }

      // MFA enforcement for password_mfa roles
      const roleName = (appUser.roles as unknown as { name: string }).name
      const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )

      const { data: loginSetting } = await adminSupabase
        .from('org_settings')
        .select('setting_value')
        .eq('org_id', appUser.org_id)
        .eq('category', 'login_methods')
        .eq('setting_key', roleName)
        .single()

      const loginMethod = loginSetting?.setting_value ?? 'password'

      // Passkey enrolment note for password_passkey roles:
      // We do NOT hard-redirect to /profile/security if no passkey is enrolled,
      // because the device may not support WebAuthn (e.g. older Windows laptops).
      // The login page handles fallbacks (password-only, TOTP, magic link) gracefully.

      if (loginMethod === 'password_mfa') {
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

        if (aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2') {
          // MFA enrolled but not yet verified this session.
          // Check if this is a trusted device — if so, skip TOTP requirement.
          const deviceToken = request.cookies.get('engage_trusted_device')?.value
          let deviceTrusted = false
          if (deviceToken) {
            const { data: device } = await adminSupabase
              .from('trusted_devices')
              .select('id, expires_at')
              .eq('user_id', user.id)
              .eq('device_token', deviceToken)
              .single()
            if (device && new Date(device.expires_at) > new Date()) {
              deviceTrusted = true
            }
          }

          if (!deviceTrusted) {
            mfaPending = true
            if (pathname !== '/auth/login') {
              const url = request.nextUrl.clone()
              url.pathname = '/auth/login'
              return NextResponse.redirect(url)
            }
            // On /auth/login — allow through so TOTP step can complete
            return supabaseResponse
          }
          // Device is trusted — treat as if MFA was verified, let through
        }

        if (aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal1') {
          // MFA not enrolled yet — force setup
          const { data: factors } = await supabase.auth.mfa.listFactors()
          const hasVerifiedTotp = factors?.totp?.some(f => f.status === 'verified')
          if (!hasVerifiedTotp) {
            mfaPending = true
            if (pathname !== '/auth/mfa-setup') {
              const url = request.nextUrl.clone()
              url.pathname = '/auth/mfa-setup'
              return NextResponse.redirect(url)
            }
            return supabaseResponse
          }
        }
      }
    }

    // Authenticated user on login page with no MFA pending → redirect to dashboard
    // Skip for server actions (POST with Next-Action header) — they must complete, not redirect
    const isServerAction = request.method === 'POST' && request.headers.has('next-action')
    if (pathname === '/auth/login' && !mfaPending && !isServerAction) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Match all routes except static files, _next internals, and favicon
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
