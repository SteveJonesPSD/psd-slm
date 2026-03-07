// =============================================================================
// Contact & Customer Resolution for Inbound Email
// Resolves sender email → contact + customer, handling multi-company contacts.
// All email comparison queries are isolated here for future blind-index swap.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { encrypt, decrypt, blindIndex } from '@/lib/crypto'

export interface ResolvedContact {
  id: string
  first_name: string
  last_name: string
  email: string | null
  customer_id: string | null
}

export interface CustomerOption {
  customer_id: string
  customer_name: string
  is_primary: boolean
}

export interface ResolutionResult {
  contact: ResolvedContact | null
  customer: { id: string; name: string } | null
  needsAssignment: boolean
  assignmentOptions: CustomerOption[]
  contactAutoCreated: boolean
}

// -----------------------------------------------------------------------------
// Main resolution function
// -----------------------------------------------------------------------------

export async function resolveContactAndCustomer(
  senderEmail: string,
  senderName: string,
  orgId: string,
  supabase: SupabaseClient
): Promise<ResolutionResult> {
  const email = senderEmail.trim().toLowerCase()
  const domain = email.split('@')[1]
  if (!domain) {
    return { contact: null, customer: null, needsAssignment: true, assignmentOptions: [], contactAutoCreated: false }
  }

  // Step 1: Domain lookup via customer_email_domains
  const domainCustomer = await findCustomerByDomain(domain, orgId, supabase)

  if (domainCustomer) {
    // Domain matched a single customer — find or create contact under that customer
    const contact = await findContactByEmail(email, orgId, supabase)

    if (contact) {
      return {
        contact,
        customer: domainCustomer,
        needsAssignment: false,
        assignmentOptions: [],
        contactAutoCreated: false,
      }
    }

    // Auto-create contact under the domain-matched customer
    const newContact = await autoCreateContact(email, senderName, domainCustomer.id, orgId, supabase)
    return {
      contact: newContact,
      customer: domainCustomer,
      needsAssignment: false,
      assignmentOptions: [],
      contactAutoCreated: true,
    }
  }

  // Step 2: No domain match — search contacts by exact email across org
  const contact = await findContactByEmail(email, orgId, supabase)

  if (contact) {
    // Found a contact — resolve their customer associations
    const customers = await getContactCustomers(contact.id, contact.customer_id, orgId, supabase)

    if (customers.length === 1) {
      return {
        contact,
        customer: { id: customers[0].customer_id, name: customers[0].customer_name },
        needsAssignment: false,
        assignmentOptions: [],
        contactAutoCreated: false,
      }
    }

    if (customers.length > 1) {
      // Multi-company contact — agent must choose
      return {
        contact,
        customer: null,
        needsAssignment: true,
        assignmentOptions: customers,
        contactAutoCreated: false,
      }
    }

    // Contact exists but has no customer (shouldn't happen, but handle gracefully)
    return {
      contact,
      customer: null,
      needsAssignment: true,
      assignmentOptions: [],
      contactAutoCreated: false,
    }
  }

  // Step 3: Unknown sender — no domain match, no contact
  return { contact: null, customer: null, needsAssignment: true, assignmentOptions: [], contactAutoCreated: false }
}

// -----------------------------------------------------------------------------
// Isolated query helpers (swap to blind index when crypto is live)
// -----------------------------------------------------------------------------

async function findCustomerByDomain(
  domain: string,
  orgId: string,
  supabase: SupabaseClient
): Promise<{ id: string; name: string } | null> {
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
  return { id: data.customer_id, name: customerName }
}

/**
 * Find a contact by exact email match across the entire org.
 * Uses blind index for encrypted email lookup.
 */
async function findContactByEmail(
  email: string,
  orgId: string,
  supabase: SupabaseClient
): Promise<ResolvedContact | null> {
  const blind = blindIndex(email.toLowerCase().trim())
  const { data } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email, customer_id')
    .eq('org_id', orgId)
    .eq('email_blind', blind)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (!data) return null

  // Decrypt email before returning
  return {
    ...data,
    email: data.email ? decrypt(data.email) : null,
  } as ResolvedContact
}

