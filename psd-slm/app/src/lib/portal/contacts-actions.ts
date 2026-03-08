'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { decryptContactRow } from '@/lib/crypto-helpers'
import type { PortalContext, PortalContactItem } from './types'

function requirePortalAdmin(ctx: PortalContext): void {
  if (!ctx.isPortalAdmin) throw new Error('PORTAL_ADMIN_REQUIRED')
}

export async function getPortalContacts(ctx: PortalContext): Promise<PortalContactItem[]> {
  const supabase = createAdminClient()

  // Get all contacts for this customer
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email, phone, job_title')
    .eq('customer_id', ctx.customerId)
    .eq('is_active', true)
    .order('first_name')

  // Get portal users for this customer
  const { data: portalUsers } = await supabase
    .from('portal_users')
    .select('id, contact_id, is_portal_admin, is_active, last_login_at, invited_at')
    .eq('customer_id', ctx.customerId)
    .eq('org_id', ctx.orgId)

  const portalMap = new Map(
    (portalUsers || []).map((pu) => [pu.contact_id, pu])
  )

  return (contacts || []).map((rawC) => {
    const c = decryptContactRow(rawC)
    const pu = portalMap.get(c.id)
    let portalStatus: 'active' | 'invited' | 'none' = 'none'
    if (pu?.is_active) {
      portalStatus = pu.last_login_at ? 'active' : 'invited'
    }

    return {
      id: c.id,
      firstName: c.first_name,
      lastName: c.last_name,
      email: c.email,
      phone: c.phone,
      jobTitle: c.job_title,
      portalStatus,
      portalUserId: pu?.id || null,
      isPortalAdmin: pu?.is_portal_admin || false,
      lastLoginAt: pu?.last_login_at || null,
    }
  })
}

export async function inviteContactToPortal(
  contactId: string,
  isAdmin: boolean,
  ctx: PortalContext
): Promise<{ error: string | null; token?: string }> {
  requirePortalAdmin(ctx)
  const supabase = createAdminClient()

  // Verify the contact belongs to this customer
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email, customer_id')
    .eq('id', contactId)
    .eq('customer_id', ctx.customerId)
    .single()

  if (!contact) return { error: 'Contact not found' }
  if (!contact.email) return { error: 'Contact has no email address' }

  // Upsert portal_users
  const { data: existing } = await supabase
    .from('portal_users')
    .select('id')
    .eq('contact_id', contactId)
    .eq('org_id', ctx.orgId)
    .maybeSingle()

  let portalUserId: string
  if (existing) {
    await supabase
      .from('portal_users')
      .update({ is_active: true, is_portal_admin: isAdmin, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    portalUserId = existing.id
  } else {
    const { data: newPu } = await supabase
      .from('portal_users')
      .insert({
        org_id: ctx.orgId,
        contact_id: contactId,
        customer_id: ctx.customerId,
        is_portal_admin: isAdmin,
        invited_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (!newPu) return { error: 'Failed to create portal user' }
    portalUserId = newPu.id
  }

  // Invalidate any existing unused magic links
  await supabase
    .from('portal_magic_links')
    .update({ used_at: new Date().toISOString() })
    .eq('portal_user_id', portalUserId)
    .is('used_at', null)

  // Generate magic link token
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
  await supabase.from('portal_magic_links').insert({
    portal_user_id: portalUserId,
    token,
  })

  // Log activity
  supabase
    .from('activity_log')
    .insert({
      org_id: ctx.orgId,
      entity_type: 'portal_user',
      entity_id: portalUserId,
      action: 'invited',
      actor_type: 'portal_user',
      portal_user_id: ctx.portalUserId,
      details: { contact_id: contactId, is_admin: isAdmin },
    })
    .then(() => {})

  return { error: null, token }
}

export async function revokePortalAccess(
  portalUserId: string,
  ctx: PortalContext
): Promise<{ error: string | null }> {
  requirePortalAdmin(ctx)
  const supabase = createAdminClient()

  // Verify the portal user belongs to this customer
  const { data: pu } = await supabase
    .from('portal_users')
    .select('id, customer_id')
    .eq('id', portalUserId)
    .eq('customer_id', ctx.customerId)
    .single()

  if (!pu) return { error: 'Portal user not found' }

  await supabase
    .from('portal_users')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', portalUserId)

  // Invalidate all sessions
  await supabase
    .from('portal_sessions')
    .delete()
    .eq('portal_user_id', portalUserId)

  supabase
    .from('activity_log')
    .insert({
      org_id: ctx.orgId,
      entity_type: 'portal_user',
      entity_id: portalUserId,
      action: 'revoked',
      actor_type: 'portal_user',
      portal_user_id: ctx.portalUserId,
    })
    .then(() => {})

  return { error: null }
}

export async function addPortalContact(
  data: { firstName: string; lastName: string; email: string; phone?: string; jobTitle?: string },
  ctx: PortalContext
): Promise<{ error: string | null }> {
  requirePortalAdmin(ctx)
  const supabase = createAdminClient()

  const { error } = await supabase.from('contacts').insert({
    org_id: ctx.orgId,
    customer_id: ctx.customerId,
    first_name: data.firstName,
    last_name: data.lastName,
    email: data.email,
    phone: data.phone || null,
    job_title: data.jobTitle || null,
    is_active: true,
  })

  if (error) return { error: error.message }

  supabase
    .from('activity_log')
    .insert({
      org_id: ctx.orgId,
      entity_type: 'contact',
      entity_id: ctx.customerId,
      action: 'created_via_portal',
      actor_type: 'portal_user',
      portal_user_id: ctx.portalUserId,
      details: { name: `${data.firstName} ${data.lastName}` },
    })
    .then(() => {})

  return { error: null }
}

export async function setPortalAdmin(
  portalUserId: string,
  isAdmin: boolean,
  ctx: PortalContext
): Promise<{ error: string | null }> {
  requirePortalAdmin(ctx)
  const supabase = createAdminClient()

  // Can't demote self if last admin
  if (!isAdmin && portalUserId === ctx.portalUserId) {
    const { data: admins } = await supabase
      .from('portal_users')
      .select('id')
      .eq('customer_id', ctx.customerId)
      .eq('is_portal_admin', true)
      .eq('is_active', true)

    if ((admins || []).length <= 1) {
      return { error: 'Cannot remove the last portal admin' }
    }
  }

  await supabase
    .from('portal_users')
    .update({ is_portal_admin: isAdmin, updated_at: new Date().toISOString() })
    .eq('id', portalUserId)
    .eq('customer_id', ctx.customerId)

  return { error: null }
}
