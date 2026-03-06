'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'

/**
 * Assign an unassigned ticket to a customer (and optionally a contact).
 * Clears the needs_customer_assignment flag and recalculates SLA.
 */
export async function assignTicketToCustomer(
  ticketId: string,
  customerId: string,
  contactId?: string | null
): Promise<{ error?: string }> {
  const user = await requirePermission('helpdesk', 'edit')
  const supabase = await createClient()

  // Fetch customer name for logging
  const { data: customer } = await supabase
    .from('customers')
    .select('id, name')
    .eq('id', customerId)
    .single()

  if (!customer) return { error: 'Customer not found' }

  // Build update payload
  const update: Record<string, unknown> = {
    customer_id: customerId,
    needs_customer_assignment: false,
    customer_assignment_options: null,
    updated_at: new Date().toISOString(),
  }
  if (contactId) {
    update.contact_id = contactId
  }

  // Recalculate SLA based on new customer's contract
  const sla = await resolveSlaForCustomer(supabase, user.orgId, customerId)
  if (sla.slaPlanId) update.sla_plan_id = sla.slaPlanId
  if (sla.contractId) update.contract_id = sla.contractId
  if (sla.responseDueAt) update.sla_response_due_at = sla.responseDueAt
  if (sla.resolutionDueAt) update.sla_resolution_due_at = sla.resolutionDueAt

  const { error } = await supabase
    .from('tickets')
    .update(update)
    .eq('id', ticketId)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'ticket',
    entityId: ticketId,
    action: 'customer_assigned',
    details: {
      customer_id: customerId,
      customer_name: customer.name,
      contact_id: contactId || null,
    },
  })

  revalidatePath(`/helpdesk/tickets/${ticketId}`)
  revalidatePath('/helpdesk')
  return {}
}

/**
 * Simplified SLA resolution for post-assignment recalculation.
 */
async function resolveSlaForCustomer(
  supabase: SupabaseClient,
  orgId: string,
  customerId: string
): Promise<{
  slaPlanId: string | null
  contractId: string | null
  responseDueAt: string | null
  resolutionDueAt: string | null
}> {
  const empty = { slaPlanId: null, contractId: null, responseDueAt: null, resolutionDueAt: null }

  // Check for active support contract
  const { data: contract } = await supabase
    .from('support_contracts')
    .select('id, sla_plan_id, sla_plans(*, sla_plan_targets(*))')
    .eq('customer_id', customerId)
    .eq('org_id', orgId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  interface SlaPlanWithTargets {
    sla_plan_targets?: { priority: string; response_time_minutes: number; resolution_time_minutes: number }[]
  }

  let slaPlanId: string | null = null
  let contractId: string | null = null
  let slaPlan: SlaPlanWithTargets | null = null

  if (contract) {
    contractId = contract.id
    slaPlanId = contract.sla_plan_id
    slaPlan = contract.sla_plans as unknown as SlaPlanWithTargets
  }

  // Fallback to default SLA plan
  if (!slaPlanId) {
    const { data: defaultPlan } = await supabase
      .from('sla_plans')
      .select('*, sla_plan_targets(*)')
      .eq('org_id', orgId)
      .eq('is_default', true)
      .eq('is_active', true)
      .maybeSingle()

    if (defaultPlan) {
      slaPlanId = defaultPlan.id
      slaPlan = defaultPlan as unknown as SlaPlanWithTargets
    }
  }

  if (!slaPlan?.sla_plan_targets) return { slaPlanId, contractId, responseDueAt: null, resolutionDueAt: null }

  const target = slaPlan.sla_plan_targets.find(t => t.priority === 'medium')
  if (!target) return { slaPlanId, contractId, responseDueAt: null, resolutionDueAt: null }

  const now = new Date()
  return {
    slaPlanId,
    contractId,
    responseDueAt: new Date(now.getTime() + target.response_time_minutes * 60_000).toISOString(),
    resolutionDueAt: new Date(now.getTime() + target.resolution_time_minutes * 60_000).toISOString(),
  }
}
