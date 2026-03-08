'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { decryptContactRow } from '@/lib/crypto-helpers'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'

export interface ContactCustomerLink {
  id: string
  contact_id: string
  customer_id: string
  is_primary: boolean
  role: string | null
  notes: string | null
  created_at: string
  customer_name?: string
  contact_name?: string
}

/**
 * Get all customer links for a contact.
 */
export async function getContactCustomerLinks(contactId: string): Promise<ContactCustomerLink[]> {
  await requirePermission('customers', 'view')
  const supabase = await createClient()

  const { data } = await supabase
    .from('contact_customer_links')
    .select('*, customers!inner(name)')
    .eq('contact_id', contactId)
    .order('is_primary', { ascending: false })

  return (data || []).map(row => ({
    ...row,
    customer_name: (row.customers as unknown as { name: string })?.name || '',
  })) as ContactCustomerLink[]
}

/**
 * Get linked contacts for a customer (contacts whose primary company is elsewhere).
 */
export async function getLinkedContacts(customerId: string): Promise<{
  id: string
  first_name: string
  last_name: string
  email: string | null
  job_title: string | null
  primary_customer_name: string
  role: string | null
  link_id: string
}[]> {
  await requirePermission('customers', 'view')
  const supabase = await createClient()

  const { data } = await supabase
    .from('contact_customer_links')
    .select('id, role, contacts!inner(id, first_name, last_name, email, job_title, customer_id, customers!inner(name))')
    .eq('customer_id', customerId)

  if (!data) return []

  return data
    .filter(row => {
      const contact = row.contacts as unknown as { customer_id: string }
      return contact.customer_id !== customerId // only contacts whose primary is elsewhere
    })
    .map(row => {
      const contact = row.contacts as unknown as {
        id: string; first_name: string; last_name: string; email: string | null; job_title: string | null
        customers: { name: string }
      }
      return {
        id: contact.id,
        first_name: contact.first_name,
        last_name: contact.last_name,
        email: contact.email,
        job_title: contact.job_title,
        primary_customer_name: contact.customers?.name || '',
        role: row.role,
        link_id: row.id,
      }
    })
}

/**
 * Link an existing contact to a customer.
 */
export async function addContactCustomerLink(
  contactId: string,
  customerId: string,
  role?: string
): Promise<{ error?: string }> {
  const user = await requirePermission('customers', 'edit_all')
  const supabase = await createClient()

  const { error } = await supabase
    .from('contact_customer_links')
    .insert({
      contact_id: contactId,
      customer_id: customerId,
      org_id: user.orgId,
      is_primary: false,
      role: role || null,
    })

  if (error) {
    if (error.code === '23505') {
      return { error: 'This contact is already linked to this customer' }
    }
    return { error: error.message }
  }

  logActivity({
    supabase,
    user,
    entityType: 'contact',
    entityId: contactId,
    action: 'linked_to_customer',
    details: { customer_id: customerId, role },
  })

  revalidatePath(`/customers/${customerId}`)
  return {}
}

/**
 * Remove a secondary link (cannot remove primary company link).
 */
export async function removeContactCustomerLink(
  linkId: string,
  customerId: string
): Promise<{ error?: string }> {
  const user = await requirePermission('customers', 'edit_all')
  const supabase = await createClient()

  // Fetch link to verify it's not the primary
  const { data: link } = await supabase
    .from('contact_customer_links')
    .select('id, contact_id, customer_id, is_primary')
    .eq('id', linkId)
    .single()

  if (!link) return { error: 'Link not found' }

  // Check if this customer IS the contact's primary company
  const { data: contact } = await supabase
    .from('contacts')
    .select('customer_id')
    .eq('id', link.contact_id)
    .single()

  if (contact?.customer_id === link.customer_id) {
    return { error: 'Cannot remove the primary company link. Change the contact\'s primary company first.' }
  }

  const { error } = await supabase
    .from('contact_customer_links')
    .delete()
    .eq('id', linkId)

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'contact',
    entityId: link.contact_id,
    action: 'unlinked_from_customer',
    details: { customer_id: link.customer_id },
  })

  revalidatePath(`/customers/${customerId}`)
  return {}
}

/**
 * Search contacts across the org (for the "Link existing contact" picker).
 */
export async function searchContactsForLinking(
  query: string,
  excludeCustomerId: string
): Promise<{ id: string; first_name: string; last_name: string; email: string | null; customer_name: string }[]> {
  await requirePermission('customers', 'view')
  const supabase = await createClient()

  // Get contact IDs already linked to this customer (to exclude them)
  const { data: existingLinks } = await supabase
    .from('contact_customer_links')
    .select('contact_id')
    .eq('customer_id', excludeCustomerId)

  const excludeIds = new Set((existingLinks || []).map(l => l.contact_id))

  const { data } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email, customers!inner(name)')
    .eq('is_active', true)
    .neq('customer_id', excludeCustomerId)
    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
    .limit(20)

  return (data || [])
    .filter(row => !excludeIds.has(row.id))
    .slice(0, 15)
    .map(row => {
      const decrypted = decryptContactRow(row)
      return {
        id: decrypted.id,
        first_name: decrypted.first_name,
        last_name: decrypted.last_name,
        email: decrypted.email,
        customer_name: (row.customers as unknown as { name: string })?.name || '',
      }
    })
}
