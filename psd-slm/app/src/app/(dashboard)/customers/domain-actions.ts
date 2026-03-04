'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'
import type { CustomerEmailDomain } from '@/types/database'

// -----------------------------------------------------------------------------
// Get domains for a customer
// -----------------------------------------------------------------------------

export async function getCustomerDomains(customerId: string): Promise<CustomerEmailDomain[]> {
  await requirePermission('customers', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('customer_email_domains')
    .select('*')
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .order('domain')

  if (error) throw new Error(error.message)
  return (data || []) as CustomerEmailDomain[]
}

// -----------------------------------------------------------------------------
// Add a domain to a customer
// -----------------------------------------------------------------------------

function normaliseDomain(input: string): string {
  let domain = input.trim().toLowerCase()
  // Strip leading @
  domain = domain.replace(/^@/, '')
  // Strip protocol
  domain = domain.replace(/^https?:\/\//, '')
  // Strip www.
  domain = domain.replace(/^www\./, '')
  // Strip trailing slash and path
  domain = domain.split('/')[0]
  return domain
}

function validateDomain(domain: string): string | null {
  if (!domain) return 'Domain is required'
  if (domain.includes(' ')) return 'Domain must not contain spaces'
  if (domain.includes('@')) return 'Enter just the domain, not a full email address'
  if (!domain.includes('.')) return 'Domain must contain at least one dot (e.g. example.co.uk)'
  return null
}

export async function addCustomerDomain(
  customerId: string,
  rawDomain: string
): Promise<{ error?: string }> {
  const user = await requirePermission('customers', 'edit_all')
  const supabase = await createClient()

  const domain = normaliseDomain(rawDomain)
  const validationError = validateDomain(domain)
  if (validationError) return { error: validationError }

  // Check for org-wide duplicate (case-insensitive, active only)
  const { data: existing } = await supabase
    .from('customer_email_domains')
    .select('id, customer_id, customers!inner(name)')
    .eq('org_id', user.orgId)
    .eq('is_active', true)
    .ilike('domain', domain)
    .limit(1)
    .maybeSingle()

  if (existing) {
    const customerName = (existing.customers as unknown as { name: string })?.name || 'another customer'
    return { error: `This domain is already assigned to ${customerName}` }
  }

  const { error } = await supabase
    .from('customer_email_domains')
    .insert({
      org_id: user.orgId,
      customer_id: customerId,
      domain,
      created_by: user.id,
    })

  if (error) {
    if (error.code === '23505') {
      return { error: 'This domain is already assigned to a customer' }
    }
    return { error: error.message }
  }

  logActivity({
    supabase,
    user,
    entityType: 'customer',
    entityId: customerId,
    action: 'domain_added',
    details: { domain },
  })

  revalidatePath(`/customers/${customerId}`)
  return {}
}

// -----------------------------------------------------------------------------
// Remove a domain
// -----------------------------------------------------------------------------

export async function removeCustomerDomain(domainId: string): Promise<{ error?: string }> {
  const user = await requirePermission('customers', 'edit_all')
  const supabase = await createClient()

  // Fetch for activity log
  const { data: domainRecord } = await supabase
    .from('customer_email_domains')
    .select('id, customer_id, domain')
    .eq('id', domainId)
    .single()

  if (!domainRecord) return { error: 'Domain not found' }

  const { error } = await supabase
    .from('customer_email_domains')
    .delete()
    .eq('id', domainId)

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'customer',
    entityId: domainRecord.customer_id,
    action: 'domain_removed',
    details: { domain: domainRecord.domain },
  })

  revalidatePath(`/customers/${domainRecord.customer_id}`)
  return {}
}

// -----------------------------------------------------------------------------
// Resolve customer by domain (used by email handler — admin client, no RLS)
// -----------------------------------------------------------------------------

export async function resolveCustomerByDomain(
  orgId: string,
  domain: string
): Promise<{ customerId: string; customerName: string } | null> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('customer_email_domains')
    .select('customer_id, customers!inner(name)')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .ilike('domain', domain.toLowerCase())
    .limit(1)
    .maybeSingle()

  if (!data) return null

  const customerName = (data.customers as unknown as { name: string })?.name || ''
  return { customerId: data.customer_id, customerName }
}
