import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/portal/impersonate
 * Creates a portal session for a staff member to preview the portal as a customer contact.
 * Requires admin role.
 * Body: { customerId: string, contactId: string }
 */
export async function POST(request: NextRequest) {
  let user
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!['super_admin', 'admin'].includes(user.role.name)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const { customerId, contactId } = await request.json()

  if (!customerId || !contactId) {
    return NextResponse.json({ error: 'customerId and contactId required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Verify customer exists in same org
  const { data: customer } = await supabase
    .from('customers')
    .select('id, org_id')
    .eq('id', customerId)
    .eq('org_id', user.orgId)
    .single()

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  // Verify contact belongs to customer
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, customer_id')
    .eq('id', contactId)
    .eq('customer_id', customerId)
    .single()

  if (!contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  // Find or create portal user for this contact
  let portalUserId: string

  const { data: existingPu } = await supabase
    .from('portal_users')
    .select('id, is_active')
    .eq('contact_id', contactId)
    .eq('org_id', user.orgId)
    .maybeSingle()

  if (existingPu) {
    portalUserId = existingPu.id
    // Temporarily activate if inactive (for impersonation only)
    if (!existingPu.is_active) {
      await supabase
        .from('portal_users')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', existingPu.id)
    }
  } else {
    // Create a portal user for impersonation
    const { data: newPu, error } = await supabase
      .from('portal_users')
      .insert({
        org_id: user.orgId,
        contact_id: contactId,
        customer_id: customerId,
        is_portal_admin: false,
        is_active: true,
        invited_by: user.id,
        invited_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error || !newPu) {
      return NextResponse.json({ error: 'Failed to create portal user' }, { status: 500 })
    }
    portalUserId = newPu.id
  }

  // Create an impersonation session (1 hour TTL)
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

  await supabase.from('portal_sessions').insert({
    portal_user_id: portalUserId,
    customer_id: customerId,
    org_id: user.orgId,
    session_token: token,
    expires_at: expiresAt,
    is_impersonation: true,
    impersonated_by: user.id,
    ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    user_agent: request.headers.get('user-agent') || null,
  })

  return NextResponse.json({ token })
}
