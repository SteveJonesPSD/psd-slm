import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { decrypt } from '@/lib/crypto'

export interface PortalContact {
  id: string
  first_name: string
  last_name: string
  email: string
  customer_id: string
  is_overseer: boolean
  portal_auth_id: string
  customer: {
    id: string
    name: string
    org_id: string
  }
}

/**
 * Get the authenticated portal contact from the Supabase session.
 * Returns null if no portal session exists.
 */
export async function getPortalContact(): Promise<PortalContact | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: contact } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email, customer_id, is_overseer, portal_auth_id, customers(id, name, org_id)')
    .eq('portal_auth_id', user.id)
    .single()

  if (!contact) return null

  return {
    id: contact.id,
    first_name: contact.first_name,
    last_name: contact.last_name,
    email: typeof contact.email === 'string' && contact.email ? decrypt(contact.email) : contact.email,
    customer_id: contact.customer_id,
    is_overseer: contact.is_overseer || false,
    portal_auth_id: contact.portal_auth_id,
    customer: contact.customers as unknown as PortalContact['customer'],
  }
}

/**
 * Require portal authentication. Redirects to /portal if not authenticated.
 */
export async function requirePortalAuth(): Promise<PortalContact> {
  const contact = await getPortalContact()
  if (!contact) {
    redirect('/portal')
  }
  return contact
}
