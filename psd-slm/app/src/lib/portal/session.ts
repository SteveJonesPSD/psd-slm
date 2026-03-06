'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import type { PortalContext } from './types'

const COOKIE_NAME = 'portal_sid'
const SESSION_DURATION_DAYS = 7
const SESSION_DURATION_MS = SESSION_DURATION_DAYS * 86400000

/**
 * Require a valid portal session. Throws if no session or session expired.
 * Used in server components and server actions.
 */
export async function requirePortalSession(): Promise<PortalContext> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) throw new Error('NO_SESSION')

  const supabase = createAdminClient()
  const { data: session, error } = await supabase
    .from('portal_sessions')
    .select(`
      id, portal_user_id, customer_id, org_id, expires_at, is_impersonation,
      portal_users!inner(
        id, contact_id, is_portal_admin, is_active,
        contacts!inner(first_name, last_name),
        customers!inner(name)
      )
    `)
    .eq('session_token', token)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (error || !session) throw new Error('INVALID_SESSION')

  const pu = session.portal_users as unknown as {
    id: string
    contact_id: string
    is_portal_admin: boolean
    is_active: boolean
    contacts: { first_name: string; last_name: string }
    customers: { name: string }
  }

  if (!pu.is_active) throw new Error('INACTIVE_USER')

  // Slide the session window (fire-and-forget)
  supabase
    .from('portal_sessions')
    .update({
      expires_at: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
      last_active_at: new Date().toISOString(),
    })
    .eq('id', session.id)
    .then(() => {})

  return {
    portalUserId: session.portal_user_id,
    customerId: session.customer_id,
    orgId: session.org_id,
    contactId: pu.contact_id,
    isPortalAdmin: pu.is_portal_admin,
    displayName: `${pu.contacts.first_name} ${pu.contacts.last_name}`,
    customerName: pu.customers.name,
    isImpersonation: !!session.is_impersonation,
  }
}

/**
 * Get portal context from a Request object (for API routes).
 * Returns null if no valid session.
 */
export async function getPortalContextFromRequest(request: Request): Promise<PortalContext | null> {
  const cookieHeader = request.headers.get('cookie') || ''
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))
  if (!match) return null

  const token = match[1]
  const supabase = createAdminClient()
  const { data: session } = await supabase
    .from('portal_sessions')
    .select(`
      id, portal_user_id, customer_id, org_id, expires_at, is_impersonation,
      portal_users!inner(
        id, contact_id, is_portal_admin, is_active,
        contacts!inner(first_name, last_name),
        customers!inner(name)
      )
    `)
    .eq('session_token', token)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!session) return null

  const pu = session.portal_users as unknown as {
    id: string
    contact_id: string
    is_portal_admin: boolean
    is_active: boolean
    contacts: { first_name: string; last_name: string }
    customers: { name: string }
  }

  if (!pu.is_active) return null

  // Slide session (fire-and-forget)
  supabase
    .from('portal_sessions')
    .update({
      expires_at: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
      last_active_at: new Date().toISOString(),
    })
    .eq('id', session.id)
    .then(() => {})

  return {
    portalUserId: session.portal_user_id,
    customerId: session.customer_id,
    orgId: session.org_id,
    contactId: pu.contact_id,
    isPortalAdmin: pu.is_portal_admin,
    displayName: `${pu.contacts.first_name} ${pu.contacts.last_name}`,
    customerName: pu.customers.name,
    isImpersonation: !!session.is_impersonation,
  }
}

/**
 * Create a new portal session and return the session token.
 */
export async function createPortalSession(
  portalUserId: string,
  customerId: string,
  orgId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  const supabase = createAdminClient()
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')

  await supabase.from('portal_sessions').insert({
    portal_user_id: portalUserId,
    customer_id: customerId,
    org_id: orgId,
    session_token: token,
    expires_at: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
  })

  return token
}

/**
 * Delete a portal session by token.
 */
export async function clearPortalSession(token: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase.from('portal_sessions').delete().eq('session_token', token)
}
