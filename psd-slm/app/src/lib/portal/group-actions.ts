'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { CompanyGroup, CompanyGroupMember } from '@/types/company-groups'

/**
 * Get the group where this company is the parent.
 * Used by portal group admin pages.
 */
export async function getPortalGroup(parentCompanyId: string, orgId: string): Promise<CompanyGroup | null> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('company_groups')
    .select(`
      *,
      customers!company_groups_parent_company_id_fkey(id, name, account_number),
      company_group_members(
        id, org_id, group_id, company_id, colour, display_order, created_at,
        customers(id, name, account_number)
      )
    `)
    .eq('parent_company_id', parentCompanyId)
    .eq('org_id', orgId)
    .eq('is_active', true)
    .single()

  if (!data) return null

  const members = ((data.company_group_members as Record<string, unknown>[]) || [])
    .map((m) => ({
      ...m,
      company: m.customers as CompanyGroupMember['company'],
      customers: undefined,
    }))
    .sort((a, b) => ((a as Record<string, unknown>).display_order as number) - ((b as Record<string, unknown>).display_order as number))

  return {
    ...data,
    parent_company: data.customers as CompanyGroup['parent_company'],
    members: members as unknown as CompanyGroupMember[],
    customers: undefined,
    company_group_members: undefined,
  } as unknown as CompanyGroup
}

/**
 * Get summary stats for a member company.
 */
export async function getPortalMemberStats(companyId: string, orgId: string): Promise<{
  openTickets: number
  activeContracts: number
  openQuotes: number
}> {
  const supabase = createAdminClient()

  const [ticketsRes, contractsRes, quotesRes] = await Promise.all([
    supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', companyId)
      .eq('org_id', orgId)
      .not('status', 'in', '("resolved","closed","cancelled","merged")'),
    supabase
      .from('customer_contracts')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', companyId)
      .eq('org_id', orgId)
      .eq('status', 'active'),
    supabase
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', companyId)
      .eq('org_id', orgId)
      .in('status', ['sent', 'viewed']),
  ])

  return {
    openTickets: ticketsRes.count || 0,
    activeContracts: contractsRes.count || 0,
    openQuotes: quotesRes.count || 0,
  }
}

/**
 * Get tickets across all member companies in a group.
 */
export async function getPortalGroupTickets(
  companyIds: string[],
  orgId: string
): Promise<{
  id: string
  ticket_number: string
  subject: string
  status: string
  priority: string
  created_at: string
  updated_at: string
  customer_id: string
  customer_name: string
}[]> {
  if (companyIds.length === 0) return []

  const supabase = createAdminClient()

  const { data } = await supabase
    .from('tickets')
    .select(`
      id, ticket_number, subject, status, priority, created_at, updated_at,
      customer_id, customers(name)
    `)
    .in('customer_id', companyIds)
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false })
    .limit(200)

  return (data || []).map((t: Record<string, unknown>) => ({
    id: t.id as string,
    ticket_number: t.ticket_number as string,
    subject: t.subject as string,
    status: t.status as string,
    priority: t.priority as string,
    created_at: t.created_at as string,
    updated_at: t.updated_at as string,
    customer_id: t.customer_id as string,
    customer_name: (t.customers as { name: string } | null)?.name || '',
  }))
}