/**
 * Get all customers associated with a contact (primary + junction links).
 */
async function getContactCustomers(
  contactId: string,
  primaryCustomerId: string | null,
  orgId: string,
  supabase: SupabaseClient
): Promise<CustomerOption[]> {
  const customers: CustomerOption[] = []

  // Primary customer (from contacts.customer_id)
  if (primaryCustomerId) {
    const { data: primary } = await supabase
      .from('customers')
      .select('id, name')
      .eq('id', primaryCustomerId)
      .single()

    if (primary) {
      customers.push({ customer_id: primary.id, customer_name: primary.name, is_primary: true })
    }
  }

  // Secondary customers (from contact_customer_links)
  const { data: links } = await supabase
    .from('contact_customer_links')
    .select('customer_id, is_primary, customers!inner(name)')
    .eq('contact_id', contactId)
    .eq('org_id', orgId)

  if (links) {
    for (const link of links) {
      const name = (link.customers as unknown as { name: string })?.name || ''
      // Avoid duplicating the primary
      if (!customers.some(c => c.customer_id === link.customer_id)) {
        customers.push({ customer_id: link.customer_id, customer_name: name, is_primary: link.is_primary || false })
      }
    }
  }

  return customers
}

/**
 * Auto-create a contact under a specific customer from an inbound email.
 */
async function autoCreateContact(
  email: string,
  displayName: string,
  customerId: string,
  orgId: string,
  supabase: SupabaseClient
): Promise<ResolvedContact | null> {
  const { firstName, lastName } = parseDisplayName(displayName, email)
  const emailDomain = email.split('@')[1]?.toLowerCase() ?? null

  const { data: newContact } = await supabase
    .from('contacts')
    .insert({
      org_id: orgId,
      customer_id: customerId,
      first_name: firstName,
      last_name: lastName,
      email: encrypt(email),
      email_blind: blindIndex(email.toLowerCase().trim()),
      email_domain: emailDomain,
      is_primary: false,
      is_billing: false,
      is_active: true,
      is_auto_created: true,
    })
    .select('id, first_name, last_name, email, customer_id')
    .single()

  if (!newContact) return null

  // Decrypt email in returned row
  newContact.email = newContact.email ? decrypt(newContact.email) : null

  // Also insert into junction table as primary link
  await supabase
    .from('contact_customer_links')
    .insert({
      contact_id: newContact.id,
      customer_id: customerId,
      org_id: orgId,
      is_primary: true,
    })
    .select()
    .maybeSingle() // ignore conflict if backfill already inserted

  // Log activity
  await supabase.from('activity_log').insert({
    org_id: orgId,
    entity_type: 'contact',
    entity_id: newContact.id,
    action: 'auto_created',
    details: { source: 'email_ingestion', email },
    created_at: new Date().toISOString(),
  })

  return newContact as ResolvedContact
}

// -----------------------------------------------------------------------------
// Display name parser (shared with helpdesk handler)
// -----------------------------------------------------------------------------

export function parseDisplayName(
  displayName: string,
  email: string
): { firstName: string; lastName: string } {
  const trimmed = displayName.trim()

  if (trimmed && trimmed !== email) {
    if (trimmed.includes(' ')) {
      const lastSpace = trimmed.lastIndexOf(' ')
      return {
        firstName: trimmed.substring(0, lastSpace),
        lastName: trimmed.substring(lastSpace + 1),
      }
    }
    return { firstName: trimmed, lastName: '(Unknown)' }
  }

  const localPart = email.split('@')[0] || 'unknown'
  const parts = localPart.split(/[._]/).filter(Boolean)
  if (parts.length >= 2) {
    const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
    return {
      firstName: titleCase(parts[0]),
      lastName: titleCase(parts[parts.length - 1]),
    }
  }

  const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
  return { firstName: titleCase(localPart), lastName: '(Unknown)' }
}
