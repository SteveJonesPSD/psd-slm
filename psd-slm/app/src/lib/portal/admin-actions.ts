'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth'
import { decrypt } from '@/lib/crypto'

/**
 * Internal-facing portal management actions.
 * Called from the internal dashboard by staff users.
 * Uses internal auth (requirePermission), not portal session.
 */

export interface InternalPortalUser {
  id: string
  contactId: string
  contactName: string
  contactEmail: string | null
  isPortalAdmin: boolean
  isGroupAdmin: boolean
  isActive: boolean
  lastLoginAt: string | null
  invitedAt: string | null
}

export async function getPortalUsersForCustomer(customerId: string): Promise<InternalPortalUser[]> {
  await requirePermission('customers', 'view')
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('portal_users')
    .select(`
      id, contact_id, is_portal_admin, is_group_admin, is_active, last_login_at, invited_at,
      contacts(first_name, last_name, email)
    `)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  return (data || []).map((pu) => {
    const contact = pu.contacts as unknown as { first_name: string; last_name: string; email: string | null }
    return {
      id: pu.id,
      contactId: pu.contact_id,
      contactName: `${contact.first_name} ${contact.last_name}`,
      contactEmail: typeof contact.email === 'string' && contact.email ? decrypt(contact.email) : contact.email,
      isPortalAdmin: pu.is_portal_admin,
      isGroupAdmin: (pu as Record<string, unknown>).is_group_admin as boolean ?? false,
      isActive: pu.is_active,
      lastLoginAt: pu.last_login_at,
      invitedAt: pu.invited_at,
    }
  })
}

export async function grantPortalAccess(
  contactId: string,
  customerId: string,
  isAdmin: boolean
): Promise<{ error: string | null; token?: string }> {
  const user = await requirePermission('customers', 'edit_all')
  const supabase = createAdminClient()

  // Verify contact belongs to customer
  const { data: contact, error: contactErr } = await supabase
    .from('contacts')
    .select('id, email, customer_id')
    .eq('id', contactId)
    .eq('customer_id', customerId)
    .single()

  if (contactErr) {
    console.error('[portal-admin] Contact lookup error:', contactErr.message)
    return { error: `Contact lookup failed: ${contactErr.message}` }
  }
  if (!contact) return { error: 'Contact not found' }
  if (!contact.email) return { error: 'Contact has no email address' }

  // Upsert portal_users
  const { data: existing } = await supabase
    .from('portal_users')
    .select('id')
    .eq('contact_id', contactId)
    .eq('org_id', user.orgId)
    .maybeSingle()

  let portalUserId: string

  if (existing) {
    await supabase
      .from('portal_users')
      .update({
        is_active: true,
        is_portal_admin: isAdmin,
        invited_by: user.id,
        invited_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    portalUserId = existing.id
  } else {
    const { data: newPu, error: insertErr } = await supabase
      .from('portal_users')
      .insert({
        org_id: user.orgId,
        contact_id: contactId,
        customer_id: customerId,
        is_portal_admin: isAdmin,
        invited_by: user.id,
        invited_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (insertErr) {
      console.error('[portal-admin] Insert portal_user error:', insertErr.message)
      return { error: `Failed to create portal user: ${insertErr.message}` }
    }
    if (!newPu) return { error: 'Failed to create portal user' }
    portalUserId = newPu.id
  }

  // Invalidate existing unused magic links
  await supabase
    .from('portal_magic_links')
    .update({ used_at: new Date().toISOString() })
    .eq('portal_user_id', portalUserId)
    .is('used_at', null)

  // Generate token
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
  await supabase.from('portal_magic_links').insert({
    portal_user_id: portalUserId,
    token,
  })

  return { error: null, token }
}

export async function revokePortalAccessInternal(
  portalUserId: string,
  customerId: string
): Promise<{ error: string | null }> {
  await requirePermission('customers', 'edit_all')
  const supabase = createAdminClient()

  await supabase
    .from('portal_users')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', portalUserId)
    .eq('customer_id', customerId)

  // Invalidate sessions
  await supabase
    .from('portal_sessions')
    .delete()
    .eq('portal_user_id', portalUserId)

  return { error: null }
}

export async function resendPortalInvite(
  portalUserId: string,
  customerId: string
): Promise<{ error: string | null; token?: string }> {
  await requirePermission('customers', 'edit_all')
  const supabase = createAdminClient()

  const { data: pu } = await supabase
    .from('portal_users')
    .select('id, customer_id, is_active')
    .eq('id', portalUserId)
    .eq('customer_id', customerId)
    .single()

  if (!pu || !pu.is_active) return { error: 'Portal user not found or inactive' }

  // Invalidate existing
  await supabase
    .from('portal_magic_links')
    .update({ used_at: new Date().toISOString() })
    .eq('portal_user_id', portalUserId)
    .is('used_at', null)

  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
  await supabase.from('portal_magic_links').insert({
    portal_user_id: portalUserId,
    token,
  })

  return { error: null, token }
}

export async function toggleGroupAdmin(
  portalUserId: string,
  customerId: string,
  isGroupAdmin: boolean
): Promise<{ error: string | null }> {
  await requirePermission('companies', 'manage_groups')
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('portal_users')
    .update({ is_group_admin: isGroupAdmin, updated_at: new Date().toISOString() })
    .eq('id', portalUserId)
    .eq('customer_id', customerId)

  if (error) return { error: error.message }
  return { error: null }
}
