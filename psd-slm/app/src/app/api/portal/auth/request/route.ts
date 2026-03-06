import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    if (!email || typeof email !== 'string') {
      // Always return success — no enumeration
      return NextResponse.json({ success: true })
    }

    const supabase = createAdminClient()
    const normalised = email.trim().toLowerCase()

    // Resolve org_id — single-tenant: fetch the one org
    const { data: org } = await supabase
      .from('organisations')
      .select('id, name')
      .limit(1)
      .single()

    if (!org) {
      console.error('[portal-auth] No organisation found in database')
      return NextResponse.json({ success: true })
    }
    const orgId = org.id

    // Find contact by email (case-insensitive, scoped to org via customer)
    const { data: contacts, error: contactsErr } = await supabase
      .from('contacts')
      .select('id, first_name, customer_id, customers!inner(org_id)')
      .eq('customers.org_id', orgId)
      .ilike('email', normalised)
      .eq('is_active', true)

    if (contactsErr) {
      console.error('[portal-auth] Contacts query error:', contactsErr.message)
    }

    if (!contacts || contacts.length === 0) {
      console.log('[portal-auth] No active contact found for', normalised)
      return NextResponse.json({ success: true })
    }

    // Find portal_user for this contact
    let portalUser = null
    for (const contact of contacts) {
      const { data: pu } = await supabase
        .from('portal_users')
        .select('id, is_active, customer_id')
        .eq('contact_id', contact.id)
        .eq('org_id', orgId)
        .eq('is_active', true)
        .maybeSingle()

      if (pu) {
        portalUser = pu
        break
      }
    }

    if (!portalUser) {
      console.log('[portal-auth] No active portal_user found for contact(s)')
      return NextResponse.json({ success: true })
    }

    // Invalidate any existing unused tokens
    await supabase
      .from('portal_magic_links')
      .update({ used_at: new Date().toISOString() })
      .eq('portal_user_id', portalUser.id)
      .is('used_at', null)

    // Generate magic link token
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
    await supabase.from('portal_magic_links').insert({
      portal_user_id: portalUser.id,
      token,
    })

    const orgName = org.name || 'Innov8iv Engage'

    // Build magic link URL
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || 'https://engage.psdgroup.co.uk'
    const magicLink = `${baseUrl}/portal/auth/${token}`

    // Fetch portal logo for email branding
    const { data: logoSetting } = await supabase
      .from('org_settings')
      .select('setting_value')
      .eq('org_id', orgId)
      .eq('setting_key', 'portal_logo_url')
      .eq('category', 'general')
      .maybeSingle()
    // Only use logo URL if it's publicly reachable (not localhost/LAN)
    const isPublicUrl = baseUrl.startsWith('https://')
    const fallbackLogo = isPublicUrl ? `${baseUrl}/innov8iv-logo.png` : null
    const logoUrl = logoSetting?.setting_value || fallbackLogo

    // Send email via Graph API (use the first active mail channel for the org)
    try {
      const { data: channel, error: channelErr } = await supabase
        .from('mail_channels')
        .select('mailbox_address, mail_connections(*)')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      if (channelErr) {
        console.error('[portal-auth] Channel query error:', channelErr.message)
      }

      if (channel?.mail_connections) {
        console.log(`[portal-auth] Sending magic link via ${channel.mailbox_address}`)
        const { GraphClient } = await import('@/lib/email/graph-client')
        const client = new GraphClient(channel.mail_connections as never)
        await client.sendMail(channel.mailbox_address, {
          to: [{ address: normalised }],
          subject: `Your ${orgName} Portal Login Link`,
          bodyHtml: buildMagicLinkEmail(orgName, magicLink, logoUrl),
        })
        console.log(`[portal-auth] Magic link email sent to ${normalised}`)
      } else {
        // No active channel — log the link for dev
        console.log(`[portal-auth] No active mail channel found. Magic link for ${normalised}: ${magicLink}`)
      }
    } catch (emailErr) {
      console.error('[portal-auth] Failed to send magic link email:', emailErr)
      // Log the link as fallback
      console.log(`[portal-auth] Fallback magic link for ${normalised}: ${magicLink}`)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[portal-auth] Request error:', err)
    // Always return success — no enumeration
    return NextResponse.json({ success: true })
  }
}

function buildMagicLinkEmail(orgName: string, link: string, logoUrl: string | null): string {
  const logoHtml = logoUrl
    ? `<div style="text-align: center; margin-bottom: 32px;">
      <img src="${logoUrl}" alt="${orgName}" style="height: 40px; width: auto; max-width: 200px;" />
    </div>`
    : `<div style="text-align: center; margin-bottom: 32px;">
      <span style="font-size: 18px; font-weight: 700; color: #0f172a;">${orgName}</span>
    </div>`

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.6; margin: 0; padding: 0; background-color: #f8fafc;">
<div style="max-width: 640px; margin: 0 auto; padding: 40px 24px;">
  <div style="background: #ffffff; border-radius: 12px; padding: 40px 32px; border: 1px solid #e2e8f0;">
    ${logoHtml}
    <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 700; color: #0f172a; text-align: center;">Sign in to your portal</h2>
    <p style="margin: 0 0 24px; text-align: center; color: #64748b; font-size: 14px;">Click the button below to sign in. This link expires in 15 minutes.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${link}" style="display: inline-block; background: #4f46e5; color: #ffffff !important; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">Sign In to Portal</a>
    </div>
    <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 24px 0 0;">If the button doesn&rsquo;t work, copy and paste this link into your browser:</p>
    <p style="font-size: 11px; color: #cbd5e1; word-break: break-all; text-align: center; margin: 4px 0 0;">${link}</p>
  </div>
  <div style="text-align: center; padding-top: 24px;">
    <p style="font-size: 12px; color: #94a3b8; margin: 0;">${orgName} Customer Portal</p>
    <p style="font-size: 11px; color: #cbd5e1; margin: 4px 0 0;">If you didn&rsquo;t request this link, you can safely ignore this email.</p>
  </div>
</div>
</body>
</html>`
}
