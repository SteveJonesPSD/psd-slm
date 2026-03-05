// =============================================================================
// OAuth2 Mail Connect — Initiation
// Builds Microsoft OAuth2 authorisation URL for delegated Mail.Send access.
//
// AZURE AD REQUIREMENTS:
// The existing App Registration needs additional DELEGATED permissions:
//   - Mail.Send (Delegated) — send mail as the signed-in user
//   - offline_access (Delegated) — required for refresh tokens
//   - User.Read (Delegated) — required to read /me for email/display name
//
// The App Registration's Redirect URI must include:
//   {NEXT_PUBLIC_SITE_URL}/api/auth/mail-callback
//
// Admin consent may be required for Mail.Send delegated permission.
// =============================================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    // Get target user ID from query param (admin connecting on behalf of another user)
    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get('user_id') || user.id

    // Only admin can connect other users
    if (targetUserId !== user.id) {
      if (!['super_admin', 'admin'].includes(user.role.name)) {
        return NextResponse.json({ error: 'Admin access required to connect other users' }, { status: 403 })
      }
    }

    // Get the existing mail connection for Azure AD credentials
    const { data: connection } = await supabase
      .from('mail_connections')
      .select('tenant_id, client_id')
      .eq('org_id', user.orgId)
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!connection) {
      return NextResponse.json(
        { error: 'No mail connection configured. Set up Microsoft 365 credentials in Settings → Email first.' },
        { status: 400 }
      )
    }

    // Generate CSRF state token
    const csrfToken = crypto.randomUUID()
    const stateValue = `${targetUserId}:${user.orgId}:${csrfToken}`

    // Store state for validation in callback
    const adminSupabase = createAdminClient()
    await adminSupabase.from('org_settings').upsert({
      org_id: user.orgId,
      category: 'oauth_state',
      setting_key: `mail_connect_${csrfToken}`,
      setting_value: JSON.stringify({
        userId: targetUserId,
        orgId: user.orgId,
        grantedBy: user.id,
        createdAt: new Date().toISOString(),
      }),
    }, {
      onConflict: 'org_id,category,setting_key',
    })

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
    const redirectUri = `${baseUrl}/api/auth/mail-callback`

    const authorizeUrl = new URL(`https://login.microsoftonline.com/${connection.tenant_id}/oauth2/v2.0/authorize`)
    authorizeUrl.searchParams.set('client_id', connection.client_id)
    authorizeUrl.searchParams.set('response_type', 'code')
    authorizeUrl.searchParams.set('redirect_uri', redirectUri)
    authorizeUrl.searchParams.set('scope', 'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access')
    authorizeUrl.searchParams.set('state', stateValue)
    authorizeUrl.searchParams.set('prompt', 'select_account')
    authorizeUrl.searchParams.set('response_mode', 'query')

    return NextResponse.json({ authorizeUrl: authorizeUrl.toString() })
  } catch (err) {
    console.error('[mail-connect]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to initiate mail connection' },
      { status: 500 }
    )
  }
}
