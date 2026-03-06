'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { PortalContext, PortalVisit } from './types'

export async function getPortalVisits(ctx: PortalContext): Promise<PortalVisit[]> {
  const supabase = createAdminClient()

  // Get active contracts for this customer
  const { data: contracts } = await supabase
    .from('customer_contracts')
    .select('id, contract_number')
    .eq('customer_id', ctx.customerId)
    .eq('status', 'active')

  if (!contracts || contracts.length === 0) return []

  const contractIds = contracts.map((c) => c.id)
  const contractNameMap = new Map(contracts.map((c) => [c.id, c.contract_number]))

  const { data: visits } = await supabase
    .from('visit_instances')
    .select(`
      id, visit_date, time_slot, start_time, end_time, status,
      customer_contract_id, notes, engineer_id,
      users!visit_instances_engineer_id_fkey(first_name)
    `)
    .in('customer_contract_id', contractIds)
    .neq('status', 'cancelled')
    .order('visit_date', { ascending: true })

  return (visits || []).map((v) => {
    const user = v.users as unknown as { first_name: string } | null
    return {
      id: v.id,
      scheduledDate: v.visit_date,
      timeSlot: v.time_slot,
      startTime: v.start_time || null,
      endTime: v.end_time || null,
      status: v.status,
      contractReference: v.customer_contract_id ? contractNameMap.get(v.customer_contract_id) || null : null,
      engineerName: user?.first_name || null,
      notes: v.notes || null,
    }
  })
}

export async function getPortalUpcomingVisits(
  ctx: PortalContext,
  days: number = 30
): Promise<PortalVisit[]> {
  const allVisits = await getPortalVisits(ctx)
  const now = new Date()
  const cutoff = new Date(now.getTime() + days * 86400000)

  return allVisits.filter((v) => {
    const d = new Date(v.scheduledDate)
    return d >= now && d <= cutoff
  })
}
