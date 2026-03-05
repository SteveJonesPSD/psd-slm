// =============================================================================
// OAuth2 Mail Callback
// Receives the authorization code from Microsoft, exchanges for tokens,
// fetches user profile, and stores credentials.
// =============================================================================

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || ''

  // Handle OAuth errors (user declined consent, etc.)
  if (error) {
    console.error('[mail-callback] OAuth error:', error, errorDescription)
    return NextResponse.redirect(`${baseUrl}/team?mail_error=${encodeURIComponent(errorDescription || error)}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/team?mail_error=${encodeURIComponent('Missing authorization code or state')}`)
  }

  // Parse state: userId:orgId:csrfToken
  const stateParts = state.split(':')
  if (stateParts.length < 3) {
    return NextResponse.redirect(`${baseUrl}/team?mail_error=${encodeURIComponent('Invalid state parameter')}`)
  }

  const [targetUserId, orgId, csrfToken] = stateParts
  const supabase = createAdminClient()

  try {
    // Validate CSRF state
    const { data: stateRecord } = await supabase
      .from('org_settings')
      .select('setting_value')
      .eq('org_id', orgId)
      .eq('category', 'oauth_state')
      .eq('setting_key', `mail_connect_${csrfToken}`)
      .single()

    if (!stateRecord) {
      return NextResponse.redirect(`${baseUrl}/team?mail_error=${encodeURIComponent('Invalid or expired state token')}`)
    }

    const stateData = JSON.parse(stateRecord.setting_value)

    // Clean up state token
    await supabase
      .from('org_settings')
      .delete()
      .eq('org_id', orgId)
      .eq('category', 'oauth_state')
      .eq('setting_key', `mail_connect_${csrfToken}`)

    // Check state token age (expire after 10 minutes)
    const stateAge = Date.now() - new Date(stateData.createdAt).getTime()
    if (stateAge > 10 * 60 * 1000) {
      return NextResponse.redirect(`${baseUrl}/team?mail_error=${encodeURIComponent('Authorization timed out. Please try again.')}`)
    }

    // Get mail connection for client credentials
    const { data: connection } = await supabase
      .from('mail_connections')
      .select('tenant_id, client_id, client_secret')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!connection) {
      return NextResponse.redirect(`${baseUrl}/team?mail_error=${encodeURIComponent('Mail connection not found')}`)
    }

    // Exchange authorization code for tokens
    const redirectUri = `${baseUrl}/api/auth/mail-callback`
    const tokenUrl = `https://login.microsoftonline.com/${connection.tenant_id}/oauth2/v2.0/token`

    const tokenBody = new URLSearchParams({
      client_id: connection.client_id,
      client_secret: connection.client_secret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      scope: 'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access',
    })

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    })

    if (!tokenRes.ok) {
      const errText = await tokenRes.text()
      console.error('[mail-callback] Token exchange failed:', errText)
      return NextResponse.redirect(`${baseUrl}/team?mail_error=${encodeURIComponent('Failed to exchange authorization code')}`)
    }

    const tokenData = await tokenRes.json()
    const { access_token, refresh_token, expires_in } = tokenData

    if (!refresh_token) {
      return NextResponse.redirect(`${baseUrl}/team?mail_error=${encodeURIComponent('No refresh token returned. Ensure offline_access scope is granted.')}`)
    }

    // Get user profile from Graph API
    const meRes = await fetch('https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName', {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    let emailAddress = ''
    let displayName = ''

    if (meRes.ok) {
      const meData = await meRes.json()
      emailAddress = meData.mail || meData.userPrincipalName || ''
      displayName = meData.displayName || ''
    }

    if (!emailAddress) {
      return NextResponse.redirect(`${baseUrl}/team?mail_error=${encodeURIComponent('Could not determine email address from Microsoft account')}`)
    }

    // Upsert credential
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

    const { error: upsertError } = await supabase
      .from('user_mail_credentials')
      .upsert({
        org_id: orgId,
        user_id: targetUserId,
        email_address: emailAddress,
        display_name: displayName,
        access_token,
        refresh_token,
        token_expires_at: tokenExpiresAt,
        granted_at: new Date().toISOString(),
        granted_by: stateData.grantedBy,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'org_id,user_id',
      })

    if (upsertError) {
      console.error('[mail-callback] Upsert failed:', upsertError)
      return NextResponse.redirect(`${baseUrl}/team?mail_error=${encodeURIComponent('Failed to save credentials')}`)
    }

    return NextResponse.redirect(`${baseUrl}/team?mail_connected=true&mail_email=${encodeURIComponent(emailAddress)}`)
  } catch (err) {
    console.error('[mail-callback] Error:', err)
    return NextResponse.redirect(`${baseUrl}/team?mail_error=${encodeURIComponent('An unexpected error occurred')}`)
  }
}
