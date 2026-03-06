'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { PortalContext, PortalContract } from './types'

export async function getPortalContracts(ctx: PortalContext): Promise<PortalContract[]> {
  const supabase = createAdminClient()

  const { data: contracts } = await supabase
    .from('customer_contracts')
    .select('id, contract_number, status, start_date, end_date, auto_renew, contract_types(name)')
    .eq('customer_id', ctx.customerId)
    .eq('org_id', ctx.orgId)
    .order('start_date', { ascending: false })

  return (contracts || []).map((c) => {
    const typeName = (c.contract_types as unknown as { name: string })?.name || 'Unknown'
    return {
      id: c.id,
      name: c.contract_number,
      contractType: typeName,
      startDate: c.start_date,
      endDate: c.end_date,
      renewalDate: null,
      status: c.status,
      entitlementSummary: null,
    }
  })
}

export async function getPortalContractDetail(
  contractId: string,
  ctx: PortalContext
): Promise<{
  contract: PortalContract
  visitSlots: { dayOfWeek: string; frequency: string; timeWindow: string; portalNotes: string | null }[]
} | null> {
  const supabase = createAdminClient()

  const { data: contract } = await supabase
    .from('customer_contracts')
    .select('id, contract_number, status, start_date, end_date, auto_renew, contract_types(name)')
    .eq('id', contractId)
    .eq('customer_id', ctx.customerId)
    .eq('org_id', ctx.orgId)
    .single()

  if (!contract) return null

  const typeName = (contract.contract_types as unknown as { name: string })?.name || 'Unknown'

  // Fetch visit slot schedule
  const { data: slots } = await supabase
    .from('contract_visit_slots')
    .select('day_of_week, time_slot, cycle_week_numbers, default_start_time, default_end_time, override_start_time, override_end_time, notes, users:engineer_id(first_name, last_name)')
    .eq('customer_contract_id', contractId)
    .order('day_of_week')

  return {
    contract: {
      id: contract.id,
      name: contract.contract_number,
      contractType: typeName,
      startDate: contract.start_date,
      endDate: contract.end_date,
      renewalDate: null,
      status: contract.status,
      entitlementSummary: null,
    },
    visitSlots: (slots || []).map((s: Record<string, unknown>) => {
      const start = ((s.override_start_time || s.default_start_time || '') as string)?.slice(0, 5)
      const end = ((s.override_end_time || s.default_end_time || '') as string)?.slice(0, 5)
      const timeWindow = start && end ? `${start} – ${end}` : (s.time_slot as string) || ''
      const user = s.users as { first_name: string; last_name: string } | null
      return {
        dayOfWeek: s.day_of_week as string,
        frequency: (s.time_slot as string) || '',
        timeWindow,
        portalNotes: (s.notes as string) || null,
        engineerName: user ? `${user.first_name} ${user.last_name}` : null,
        cycleWeekNumbers: (s.cycle_week_numbers as number[]) || [],
      }
    }),
  }
}
