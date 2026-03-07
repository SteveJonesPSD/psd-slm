/**
 * lib/search/index.ts
 * Abstraction layer for all search operations.
 * Handles encrypted field lookups transparently.
 * Agent tool calls (Helen, Jasper, Lucia) MUST use these functions.
 */
import { createClient } from '@/lib/supabase/server'
import { blindIndex, decrypt } from '@/lib/crypto'

export interface SearchResult {
  id: string
  type: 'contact' | 'company' | 'ticket'
  label: string
  sublabel?: string
  url: string
}

/**
 * Search contacts by name (plaintext ILIKE) or exact email (blind index).
 */
export async function searchContacts(
  query: string,
  orgId: string
): Promise<SearchResult[]> {
  const supabase = await createClient()
  const isEmail = query.includes('@')

  if (isEmail) {
    const blind = blindIndex(query.toLowerCase().trim())
    const { data } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, job_title, customer_id')
      .eq('email_blind', blind)
      .eq('is_active', true)
      .limit(20)

    return (data ?? []).map(r => ({
      id: r.id,
      type: 'contact' as const,
      label: `${r.first_name} ${r.last_name}`,
      sublabel: r.job_title ?? undefined,
      url: `/customers/${r.customer_id}`,
    }))
  }

  const { data } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, job_title, customer_id')
    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
    .eq('is_active', true)
    .limit(20)

  return (data ?? []).map(r => ({
    id: r.id,
    type: 'contact' as const,
    label: `${r.first_name} ${r.last_name}`,
    sublabel: r.job_title ?? undefined,
    url: `/customers/${r.customer_id}`,
  }))
}

/**
 * Search companies by name (plaintext) or email domain (plaintext companion column).
 */
export async function searchCompanies(
  query: string,
  orgId: string
): Promise<SearchResult[]> {
  const supabase = await createClient()

  const isDomain = query.startsWith('@') || (!query.includes(' ') && query.includes('.'))
  const domainQuery = query.replace(/^@/, '').toLowerCase().trim()

  if (isDomain) {
    const { data } = await supabase
      .from('customers')
      .select('id, name, city')
      .eq('org_id', orgId)
      .eq('email_domain', domainQuery)
      .limit(20)

    return (data ?? []).map(r => ({
      id: r.id,
      type: 'company' as const,
      label: r.name,
      sublabel: r.city ?? undefined,
      url: `/customers/${r.id}`,
    }))
  }

  const { data } = await supabase
    .from('customers')
    .select('id, name, city')
    .eq('org_id', orgId)
    .ilike('name', `%${query}%`)
    .limit(20)

  return (data ?? []).map(r => ({
    id: r.id,
    type: 'company' as const,
    label: r.name,
    sublabel: r.city ?? undefined,
    url: `/customers/${r.id}`,
  }))
}

/**
 * Search tickets by subject ILIKE.
 * TODO: Switch to tsvector search on search_tokens once fully populated.
 */
export async function searchTickets(
  query: string,
  orgId: string
): Promise<SearchResult[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('tickets')
    .select('id, ticket_number, subject, status')
    .eq('org_id', orgId)
    .ilike('subject', `%${query}%`)
    .limit(20)

  return (data ?? []).map(r => ({
    id: r.id,
    type: 'ticket' as const,
    label: r.subject,
    sublabel: r.ticket_number,
    url: `/helpdesk/tickets/${r.id}`,
  }))
}

/**
 * Search contacts or companies by exact email address (blind index).
 */
export async function searchByEmail(
  email: string,
  orgId: string
): Promise<SearchResult[]> {
  const contacts = await searchContacts(email, orgId)
  const companies = await searchCompanies(email, orgId)
  return [...contacts, ...companies]
}
