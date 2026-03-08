'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { PortalContext } from './types'
import type { OnsiteJobItem, OnsiteJobAuditEntry, OnsiteJobCategory } from '@/lib/onsite-jobs/types'

export async function getPortalOnsiteJobItems(ctx: PortalContext): Promise<OnsiteJobItem[]> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('onsite_job_items')
    .select(`
      *,
      onsite_job_categories(id, name, colour, is_active, sort_order)
    `)
    .eq('customer_id', ctx.customerId)
    .eq('org_id', ctx.orgId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })

  return (data || []).map((row: Record<string, unknown>) => ({
    ...row,
    category: row.onsite_job_categories,
  })) as unknown as OnsiteJobItem[]
}

export async function getPortalOnsiteJobItem(
  id: string,
  ctx: PortalContext,
): Promise<{ item: OnsiteJobItem; audit: OnsiteJobAuditEntry[] } | null> {
  const supabase = createAdminClient()

  const { data: item } = await supabase
    .from('onsite_job_items')
    .select(`
      *,
      onsite_job_categories(id, name, colour, is_active, sort_order)
    `)
    .eq('id', id)
    .eq('customer_id', ctx.customerId)
    .eq('org_id', ctx.orgId)
    .single()

  if (!item) return null

  const { data: auditRows } = await supabase
    .from('onsite_job_audit')
    .select(`
      *,
      portal_users!onsite_job_audit_actor_portal_user_id_fkey(id, contact_id, contacts(first_name, last_name))
    `)
    .eq('onsite_job_item_id', id)
    .order('created_at', { ascending: true })

  // Filter out internal-only audit entries
  const portalVisibleActions = ['created', 'status_changed', 'engineer_note', 'escalated', 'cancelled', 'visit_linked']
  const filteredAudit = (auditRows || [])
    .filter((a: Record<string, unknown>) => portalVisibleActions.includes(a.action as string))
    .map((a: Record<string, unknown>) => ({
      ...a,
      actor_portal_user: a.portal_users,
    })) as unknown as OnsiteJobAuditEntry[]

  return {
    item: { ...item, category: (item as Record<string, unknown>).onsite_job_categories } as unknown as OnsiteJobItem,
    audit: filteredAudit,
  }
}

export async function getPortalOpenOjiCount(ctx: PortalContext): Promise<number> {
  const supabase = createAdminClient()

  const { count } = await supabase
    .from('onsite_job_items')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', ctx.customerId)
    .eq('org_id', ctx.orgId)
    .in('status', ['pending', 'in_progress'])

  return count || 0
}

export async function getNextVisitForPortal(ctx: PortalContext): Promise<{
  visit_date: string
  start_time: string | null
  end_time: string | null
  status: string
} | null> {
  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('visit_instances')
    .select('visit_date, start_time, end_time, status')
    .eq('customer_id', ctx.customerId)
    .in('status', ['scheduled', 'confirmed'])
    .gte('visit_date', today)
    .order('visit_date', { ascending: true })
    .limit(1)
    .maybeSingle()

  return data || null
}

export async function getPortalOnsiteJobCategories(ctx: PortalContext): Promise<OnsiteJobCategory[]> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('onsite_job_categories')
    .select('*')
    .eq('org_id', ctx.orgId)
    .eq('is_active', true)
    .order('sort_order')

  return (data || []) as unknown as OnsiteJobCategory[]
}

export async function checkCustomerOnsiteContract(ctx: PortalContext): Promise<boolean> {
  const supabase = createAdminClient()

  const { data: contract } = await supabase
    .from('customer_contracts')
    .select('contract_types(includes_onsite)')
    .eq('customer_id', ctx.customerId)
    .eq('org_id', ctx.orgId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  return !!(contract?.contract_types as unknown as Record<string, boolean> | null)?.includes_onsite
}
