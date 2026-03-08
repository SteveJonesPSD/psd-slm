'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'
import { calculateSlaDeadline } from '@/lib/sla'
import { formatTicketNumber } from '@/lib/helpdesk'
import { triageTicket } from '@/lib/helpdesk/triage'
import { processAutoClose } from '@/lib/helpdesk/auto-close'
import type { TicketStatus, TicketPriority, SlaPlan, SlaPlanTarget, DepartmentMemberRole } from '@/types/database'
import { createNotifications } from '@/lib/notifications'
import { notifyTicketStakeholders } from '@/lib/helpdesk/ticket-notifications'
import { decryptContactRow } from '@/lib/crypto-helpers'

// ============================================================================
// TICKET NUMBER GENERATION
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateTicketNumber(supabase: any, orgId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `TKT-${year}-`

  const { data } = await supabase
    .from('tickets')
    .select('ticket_number')
    .eq('org_id', orgId)
    .like('ticket_number', `${prefix}%`)
    .order('ticket_number', { ascending: false })
    .limit(1)

  let seq = 1
  if (data && data.length > 0) {
    const last = data[0].ticket_number
    const num = parseInt(last.replace(prefix, ''), 10)
    if (!isNaN(num)) seq = num + 1
  }

  return formatTicketNumber(year, seq)
}

// ============================================================================
// CATEGORY CRUD (admin)
// ============================================================================

export async function getCategories() {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ticket_categories')
    .select('*, parent:parent_id(id, name)')
    .eq('org_id', user.orgId)
    .order('sort_order')

  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function createCategory(formData: { name: string; description?: string; parent_id?: string; sort_order?: number }) {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ticket_categories')
    .insert({
      org_id: user.orgId,
      name: formData.name,
      description: formData.description || null,
      parent_id: formData.parent_id || null,
      sort_order: formData.sort_order ?? 0,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'ticket_category', entityId: data.id, action: 'created', details: { name: formData.name } })
  revalidatePath('/helpdesk/categories')
  return { data }
}

export async function updateCategory(id: string, formData: { name?: string; description?: string; parent_id?: string | null; sort_order?: number; is_active?: boolean }) {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  const { error } = await supabase
    .from('ticket_categories')
    .update({ ...formData, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'ticket_category', entityId: id, action: 'updated' })
  revalidatePath('/helpdesk/categories')
  return { success: true }
}

export async function deleteCategory(id: string) {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  const { error } = await supabase
    .from('ticket_categories')
    .delete()
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'ticket_category', entityId: id, action: 'deleted' })
  revalidatePath('/helpdesk/categories')
  return { success: true }
}

// ============================================================================
// TAG CRUD (admin)
// ============================================================================

export async function getTags() {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ticket_tags')
    .select('*')
    .eq('org_id', user.orgId)
    .order('name')

  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function createTag(formData: { name: string; color?: string }) {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ticket_tags')
    .insert({ org_id: user.orgId, name: formData.name, color: formData.color || '#6b7280' })
    .select()
    .single()

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'ticket_tag', entityId: data.id, action: 'created', details: { name: formData.name } })
  revalidatePath('/helpdesk')
  return { data }
}

export async function updateTag(id: string, formData: { name?: string; color?: string; is_active?: boolean; is_ai_assignable?: boolean }) {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  const { error } = await supabase
    .from('ticket_tags')
    .update(formData)
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'ticket_tag', entityId: id, action: 'updated' })
  revalidatePath('/helpdesk')
  return { success: true }
}

export async function deleteTag(id: string) {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  const { error } = await supabase
    .from('ticket_tags')
    .delete()
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'ticket_tag', entityId: id, action: 'deleted' })
  revalidatePath('/helpdesk')
  return { success: true }
}

// ============================================================================
// CANNED RESPONSE CRUD (admin)
// ============================================================================

export async function getCannedResponses() {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('canned_responses')
    .select('*, creator:created_by(id, first_name, last_name)')
    .eq('org_id', user.orgId)
    .order('title')

  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function createCannedResponse(formData: { title: string; body: string; category?: string; is_shared?: boolean }) {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('canned_responses')
    .insert({
      org_id: user.orgId,
      title: formData.title,
      body: formData.body,
      category: formData.category || null,
      is_shared: formData.is_shared ?? true,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'canned_response', entityId: data.id, action: 'created', details: { title: formData.title } })
  revalidatePath('/helpdesk/canned-responses')
  return { data }
}

export async function updateCannedResponse(id: string, formData: { title?: string; body?: string; category?: string | null; is_shared?: boolean }) {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  const { error } = await supabase
    .from('canned_responses')
    .update({ ...formData, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'canned_response', entityId: id, action: 'updated' })
  revalidatePath('/helpdesk/canned-responses')
  return { success: true }
}

export async function deleteCannedResponse(id: string) {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  const { error } = await supabase
    .from('canned_responses')
    .delete()
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'canned_response', entityId: id, action: 'deleted' })
  revalidatePath('/helpdesk/canned-responses')
  return { success: true }
}

// ============================================================================
// SLA PLAN CRUD (admin)
// ============================================================================

export async function getSlaPlans() {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sla_plans')
    .select('*, sla_plan_targets(*)')
    .eq('org_id', user.orgId)
    .order('name')

  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function getContractTypes(): Promise<{ id: string; name: string }[]> {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  const { data } = await supabase
    .from('contract_types')
    .select('id, name')
    .eq('org_id', user.orgId)
    .order('name')

  return data || []
}

export async function getSlaPlan(id: string) {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sla_plans')
    .select('*, sla_plan_targets(*)')
    .eq('id', id)
    .eq('org_id', user.orgId)
    .single()

  if (error) return { error: error.message }
  return { data }
}

export async function createSlaPlan(formData: {
  name: string
  description?: string
  business_hours_start?: string
  business_hours_end?: string
  business_days?: number[]
  is_24x7?: boolean
  is_default?: boolean
  targets?: { priority: string; response_time_minutes: number; resolution_time_minutes: number }[]
}) {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  // If setting as default, unset other defaults first
  if (formData.is_default) {
    await supabase
      .from('sla_plans')
      .update({ is_default: false })
      .eq('org_id', user.orgId)
      .eq('is_default', true)
  }

  const { data, error } = await supabase
    .from('sla_plans')
    .insert({
      org_id: user.orgId,
      name: formData.name,
      description: formData.description || null,
      business_hours_start: formData.business_hours_start || '08:00',
      business_hours_end: formData.business_hours_end || '17:30',
      business_days: formData.business_days || [1, 2, 3, 4, 5],
      is_24x7: formData.is_24x7 ?? false,
      is_default: formData.is_default ?? false,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Insert targets
  if (formData.targets && formData.targets.length > 0) {
    const { error: targetError } = await supabase
      .from('sla_plan_targets')
      .insert(formData.targets.map(t => ({
        sla_plan_id: data.id,
        priority: t.priority,
        response_time_minutes: t.response_time_minutes,
        resolution_time_minutes: t.resolution_time_minutes,
      })))

    if (targetError) return { error: targetError.message }
  }

  logActivity({ supabase, user, entityType: 'sla_plan', entityId: data.id, action: 'created', details: { name: formData.name } })
  revalidatePath('/helpdesk/sla')
  return { data }
}

export async function updateSlaPlan(id: string, formData: {
  name?: string
  description?: string | null
  business_hours_start?: string
  business_hours_end?: string
  business_days?: number[]
  is_24x7?: boolean
  is_default?: boolean
  is_active?: boolean
  targets?: { priority: string; response_time_minutes: number; resolution_time_minutes: number }[]
}) {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  if (formData.is_default) {
    await supabase
      .from('sla_plans')
      .update({ is_default: false })
      .eq('org_id', user.orgId)
      .eq('is_default', true)
  }

  const { targets, ...planData } = formData
  const { error } = await supabase
    .from('sla_plans')
    .update({ ...planData, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  // Replace targets if provided
  if (targets) {
    await supabase.from('sla_plan_targets').delete().eq('sla_plan_id', id)
    if (targets.length > 0) {
      const { error: targetError } = await supabase
        .from('sla_plan_targets')
        .insert(targets.map(t => ({
          sla_plan_id: id,
          priority: t.priority,
          response_time_minutes: t.response_time_minutes,
          resolution_time_minutes: t.resolution_time_minutes,
        })))
      if (targetError) return { error: targetError.message }
    }
  }

  logActivity({ supabase, user, entityType: 'sla_plan', entityId: id, action: 'updated' })
  revalidatePath('/helpdesk/sla')
  return { success: true }
}

export async function deleteSlaPlan(id: string) {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  const { error } = await supabase
    .from('sla_plans')
    .delete()
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'sla_plan', entityId: id, action: 'deleted' })
  revalidatePath('/helpdesk/sla')
  return { success: true }
}

// ============================================================================
// SUPPORT CONTRACT CRUD (admin) — uses customer_contracts table
// ============================================================================

export async function getContracts() {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('customer_contracts')
    .select('*, customers(id, name), sla_plans(id, name), contract_types(id, name, includes_remote_support, includes_telephone, includes_onsite)')
    .eq('org_id', user.orgId)
    .not('sla_plan_id', 'is', null)
    .order('contract_number')

  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function getContract(id: string) {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('customer_contracts')
    .select('*, customers(id, name), sla_plans(id, name, sla_plan_targets(*)), contract_types(id, name, includes_remote_support, includes_telephone, includes_onsite)')
    .eq('id', id)
    .eq('org_id', user.orgId)
    .single()

  if (error) return { error: error.message }

  // Get recent tickets for this contract
  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, ticket_number, subject, status, priority, created_at')
    .eq('customer_contract_id', id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Get time usage this month
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data: timeEntries } = await supabase
    .from('ticket_time_entries')
    .select('minutes')
    .in('ticket_id', (tickets || []).map(t => t.id))
    .gte('entry_date', startOfMonth.toISOString().split('T')[0])

  const totalMinutes = (timeEntries || []).reduce((sum, e) => sum + e.minutes, 0)

  return { data: { ...data, recent_tickets: tickets || [], time_used_this_month: totalMinutes } }
}

export async function createContract(formData: {
  customer_id: string
  sla_plan_id?: string
  contract_type_id: string
  contract_number: string
  monthly_hours?: number
  start_date: string
  end_date?: string
  notes?: string
}) {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('customer_contracts')
    .insert({
      org_id: user.orgId,
      customer_id: formData.customer_id,
      sla_plan_id: formData.sla_plan_id || null,
      contract_type_id: formData.contract_type_id,
      contract_number: formData.contract_number,
      monthly_hours: formData.monthly_hours || null,
      start_date: formData.start_date,
      end_date: formData.end_date || null,
      notes: formData.notes || null,
      status: 'active',
    })
    .select()
    .single()

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'customer_contract', entityId: data.id, action: 'created', details: { contract_number: formData.contract_number } })
  revalidatePath('/helpdesk/contracts')
  return { data }
}

export async function updateContract(id: string, formData: {
  customer_id?: string
  sla_plan_id?: string | null
  contract_type_id?: string
  contract_number?: string
  monthly_hours?: number | null
  start_date?: string
  end_date?: string | null
  status?: string
  notes?: string | null
}) {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  const { error } = await supabase
    .from('customer_contracts')
    .update({ ...formData, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'customer_contract', entityId: id, action: 'updated' })
  revalidatePath('/helpdesk/contracts')
  revalidatePath(`/helpdesk/contracts/${id}`)
  return { success: true }
}

export async function deleteContract(id: string) {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  const { error } = await supabase
    .from('customer_contracts')
    .delete()
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'customer_contract', entityId: id, action: 'deleted' })
  revalidatePath('/helpdesk/contracts')
  return { success: true }
}

// ============================================================================
// TICKET ACTIONS
// ============================================================================

export async function getTickets(filters?: {
  status?: string[]
  priority?: string
  assigned_to?: string
  ticket_type?: string
  brand_id?: string
  category_id?: string
  search?: string
  sla_filter?: 'all' | 'on_track' | 'at_risk' | 'breached'
}) {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  let query = supabase
    .from('v_ticket_summary')
    .select('*')
    .eq('org_id', user.orgId)

  if (filters?.status && filters.status.length > 0) {
    query = query.in('status', filters.status)
  } else {
    // Default: exclude closed and cancelled
    query = query.not('status', 'in', '(closed,cancelled)')
  }

  if (filters?.priority) query = query.eq('priority', filters.priority)
  if (filters?.assigned_to) query = query.eq('assigned_to', filters.assigned_to)
  if (filters?.ticket_type) query = query.eq('ticket_type', filters.ticket_type)
  if (filters?.brand_id) query = query.eq('brand_id', filters.brand_id)
  if (filters?.category_id) query = query.eq('category_id', filters.category_id)
  if (filters?.search) {
    query = query.or(`subject.ilike.%${filters.search}%,ticket_number.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%`)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function getTicket(id: string) {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  const { data: ticket, error } = await supabase
    .from('tickets')
    .select(`
      *,
      customers(id, name),
      contacts(id, first_name, last_name, email, phone),
      assignee:assigned_to(id, first_name, last_name, initials, color),
      creator:created_by(id, first_name, last_name),
      ticket_categories(id, name),
      brands(id, name),
      customer_contract:customer_contract_id(id, contract_number, monthly_hours, sla_plans(id, name), contract_types(id, name, includes_remote_support, includes_telephone, includes_onsite)),
      sla_plans(id, name, business_hours_start, business_hours_end, business_days, is_24x7, sla_plan_targets(*)),
      merge_target:merged_into_ticket_id(id, ticket_number)
    `)
    .eq('id', id)
    .eq('org_id', user.orgId)
    .single()

  if (error) return { error: error.message }

  // If no contract linked but ticket has a customer, dynamically resolve active contract
  if (!ticket.customer_contract_id && ticket.customer_id) {
    const { data: activeContract } = await supabase
      .from('customer_contracts')
      .select('id, contract_number, monthly_hours, sla_plans(id, name), contract_types(id, name, includes_remote_support, includes_telephone, includes_onsite)')
      .eq('customer_id', ticket.customer_id)
      .eq('org_id', user.orgId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (activeContract) {
      ;(ticket as Record<string, unknown>).customer_contract = activeContract
    }
  }

  // Fetch messages
  const { data: messages } = await supabase
    .from('ticket_messages')
    .select('*, sender:sender_id(id, first_name, last_name, initials, color, avatar_url)')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true })

  // Fetch tags
  const { data: tagAssignments } = await supabase
    .from('ticket_tag_assignments')
    .select('tag_id, ticket_tags(id, name, color)')
    .eq('ticket_id', id)

  // Fetch time entries
  const { data: timeEntries } = await supabase
    .from('ticket_time_entries')
    .select('*, user:user_id(id, first_name, last_name, initials)')
    .eq('ticket_id', id)
    .order('created_at', { ascending: false })

  // Fetch watchers
  const { data: watchers } = await supabase
    .from('ticket_watchers')
    .select('user_id, users(id, first_name, last_name, initials, color)')
    .eq('ticket_id', id)

  // Fetch SLA events
  const { data: slaEvents } = await supabase
    .from('sla_events')
    .select('*')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true })

  // Fetch attachments
  const { data: attachments } = await supabase
    .from('ticket_attachments')
    .select('id, message_id, file_name, file_path, file_size, mime_type, uploaded_by, created_at')
    .eq('ticket_id', id)
    .order('created_at', { ascending: false })

  // Debounced view log — once per 30 min per user per ticket
  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data: recentView } = await supabase
    .from('activity_log')
    .select('id')
    .eq('entity_type', 'ticket')
    .eq('entity_id', id)
    .eq('user_id', user.id)
    .eq('action', 'viewed')
    .gte('created_at', thirtyMinsAgo)
    .limit(1)
    .maybeSingle()

  if (!recentView) {
    logActivity({ supabase, user, entityType: 'ticket', entityId: id, action: 'viewed', details: { ticket_number: ticket.ticket_number, status: ticket.status } })
  }

  // Decrypt contact PII in nested join
  const decryptedTicket = {
    ...ticket,
    contacts: ticket.contacts ? decryptContactRow(ticket.contacts as Record<string, unknown>) : ticket.contacts,
  }

  return {
    data: {
      ...decryptedTicket,
      messages: messages || [],
      tags: (tagAssignments || []).map(ta => (ta as Record<string, unknown>).ticket_tags),
      time_entries: timeEntries || [],
      watchers: (watchers || []).map(w => (w as Record<string, unknown>).users),
      sla_events: slaEvents || [],
      attachments: attachments || [],
    },
  }
}

export async function createTicket(formData: {
  customer_id: string
  contact_id?: string
  assigned_to?: string
  brand_id?: string
  category_id?: string
  subject: string
  description?: string
  ticket_type?: string
  priority?: string
  site_location?: string
  room_number?: string
  device_details?: string
  scheduled_date?: string
  tag_ids?: string[]
}) {
  const user = await requirePermission('helpdesk', 'create')
  const supabase = await createClient()

  const ticketNumber = await generateTicketNumber(supabase, user.orgId)

  // Resolve SLA plan: contract direct → contract type default → org default → null
  let slaPlanId: string | null = null
  let contractId: string | null = null
  let slaPlan: (SlaPlan & { sla_plan_targets: SlaPlanTarget[] }) | null = null

  // Check for active contract — link contract regardless of SLA, then resolve SLA via inheritance
  const { data: contract } = await supabase
    .from('customer_contracts')
    .select('id, sla_plan_id, sla_plans(*, sla_plan_targets(*)), contract_types(default_sla_plan_id)')
    .eq('customer_id', formData.customer_id)
    .eq('org_id', user.orgId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (contract) {
    contractId = contract.id
    const directSlaId = contract.sla_plan_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typeSlaId = ((contract as any).contract_types?.default_sla_plan_id as string) || null

    if (directSlaId && contract.sla_plans) {
      slaPlanId = directSlaId
      slaPlan = contract.sla_plans as unknown as SlaPlan & { sla_plan_targets: SlaPlanTarget[] }
    } else if (typeSlaId) {
      // Inherit from contract type — need to fetch the plan
      const { data: typePlan } = await supabase
        .from('sla_plans')
        .select('*, sla_plan_targets(*)')
        .eq('id', typeSlaId)
        .single()
      if (typePlan) {
        slaPlanId = typePlan.id
        slaPlan = typePlan as unknown as SlaPlan & { sla_plan_targets: SlaPlanTarget[] }
      }
    }
  }

  // Fallback to default SLA plan
  if (!slaPlanId) {
    const { data: defaultPlan } = await supabase
      .from('sla_plans')
      .select('*, sla_plan_targets(*)')
      .eq('org_id', user.orgId)
      .eq('is_default', true)
      .eq('is_active', true)
      .maybeSingle()

    if (defaultPlan) {
      slaPlanId = defaultPlan.id
      slaPlan = defaultPlan as unknown as SlaPlan & { sla_plan_targets: SlaPlanTarget[] }
    }
  }

  // Calculate SLA deadlines
  const now = new Date()
  let slaResponseDueAt: string | null = null
  let slaResolutionDueAt: string | null = null
  const priority = (formData.priority || 'medium') as TicketPriority

  if (slaPlan) {
    const target = slaPlan.sla_plan_targets?.find(t => t.priority === priority)
    if (target) {
      slaResponseDueAt = calculateSlaDeadline(now, target.response_time_minutes, slaPlan).toISOString()
      slaResolutionDueAt = calculateSlaDeadline(now, target.resolution_time_minutes, slaPlan).toISOString()
    }
  }

  // Generate portal token
  const portalToken = crypto.randomUUID()

  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({
      org_id: user.orgId,
      ticket_number: ticketNumber,
      customer_id: formData.customer_id,
      contact_id: formData.contact_id || null,
      assigned_to: formData.assigned_to || null,
      brand_id: formData.brand_id || null,
      category_id: formData.category_id || null,
      customer_contract_id: contractId,
      sla_plan_id: slaPlanId,
      subject: formData.subject,
      description: formData.description || null,
      ticket_type: formData.ticket_type || 'helpdesk',
      priority,
      sla_response_due_at: slaResponseDueAt,
      sla_resolution_due_at: slaResolutionDueAt,
      site_location: formData.site_location || null,
      room_number: formData.room_number || null,
      device_details: formData.device_details || null,
      scheduled_date: formData.scheduled_date || null,
      portal_token: portalToken,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Create initial message from description
  if (formData.description) {
    await supabase.from('ticket_messages').insert({
      ticket_id: ticket.id,
      sender_type: 'agent',
      sender_id: user.id,
      sender_name: `${user.firstName} ${user.lastName}`,
      body: formData.description,
      is_internal: false,
    })
  }

  // Create SLA started event
  if (slaPlanId) {
    await supabase.from('sla_events').insert({
      ticket_id: ticket.id,
      event_type: 'started',
      event_data: { sla_plan_id: slaPlanId, response_due: slaResponseDueAt, resolution_due: slaResolutionDueAt },
    })
  }

  // Assign tags
  if (formData.tag_ids && formData.tag_ids.length > 0) {
    await supabase.from('ticket_tag_assignments').insert(
      formData.tag_ids.map(tagId => ({ ticket_id: ticket.id, tag_id: tagId }))
    )
  }

  logActivity({ supabase, user, entityType: 'ticket', entityId: ticket.id, action: 'created', details: { ticket_number: ticketNumber, subject: formData.subject } })

  // Fire-and-forget AI triage
  triageTicket(ticket.id, user.orgId, formData.tag_ids || [])
    .catch(err => console.error('[triage]', err))

  revalidatePath('/helpdesk')
  return { data: ticket }
}

export async function updateTicketField(id: string, field: string, value: unknown) {
  const user = await requirePermission('helpdesk', 'edit')
  const supabase = await createClient()

  const { error } = await supabase
    .from('tickets')
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'ticket', entityId: id, action: 'updated', details: { field, value } })
  revalidatePath(`/helpdesk/tickets/${id}`)
  revalidatePath('/helpdesk')
  return { success: true }
}

export async function changeTicketStatus(id: string, newStatus: TicketStatus) {
  const user = await requirePermission('helpdesk', 'edit')
  const supabase = await createClient()

  // Fetch current ticket
  const { data: ticket, error: fetchError } = await supabase
    .from('tickets')
    .select('*, sla_plans(*, sla_plan_targets(*))')
    .eq('id', id)
    .eq('org_id', user.orgId)
    .single()

  if (fetchError || !ticket) return { error: fetchError?.message || 'Ticket not found' }

  const updates: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  }

  const now = new Date()

  // Handle status-specific timestamp updates
  if (newStatus === 'resolved') {
    updates.resolved_at = now.toISOString()
    // Evaluate resolution SLA
    if (ticket.sla_resolution_due_at) {
      updates.sla_resolution_met = now <= new Date(ticket.sla_resolution_due_at)
      await supabase.from('sla_events').insert({
        ticket_id: id,
        event_type: updates.sla_resolution_met ? 'resolution_met' : 'resolution_breached',
        event_data: { resolved_at: now.toISOString(), due_at: ticket.sla_resolution_due_at },
      })
    }
  }

  if (newStatus === 'closed') {
    updates.closed_at = now.toISOString()
  }

  // Auto-close: set waiting_since when entering waiting_on_customer
  if (newStatus === 'waiting_on_customer' && ticket.status !== 'waiting_on_customer') {
    if (!ticket.waiting_since) {
      updates.waiting_since = now.toISOString()
    }
    updates.auto_close_warning_sent_at = null
    updates.auto_nudge_sent_at = null
  }

  // Auto-close: clear waiting_since when leaving waiting_on_customer
  if (ticket.status === 'waiting_on_customer' && newStatus !== 'waiting_on_customer') {
    updates.waiting_since = null
    updates.auto_close_warning_sent_at = null
    updates.auto_nudge_sent_at = null
  }

  // SLA pause when waiting on customer
  if (newStatus === 'waiting_on_customer' && !ticket.sla_paused_at) {
    updates.sla_paused_at = now.toISOString()
    await supabase.from('sla_events').insert({
      ticket_id: id,
      event_type: 'paused',
    })
  }

  // SLA resume when coming back from waiting_on_customer
  if (ticket.status === 'waiting_on_customer' && newStatus !== 'waiting_on_customer' && ticket.sla_paused_at) {
    const pausedAt = new Date(ticket.sla_paused_at)
    const pausedMinutes = Math.floor((now.getTime() - pausedAt.getTime()) / 60_000)
    updates.sla_paused_minutes = (ticket.sla_paused_minutes || 0) + pausedMinutes
    updates.sla_paused_at = null

    // Extend SLA deadlines by paused duration
    if (ticket.sla_response_due_at && !ticket.first_responded_at) {
      updates.sla_response_due_at = new Date(new Date(ticket.sla_response_due_at).getTime() + pausedMinutes * 60_000).toISOString()
    }
    if (ticket.sla_resolution_due_at && !ticket.resolved_at) {
      updates.sla_resolution_due_at = new Date(new Date(ticket.sla_resolution_due_at).getTime() + pausedMinutes * 60_000).toISOString()
    }

    await supabase.from('sla_events').insert({
      ticket_id: id,
      event_type: 'resumed',
      event_data: { paused_minutes: pausedMinutes },
    })
  }

  // Reopening a resolved ticket
  if (ticket.status === 'resolved' && newStatus === 'open') {
    updates.resolved_at = null
    updates.sla_resolution_met = null
  }

  const { error } = await supabase
    .from('tickets')
    .update(updates)
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  // Create system message for status change
  await supabase.from('ticket_messages').insert({
    ticket_id: id,
    sender_type: 'system',
    sender_id: user.id,
    sender_name: `${user.firstName} ${user.lastName}`,
    body: `Status changed from ${ticket.status.replace(/_/g, ' ')} to ${newStatus.replace(/_/g, ' ')}`,
    is_internal: false,
  })

  logActivity({ supabase, user, entityType: 'ticket', entityId: id, action: 'status_changed', details: { from: ticket.status, to: newStatus } })

  // Notify watchers/assignee
  notifyTicketStakeholders({
    supabase,
    orgId: user.orgId,
    ticketId: id,
    ticketNumber: ticket.ticket_number,
    subject: ticket.subject,
    actorId: user.id,
    type: 'ticket_status_changed',
    title: 'Status changed',
    message: `${ticket.ticket_number} moved to ${newStatus.replace(/_/g, ' ')} by ${user.firstName} ${user.lastName}`,
  })

  revalidatePath(`/helpdesk/tickets/${id}`)
  revalidatePath('/helpdesk')
  return { success: true }
}

export async function silentCloseTicket(id: string) {
  const user = await requirePermission('helpdesk', 'edit')
  const supabase = await createClient()

  const { data: ticket, error: fetchError } = await supabase
    .from('tickets')
    .select('*, sla_plans(*, sla_plan_targets(*))')
    .eq('id', id)
    .eq('org_id', user.orgId)
    .single()

  if (fetchError || !ticket) return { error: fetchError?.message || 'Ticket not found' }

  // Cannot silent-close a cancelled ticket
  if (ticket.status === 'cancelled') return { error: 'Cannot close a cancelled ticket' }

  const now = new Date()
  const updates: Record<string, unknown> = {
    status: 'closed',
    closed_at: now.toISOString(),
    updated_at: now.toISOString(),
  }

  // If not already resolved, set resolved_at and evaluate resolution SLA
  if (!ticket.resolved_at) {
    updates.resolved_at = now.toISOString()
    if (ticket.sla_resolution_due_at) {
      updates.sla_resolution_met = now <= new Date(ticket.sla_resolution_due_at)
      await supabase.from('sla_events').insert({
        ticket_id: id,
        event_type: updates.sla_resolution_met ? 'resolution_met' : 'resolution_breached',
        event_data: { resolved_at: now.toISOString(), due_at: ticket.sla_resolution_due_at },
      })
    }
  }

  // Handle SLA resume if paused
  if (ticket.sla_paused_at) {
    const pausedAt = new Date(ticket.sla_paused_at)
    const pausedMinutes = Math.floor((now.getTime() - pausedAt.getTime()) / 60_000)
    updates.sla_paused_minutes = (ticket.sla_paused_minutes || 0) + pausedMinutes
    updates.sla_paused_at = null
  }

  const { error } = await supabase
    .from('tickets')
    .update(updates)
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  // No system message, no notification — that's the point of silent close
  logActivity({ supabase, user, entityType: 'ticket', entityId: id, action: 'silent_closed', details: { from: ticket.status } })
  revalidatePath(`/helpdesk/tickets/${id}`)
  revalidatePath('/helpdesk')
  return { success: true }
}

export async function addMessage(ticketId: string, formData: {
  body: string
  is_internal?: boolean
}) {
  const user = await requirePermission('helpdesk', 'create')
  const supabase = await createClient()

  // For outbound (non-internal) replies, append magic link footer
  let body = formData.body
  if (!formData.is_internal) {
    const { data: tokenRow } = await supabase
      .from('tickets')
      .select('portal_token')
      .eq('id', ticketId)
      .single()

    if (tokenRow?.portal_token) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
      body = `${body}\n\n---\nView and reply to this ticket: ${siteUrl}/t/${tokenRow.portal_token}`
    }
  }

  const { data: message, error } = await supabase
    .from('ticket_messages')
    .insert({
      ticket_id: ticketId,
      sender_type: 'agent',
      sender_id: user.id,
      sender_name: `${user.firstName} ${user.lastName}`,
      body,
      is_internal: formData.is_internal ?? false,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Track SLA response + auto-set waiting_on_customer on non-internal replies
  if (!formData.is_internal) {
    const { data: ticket } = await supabase
      .from('tickets')
      .select('id, status, created_at, first_responded_at, sla_response_due_at')
      .eq('id', ticketId)
      .single()

    if (ticket) {
      const now = new Date()
      const updates: Record<string, unknown> = {
        updated_at: now.toISOString(),
      }

      // SLA first response tracking
      if (!ticket.first_responded_at) {
        updates.first_responded_at = now.toISOString()
        const responseMinutes = ticket.created_at ? Math.round((now.getTime() - new Date(ticket.created_at).getTime()) / 60000) : null
        logActivity({ supabase, user, entityType: 'ticket', entityId: ticketId, action: 'first_response', details: { response_minutes: responseMinutes, agent_id: user.id } })

        if (ticket.sla_response_due_at) {
          updates.sla_response_met = now <= new Date(ticket.sla_response_due_at)
          await supabase.from('sla_events').insert({
            ticket_id: ticketId,
            event_type: updates.sla_response_met ? 'response_met' : 'response_breached',
            event_data: { responded_at: now.toISOString(), due_at: ticket.sla_response_due_at },
          })
        }
      }

      // Auto-set waiting_on_customer and start auto-close countdown
      if (['new', 'open', 'in_progress', 'waiting_on_customer'].includes(ticket.status)) {
        updates.status = 'waiting_on_customer'
        updates.waiting_since = now.toISOString()
        updates.auto_close_warning_sent_at = null
        updates.auto_nudge_sent_at = null
      }

      await supabase.from('tickets').update(updates).eq('id', ticketId)
    }
  }

  logActivity({ supabase, user, entityType: 'ticket', entityId: ticketId, action: 'message_added', details: { is_internal: formData.is_internal } })

  // Notify watchers/assignee about new reply
  {
    const { data: tkt } = await supabase
      .from('tickets')
      .select('ticket_number, subject')
      .eq('id', ticketId)
      .single()

    if (tkt) {
      notifyTicketStakeholders({
        supabase,
        orgId: user.orgId,
        ticketId,
        ticketNumber: tkt.ticket_number,
        subject: tkt.subject,
        actorId: user.id,
        type: formData.is_internal ? 'ticket_internal_note' : 'ticket_reply',
        title: formData.is_internal ? 'Internal note added' : 'Reply added',
        message: `${user.firstName} ${user.lastName} ${formData.is_internal ? 'added an internal note on' : 'replied to'} ${tkt.ticket_number}`,
      })
    }
  }

  // Fire-and-forget: send email reply if ticket has email context and reply is non-internal
  if (!formData.is_internal) {
    sendEmailReplyIfNeeded(ticketId, body, user.id, user.orgId).catch(err =>
      console.error('[email-reply]', err)
    )
  }

  revalidatePath(`/helpdesk/tickets/${ticketId}`)
  return { data: message }
}

async function sendEmailReplyIfNeeded(ticketId: string, body: string, userId: string, orgId: string) {
  try {
    // Use admin client to bypass RLS on mail_channels/mail_connections
    const adminSupabase = createAdminClient()
    const { getTicketEmailContext, sendTicketReply } = await import('@/lib/email/email-sender')

    // Check if this ticket has email context (originated from email)
    const emailContext = await getTicketEmailContext(adminSupabase, ticketId)
    if (!emailContext) return // Not an email ticket — nothing to send

    // Get ticket number
    const { data: ticket } = await adminSupabase
      .from('tickets')
      .select('ticket_number')
      .eq('id', ticketId)
      .single()

    if (!ticket) return

    const result = await sendTicketReply(adminSupabase, {
      orgId,
      ticketId,
      ticketNumber: ticket.ticket_number,
      channelId: emailContext.channelId,
      fromAddress: emailContext.fromAddress,
      toAddress: emailContext.toAddress,
      toName: emailContext.toName || undefined,
      subject: emailContext.subject,
      bodyHtml: `<p>${body.replace(/\n/g, '<br>')}</p>`,
      bodyText: body,
      userId,
    })

    if (!result.success) {
      console.error('[email-reply] Send failed:', result.error)
    }
  } catch (err) {
    // Non-blocking — email failure should never prevent reply from being saved
    console.error('[email-reply] Error:', err instanceof Error ? err.message : err)
  }
}

export async function assignTicket(id: string, userId: string | null) {
  const user = await requirePermission('helpdesk', 'edit')
  const supabase = await createClient()

  const { error } = await supabase
    .from('tickets')
    .update({ assigned_to: userId, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  // Determine assignee name for system message
  let assigneeName = 'Unassigned'
  if (userId) {
    const { data: assignee } = await supabase
      .from('users')
      .select('first_name, last_name')
      .eq('id', userId)
      .single()
    if (assignee) assigneeName = `${assignee.first_name} ${assignee.last_name}`
  }

  await supabase.from('ticket_messages').insert({
    ticket_id: id,
    sender_type: 'system',
    sender_id: user.id,
    sender_name: `${user.firstName} ${user.lastName}`,
    body: userId ? `Assigned to ${assigneeName}` : 'Unassigned',
    is_internal: false,
  })

  logActivity({ supabase, user, entityType: 'ticket', entityId: id, action: 'assigned', details: { assigned_to: userId } })

  // Notify watchers/assignee — fetch ticket number for notification
  const { data: tkt } = await supabase
    .from('tickets')
    .select('ticket_number, subject')
    .eq('id', id)
    .single()

  if (tkt) {
    notifyTicketStakeholders({
      supabase,
      orgId: user.orgId,
      ticketId: id,
      ticketNumber: tkt.ticket_number,
      subject: tkt.subject,
      actorId: user.id,
      type: 'ticket_assigned',
      title: 'Assigned',
      message: `${tkt.ticket_number} assigned to ${assigneeName} by ${user.firstName} ${user.lastName}`,
    })
  }

  revalidatePath(`/helpdesk/tickets/${id}`)
  revalidatePath('/helpdesk')
  return { success: true }
}

export async function logTime(ticketId: string, formData: {
  minutes: number
  description?: string
  is_billable?: boolean
  entry_date?: string
}) {
  const user = await requirePermission('helpdesk', 'edit')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ticket_time_entries')
    .insert({
      ticket_id: ticketId,
      user_id: user.id,
      minutes: formData.minutes,
      description: formData.description || null,
      is_billable: formData.is_billable ?? true,
      entry_date: formData.entry_date || new Date().toISOString().split('T')[0],
    })
    .select()
    .single()

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'ticket', entityId: ticketId, action: 'time_logged', details: { minutes: formData.minutes } })
  revalidatePath(`/helpdesk/tickets/${ticketId}`)
  return { data }
}

export async function escalateTicket(ticketId: string, formData: {
  reason: string
  assign_to?: string
  department_id?: string
}) {
  const user = await requirePermission('helpdesk', 'edit')
  const supabase = await createClient()

  const { data: ticket } = await supabase
    .from('tickets')
    .select('escalation_level, priority, ticket_number')
    .eq('id', ticketId)
    .single()

  const currentLevel = ticket?.escalation_level || 0
  const currentPriority = ticket?.priority || 'medium'
  const priorityLevels = ['low', 'medium', 'high', 'urgent']

  let newLevel = currentLevel + 1
  let newPriority = currentPriority
  let systemMessage = ''
  let deptName: string | null = null

  if (formData.department_id) {
    // Fetch department details
    const { data: dept } = await supabase
      .from('departments')
      .select('id, name, escalation_type, priority_uplift')
      .eq('id', formData.department_id)
      .single()

    if (dept) {
      deptName = dept.name

      if (dept.escalation_type === 'sideways') {
        // Sideways: no level increment, no priority change
        newLevel = currentLevel
        systemMessage = `Escalated to ${dept.name}: ${formData.reason}`
      } else {
        // Upward: increment level + apply priority uplift
        newLevel = currentLevel + 1
        const currentIdx = priorityLevels.indexOf(currentPriority)
        const newIdx = Math.min(currentIdx + (dept.priority_uplift || 0), priorityLevels.length - 1)
        newPriority = priorityLevels[newIdx]
        systemMessage = `Escalated to L${newLevel} (${dept.name}): ${formData.reason}`
      }
    }
  } else {
    systemMessage = `Escalated to level ${newLevel}: ${formData.reason}`
  }

  const updates: Record<string, unknown> = {
    status: 'escalated',
    escalation_level: newLevel,
    priority: newPriority,
    escalated_at: new Date().toISOString(),
    escalated_by: user.id,
    updated_at: new Date().toISOString(),
  }

  if (formData.department_id) {
    updates.department_id = formData.department_id
  }

  if (formData.assign_to) {
    updates.assigned_to = formData.assign_to
  }

  const { error } = await supabase
    .from('tickets')
    .update(updates)
    .eq('id', ticketId)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  // System message
  await supabase.from('ticket_messages').insert({
    ticket_id: ticketId,
    sender_type: 'system',
    sender_id: user.id,
    sender_name: `${user.firstName} ${user.lastName}`,
    body: systemMessage,
    is_internal: false,
  })

  // Notify department members
  if (formData.department_id && deptName) {
    const { data: members } = await supabase
      .from('department_members')
      .select('user_id')
      .eq('department_id', formData.department_id)

    if (members && members.length > 0) {
      createNotifications(
        members
          .map(m => ({
            supabase,
            orgId: user.orgId,
            userId: m.user_id,
            type: 'ticket_escalated',
            title: `Ticket escalated to ${deptName}`,
            message: `${ticket?.ticket_number || ticketId}: ${formData.reason}`,
            link: `/helpdesk/tickets/${ticketId}`,
            entityType: 'ticket',
            entityId: ticketId,
          }))
      )
    }
  }

  logActivity({ supabase, user, entityType: 'ticket', entityId: ticketId, action: 'escalated', details: { level: newLevel, department: deptName, reason: formData.reason } })
  revalidatePath(`/helpdesk/tickets/${ticketId}`)
  revalidatePath('/helpdesk')
  return { success: true }
}

export async function addWatcher(ticketId: string, userId: string) {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  const { error } = await supabase
    .from('ticket_watchers')
    .insert({ ticket_id: ticketId, user_id: userId })

  if (error) return { error: error.message }
  revalidatePath(`/helpdesk/tickets/${ticketId}`)
  return { success: true }
}

export async function removeWatcher(ticketId: string, userId: string) {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  const { error } = await supabase
    .from('ticket_watchers')
    .delete()
    .eq('ticket_id', ticketId)
    .eq('user_id', userId)

  if (error) return { error: error.message }
  revalidatePath(`/helpdesk/tickets/${ticketId}`)
  return { success: true }
}

export async function addTag(ticketId: string, tagId: string) {
  const user = await requirePermission('helpdesk', 'edit')
  const supabase = await createClient()

  const { error } = await supabase
    .from('ticket_tag_assignments')
    .insert({ ticket_id: ticketId, tag_id: tagId })

  if (error) return { error: error.message }
  revalidatePath(`/helpdesk/tickets/${ticketId}`)
  return { success: true }
}

export async function removeTag(ticketId: string, tagId: string) {
  const user = await requirePermission('helpdesk', 'edit')
  const supabase = await createClient()

  const { error } = await supabase
    .from('ticket_tag_assignments')
    .delete()
    .eq('ticket_id', ticketId)
    .eq('tag_id', tagId)

  if (error) return { error: error.message }
  revalidatePath(`/helpdesk/tickets/${ticketId}`)
  return { success: true }
}

// ============================================================================
// SIDEBAR BADGE
// ============================================================================

export async function getNewTicketCount(): Promise<number> {
  try {
    const user = await requirePermission('helpdesk', 'view')
    const supabase = await createClient()

    const { count } = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', user.orgId)
      .eq('status', 'new')

    return count || 0
  } catch {
    return 0
  }
}

// ============================================================================
// LOOKUP HELPERS (for forms)
// ============================================================================

export async function getTeamMembers() {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  const { data } = await supabase
    .from('users')
    .select('id, first_name, last_name, initials, color, roles(name)')
    .eq('org_id', user.orgId)
    .eq('is_active', true)
    .order('first_name')

  return data || []
}

export async function getCustomersForSelect() {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  const { data } = await supabase
    .from('customers')
    .select('id, name')
    .eq('org_id', user.orgId)
    .eq('is_active', true)
    .order('name')

  return data || []
}

export async function getContactsForCustomer(customerId: string) {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  // Direct contacts
  const { data: direct } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email, phone')
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .order('first_name')

  // Linked contacts (from other companies)
  const { data: links } = await supabase
    .from('contact_customer_links')
    .select('contacts(id, first_name, last_name, email, phone, is_active)')
    .eq('customer_id', customerId)

  const linked = (links || [])
    .map((l) => l.contacts as unknown as { id: string; first_name: string; last_name: string; email: string | null; phone: string | null; is_active: boolean } | null)
    .filter((c): c is NonNullable<typeof c> => c != null && c.is_active)
    .filter((c) => !(direct || []).some((d) => d.id === c.id))

  return [...(direct || []), ...linked.map(({ is_active: _, ...c }) => c)]
}

export async function getBrandsForSelect() {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  const { data } = await supabase
    .from('brands')
    .select('id, name')
    .eq('org_id', user.orgId)
    .eq('is_active', true)
    .order('sort_order')

  return data || []
}

// ============================================================================
// KB CATEGORY CRUD (admin)
// ============================================================================

export async function getKbCategories() {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('kb_categories')
    .select('*')
    .eq('org_id', user.orgId)
    .order('sort_order')

  if (error) return { error: error.message, data: null }
  return { error: null, data }
}

export async function createKbCategory(fields: { name: string; description?: string; icon?: string; is_public?: boolean }) {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('kb_categories')
    .insert({ org_id: user.orgId, ...fields })
    .select()
    .single()

  if (error) return { error: error.message, data: null }

  logActivity({ supabase, user, entityType: 'kb_category', entityId: data.id, action: 'created', details: { name: fields.name } })
  revalidatePath('/helpdesk/knowledge-base')
  return { error: null, data }
}

export async function updateKbCategory(id: string, fields: { name?: string; description?: string; icon?: string; is_active?: boolean; is_public?: boolean; sort_order?: number }) {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  const { error } = await supabase
    .from('kb_categories')
    .update(fields)
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'kb_category', entityId: id, action: 'updated', details: fields })
  revalidatePath('/helpdesk/knowledge-base')
  return { error: null }
}

export async function deleteKbCategory(id: string) {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  const { error } = await supabase
    .from('kb_categories')
    .delete()
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'kb_category', entityId: id, action: 'deleted' })
  revalidatePath('/helpdesk/knowledge-base')
  return { error: null }
}

// ============================================================================
// KB ARTICLE CRUD
// ============================================================================

export async function getKbArticles(filters?: { status?: string; category_id?: string; search?: string }) {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  let query = supabase
    .from('kb_articles')
    .select('*, category:category_id(id, name), author:author_id(id, first_name, last_name, initials, color)')
    .eq('org_id', user.orgId)
    .order('updated_at', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.category_id) {
    query = query.eq('category_id', filters.category_id)
  }
  if (filters?.search) {
    query = query.ilike('title', `%${filters.search}%`)
  }

  const { data, error } = await query
  if (error) return { error: error.message, data: null }
  return { error: null, data }
}

export async function getKbArticle(id: string) {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('kb_articles')
    .select('*, category:category_id(id, name), author:author_id(id, first_name, last_name)')
    .eq('id', id)
    .eq('org_id', user.orgId)
    .single()

  if (error) return { error: error.message, data: null }

  // Get ratings summary
  const { data: ratings } = await supabase
    .from('kb_article_ratings')
    .select('is_helpful')
    .eq('article_id', id)

  const totalRatings = ratings?.length || 0
  const helpfulCount = ratings?.filter(r => r.is_helpful).length || 0

  return {
    error: null,
    data: { ...data, totalRatings, helpfulCount },
  }
}

export async function createKbArticle(fields: {
  title: string
  slug: string
  body: string
  body_html?: string
  category_id?: string
  status?: string
  is_public?: boolean
  is_internal?: boolean
}) {
  const user = await requirePermission('helpdesk', 'create')
  const supabase = await createClient()

  const insertData: Record<string, unknown> = {
    org_id: user.orgId,
    author_id: user.id,
    title: fields.title,
    slug: fields.slug,
    body: fields.body,
    body_html: fields.body_html || null,
    category_id: fields.category_id || null,
    status: fields.status || 'draft',
    is_public: fields.is_public ?? true,
    is_internal: fields.is_internal ?? false,
  }

  if (fields.status === 'published') {
    insertData.published_at = new Date().toISOString()
    insertData.is_published = true
  }

  const { data, error } = await supabase
    .from('kb_articles')
    .insert(insertData)
    .select()
    .single()

  if (error) return { error: error.message, data: null }

  logActivity({ supabase, user, entityType: 'kb_article', entityId: data.id, action: 'created', details: { title: fields.title, category_id: fields.category_id } })
  revalidatePath('/helpdesk/knowledge-base')
  return { error: null, data }
}

export async function updateKbArticle(id: string, fields: {
  title?: string
  slug?: string
  body?: string
  body_html?: string
  category_id?: string
  status?: string
  is_public?: boolean
  is_internal?: boolean
}) {
  const user = await requirePermission('helpdesk', 'edit')
  const supabase = await createClient()

  const updateData: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() }

  // Handle publish transition
  if (fields.status === 'published') {
    // Check if it was previously non-published
    const { data: existing } = await supabase
      .from('kb_articles')
      .select('status, published_at')
      .eq('id', id)
      .single()

    if (existing && existing.status !== 'published' && !existing.published_at) {
      updateData.published_at = new Date().toISOString()
    }
    updateData.is_published = true
  } else if (fields.status) {
    updateData.is_published = false
  }

  if (fields.category_id === '') {
    updateData.category_id = null
  }

  const { error } = await supabase
    .from('kb_articles')
    .update(updateData)
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  const logAction = fields.status === 'published' ? 'published' : fields.status === 'archived' ? 'archived' : 'updated'
  logActivity({ supabase, user, entityType: 'kb_article', entityId: id, action: logAction, details: { changed_fields: Object.keys(fields) } })
  revalidatePath('/helpdesk/knowledge-base')
  revalidatePath(`/helpdesk/knowledge-base/${id}`)
  return { error: null }
}

export async function deleteKbArticle(id: string) {
  const user = await requirePermission('helpdesk', 'delete')
  const supabase = await createClient()

  const { error } = await supabase
    .from('kb_articles')
    .delete()
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'kb_article', entityId: id, action: 'deleted' })
  revalidatePath('/helpdesk/knowledge-base')
  return { error: null }
}

// ============================================================================
// DASHBOARD & REPORTING QUERIES
// ============================================================================

export async function getDashboardStats() {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  // Open tickets count with breakdown
  const { data: openTickets } = await supabase
    .from('tickets')
    .select('status, priority, assigned_to, sla_response_due_at, sla_resolution_due_at, first_responded_at, resolved_at, created_at')
    .eq('org_id', user.orgId)
    .not('status', 'in', '("closed","cancelled","resolved")')

  const open = openTickets || []
  const newCount = open.filter(t => t.status === 'new').length
  const inProgressCount = open.filter(t => t.status === 'in_progress').length
  const escalatedCount = open.filter(t => t.status === 'escalated').length
  const unassigned = open.filter(t => !t.assigned_to).length

  const now = Date.now()
  const slaOverdue = open.filter(t =>
    (t.sla_response_due_at && !t.first_responded_at && new Date(t.sla_response_due_at).getTime() < now) ||
    (t.sla_resolution_due_at && !t.resolved_at && new Date(t.sla_resolution_due_at).getTime() < now)
  ).length

  // 30-day stats
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recentResolved } = await supabase
    .from('tickets')
    .select('created_at, first_responded_at, resolved_at, sla_response_met, sla_resolution_met, paused_minutes')
    .eq('org_id', user.orgId)
    .gte('resolved_at', thirtyDaysAgo)

  const resolved = recentResolved || []
  let totalResponseMs = 0
  let responseCount = 0
  let totalResolutionMs = 0
  let resolutionCount = 0
  let slaMet = 0

  for (const t of resolved) {
    if (t.first_responded_at && t.created_at) {
      totalResponseMs += new Date(t.first_responded_at).getTime() - new Date(t.created_at).getTime()
      responseCount++
    }
    if (t.resolved_at && t.created_at) {
      const pausedMs = (t.paused_minutes || 0) * 60 * 1000
      totalResolutionMs += new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime() - pausedMs
      resolutionCount++
    }
    if (t.sla_response_met !== false && t.sla_resolution_met !== false) {
      slaMet++
    }
  }

  const avgResponseMs = responseCount > 0 ? totalResponseMs / responseCount : 0
  const avgResolutionMs = resolutionCount > 0 ? totalResolutionMs / resolutionCount : 0
  const slaCompliancePct = resolved.length > 0 ? Math.round((slaMet / resolved.length) * 100) : 100

  return {
    openCount: open.length,
    newCount,
    inProgressCount,
    escalatedCount,
    unassigned,
    slaOverdue,
    avgResponseMs,
    avgResolutionMs,
    slaCompliancePct,
  }
}

export async function getDashboardPanels() {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  // Tickets by priority (open)
  const { data: openTickets } = await supabase
    .from('tickets')
    .select('priority')
    .eq('org_id', user.orgId)
    .not('status', 'in', '("closed","cancelled","resolved")')

  const priorityCounts: Record<string, number> = { urgent: 0, high: 0, medium: 0, low: 0 }
  for (const t of openTickets || []) {
    if (t.priority && priorityCounts[t.priority] !== undefined) {
      priorityCounts[t.priority]++
    }
  }

  // Agent workload
  const { data: workload } = await supabase
    .from('v_agent_workload')
    .select('*')
    .eq('org_id', user.orgId)

  // Ticket volume trend (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recentTickets } = await supabase
    .from('tickets')
    .select('created_at')
    .eq('org_id', user.orgId)
    .gte('created_at', thirtyDaysAgo)
    .order('created_at')

  const dailyVolume: Record<string, number> = {}
  for (const t of recentTickets || []) {
    const day = t.created_at.substring(0, 10)
    dailyVolume[day] = (dailyVolume[day] || 0) + 1
  }

  // Overdue tickets
  const now = new Date().toISOString()
  const { data: overdueTickets } = await supabase
    .from('tickets')
    .select('id, ticket_number, subject, customer_id, customers(name), assigned_to, users!tickets_assigned_to_fkey(first_name, last_name), sla_response_due_at, sla_resolution_due_at, first_responded_at, resolved_at')
    .eq('org_id', user.orgId)
    .not('status', 'in', '("closed","cancelled","resolved")')
    .or(`and(sla_response_due_at.lt.${now},first_responded_at.is.null),and(sla_resolution_due_at.lt.${now},resolved_at.is.null)`)
    .limit(20)

  // Tickets by category
  const { data: catTickets } = await supabase
    .from('tickets')
    .select('category_id, ticket_categories(name)')
    .eq('org_id', user.orgId)
    .not('status', 'in', '("closed","cancelled","resolved")')

  const categoryCounts: Record<string, { name: string; count: number }> = {}
  for (const t of catTickets || []) {
    const catId = t.category_id || 'uncategorised'
    const catName = (t.ticket_categories as unknown as Record<string, unknown>)?.name as string || 'Uncategorised'
    if (!categoryCounts[catId]) categoryCounts[catId] = { name: catName, count: 0 }
    categoryCounts[catId].count++
  }

  // Recent activity
  const { data: activity } = await supabase
    .from('activity_log')
    .select('*, user:user_id(first_name, last_name, initials, color)')
    .eq('org_id', user.orgId)
    .like('entity_type', 'ticket%')
    .order('created_at', { ascending: false })
    .limit(20)

  return {
    priorityCounts,
    workload: workload || [],
    dailyVolume,
    overdueTickets: overdueTickets || [],
    categoryCounts: Object.values(categoryCounts).sort((a, b) => b.count - a.count),
    activity: activity || [],
  }
}

export async function getReportData(filters: {
  startDate: string
  endDate: string
  brandId?: string
  customerId?: string
}) {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  let baseQuery = supabase
    .from('tickets')
    .select('*, customers(name), assigned:assigned_to(id, first_name, last_name), ticket_categories(name)')
    .eq('org_id', user.orgId)
    .gte('created_at', filters.startDate)
    .lte('created_at', filters.endDate)

  if (filters.brandId) baseQuery = baseQuery.eq('brand_id', filters.brandId)
  if (filters.customerId) baseQuery = baseQuery.eq('customer_id', filters.customerId)

  const { data: tickets } = await baseQuery
  const allTickets = tickets || []

  // Volume summary
  const { data: resolvedInPeriod } = await supabase
    .from('tickets')
    .select('id')
    .eq('org_id', user.orgId)
    .gte('resolved_at', filters.startDate)
    .lte('resolved_at', filters.endDate)

  const { data: currentOpen } = await supabase
    .from('tickets')
    .select('id')
    .eq('org_id', user.orgId)
    .not('status', 'in', '("closed","cancelled","resolved")')

  // Contact analysis
  const contactIds = new Set(allTickets.map(t => t.contact_id).filter(Boolean))
  let returningContacts = 0
  for (const cid of contactIds) {
    const { count } = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('contact_id', cid)
      .lt('created_at', filters.startDate)
    if (count && count > 0) returningContacts++
  }

  // SLA performance by priority
  const slaByPriority: Record<string, { count: number; responseTotal: number; resolutionTotal: number; responseMet: number; resolutionMet: number }> = {}
  for (const t of allTickets) {
    const p = t.priority || 'medium'
    if (!slaByPriority[p]) slaByPriority[p] = { count: 0, responseTotal: 0, resolutionTotal: 0, responseMet: 0, resolutionMet: 0 }
    slaByPriority[p].count++
    if (t.first_responded_at) {
      slaByPriority[p].responseTotal += new Date(t.first_responded_at).getTime() - new Date(t.created_at).getTime()
    }
    if (t.resolved_at) {
      const pausedMs = (t.paused_minutes || 0) * 60 * 1000
      slaByPriority[p].resolutionTotal += new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime() - pausedMs
    }
    if (t.sla_response_met === true) slaByPriority[p].responseMet++
    if (t.sla_resolution_met === true) slaByPriority[p].resolutionMet++
  }

  // Agent performance
  const agentMap: Record<string, {
    name: string; assigned: number; resolved: number;
    responseTotal: number; responseCount: number;
    resolutionTotal: number; resolutionCount: number;
    slaMet: number; slaTotal: number
  }> = {}

  for (const t of allTickets) {
    const agent = t.assigned as Record<string, unknown> | null
    if (!agent) continue
    const aid = agent.id as string
    if (!agentMap[aid]) {
      agentMap[aid] = {
        name: `${agent.first_name} ${agent.last_name}`,
        assigned: 0, resolved: 0,
        responseTotal: 0, responseCount: 0,
        resolutionTotal: 0, resolutionCount: 0,
        slaMet: 0, slaTotal: 0,
      }
    }
    agentMap[aid].assigned++
    if (t.resolved_at) agentMap[aid].resolved++
    if (t.first_responded_at) {
      agentMap[aid].responseTotal += new Date(t.first_responded_at).getTime() - new Date(t.created_at).getTime()
      agentMap[aid].responseCount++
    }
    if (t.resolved_at) {
      const pausedMs = (t.paused_minutes || 0) * 60 * 1000
      agentMap[aid].resolutionTotal += new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime() - pausedMs
      agentMap[aid].resolutionCount++
    }
    agentMap[aid].slaTotal++
    if (t.sla_response_met !== false && t.sla_resolution_met !== false) agentMap[aid].slaMet++
  }

  // Time logged by agent in period
  const { data: timeEntries } = await supabase
    .from('ticket_time_entries')
    .select('user_id, minutes')
    .gte('entry_date', filters.startDate)
    .lte('entry_date', filters.endDate)

  const timeByAgent: Record<string, number> = {}
  for (const e of timeEntries || []) {
    timeByAgent[e.user_id] = (timeByAgent[e.user_id] || 0) + e.minutes
  }

  // Category breakdown
  const categoryMap: Record<string, { name: string; count: number; resolutionTotal: number; resolvedCount: number }> = {}
  for (const t of allTickets) {
    const catName = (t.ticket_categories as unknown as Record<string, unknown>)?.name as string || 'Uncategorised'
    const catId = t.category_id || 'none'
    if (!categoryMap[catId]) categoryMap[catId] = { name: catName, count: 0, resolutionTotal: 0, resolvedCount: 0 }
    categoryMap[catId].count++
    if (t.resolved_at) {
      const pausedMs = (t.paused_minutes || 0) * 60 * 1000
      categoryMap[catId].resolutionTotal += new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime() - pausedMs
      categoryMap[catId].resolvedCount++
    }
  }

  // Customer breakdown
  const customerMap: Record<string, { name: string; count: number; openCount: number; slaMet: number; slaTotal: number }> = {}
  for (const t of allTickets) {
    const cName = (t.customers as Record<string, unknown>)?.name as string || 'Unknown'
    const cid = t.customer_id
    if (!customerMap[cid]) customerMap[cid] = { name: cName, count: 0, openCount: 0, slaMet: 0, slaTotal: 0 }
    customerMap[cid].count++
    if (!['closed', 'cancelled', 'resolved'].includes(t.status)) customerMap[cid].openCount++
    customerMap[cid].slaTotal++
    if (t.sla_response_met !== false && t.sla_resolution_met !== false) customerMap[cid].slaMet++
  }

  return {
    volume: {
      created: allTickets.length,
      resolved: resolvedInPeriod?.length || 0,
      currentlyOpen: currentOpen?.length || 0,
      uniqueContacts: contactIds.size,
      returningContacts,
      newContacts: contactIds.size - returningContacts,
    },
    slaByPriority,
    agents: Object.entries(agentMap).map(([id, a]) => ({
      id,
      ...a,
      timeLogged: timeByAgent[id] || 0,
    })).sort((a, b) => b.resolved - a.resolved),
    categories: Object.values(categoryMap).sort((a, b) => b.count - a.count),
    customers: Object.values(customerMap).sort((a, b) => b.count - a.count),
  }
}

// ============================================================================
// ONSITE JOBS QUERIES
// ============================================================================

export async function getOnsiteJobs(filters?: { customerId?: string; status?: string; myOnly?: boolean; startDate?: string; endDate?: string }) {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  let query = supabase
    .from('tickets')
    .select('*, customers(name), contacts(first_name, last_name), assigned:assigned_to(first_name, last_name), ticket_messages(body, sender_type, is_internal, created_at)')
    .eq('org_id', user.orgId)
    .eq('ticket_type', 'onsite_job')
    .not('status', 'in', '("closed","cancelled")')
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .order('priority')

  if (filters?.customerId) query = query.eq('customer_id', filters.customerId)
  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.myOnly) query = query.eq('assigned_to', user.id)
  if (filters?.startDate) query = query.gte('scheduled_date', filters.startDate)
  if (filters?.endDate) query = query.lte('scheduled_date', filters.endDate)

  const { data, error } = await query
  if (error) return { error: error.message, data: null }
  return { error: null, data }
}

// ============================================================================
// COMPANY DETAIL: SUPPORT TICKETS
// ============================================================================

export async function getCompanyTickets(companyId: string) {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, ticket_number, subject, status, priority, assigned_to, users!tickets_assigned_to_fkey(first_name, last_name, initials, color), updated_at')
    .eq('org_id', user.orgId)
    .eq('customer_id', companyId)
    .order('updated_at', { ascending: false })
    .limit(10)

  const { count: activeCount } = await supabase
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', user.orgId)
    .eq('customer_id', companyId)
    .not('status', 'in', '("closed","cancelled","resolved")')

  const { data: contract } = await supabase
    .from('customer_contracts')
    .select('*, sla_plans(name), contract_types(name, includes_remote_support, includes_telephone, includes_onsite)')
    .eq('customer_id', companyId)
    .eq('status', 'active')
    .not('sla_plan_id', 'is', null)
    .limit(1)
    .maybeSingle()

  // Time usage this month for contract
  let timeUsedThisMonth = 0
  if (contract) {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { data: timeEntries } = await supabase
      .from('ticket_time_entries')
      .select('minutes, tickets!inner(customer_id)')
      .eq('tickets.customer_id', companyId)
      .eq('is_billable', true)
      .gte('entry_date', startOfMonth.toISOString())

    for (const e of timeEntries || []) {
      timeUsedThisMonth += e.minutes
    }
  }

  return {
    tickets: tickets || [],
    activeCount: activeCount || 0,
    contract,
    timeUsedThisMonth,
  }
}

// ============================================================================
// AUTOMATION MACROS
// ============================================================================

export async function getMacros() {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('automation_macros')
    .select('*')
    .eq('org_id', user.orgId)
    .order('sort_order')
    .order('name')

  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function createMacro(formData: {
  name: string
  description?: string
  trigger_type: string
  trigger_conditions: Record<string, unknown>
  actions: Array<Record<string, unknown>>
}) {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('automation_macros')
    .insert({
      org_id: user.orgId,
      name: formData.name,
      description: formData.description || null,
      trigger_type: formData.trigger_type,
      trigger_conditions: formData.trigger_conditions,
      actions: formData.actions,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'automation_macro', entityId: data.id, action: 'created', details: { name: formData.name } })
  revalidatePath('/helpdesk/macros')
  return { data }
}

export async function updateMacro(id: string, formData: {
  name: string
  description?: string
  trigger_type: string
  trigger_conditions: Record<string, unknown>
  actions: Array<Record<string, unknown>>
}) {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  const { error } = await supabase
    .from('automation_macros')
    .update({
      name: formData.name,
      description: formData.description || null,
      trigger_type: formData.trigger_type,
      trigger_conditions: formData.trigger_conditions,
      actions: formData.actions,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'automation_macro', entityId: id, action: 'updated', details: { name: formData.name } })
  revalidatePath('/helpdesk/macros')
  return { success: true }
}

export async function deleteMacro(id: string) {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  const { error } = await supabase
    .from('automation_macros')
    .delete()
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'automation_macro', entityId: id, action: 'deleted', details: {} })
  revalidatePath('/helpdesk/macros')
  return { success: true }
}

export async function toggleMacroActive(id: string, isActive: boolean) {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  const { error } = await supabase
    .from('automation_macros')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  revalidatePath('/helpdesk/macros')
  return { success: true }
}

export async function updateTagAiAssignable(id: string, isAiAssignable: boolean) {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  const { error } = await supabase
    .from('ticket_tags')
    .update({ is_ai_assignable: isAiAssignable })
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'ticket_tag', entityId: id, action: 'updated', details: { is_ai_assignable: isAiAssignable } })
  revalidatePath('/helpdesk/tags')
  return { success: true }
}

// ============================================================================
// HELEN AI — DRAFT RESPONSES
// ============================================================================

// ============================================================================
// TICKET TAG MAP (bulk fetch for queue)
// ============================================================================

export async function getTicketTagMap() {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  // Fetch all tag assignments with tag details for active tickets
  const { data, error } = await supabase
    .from('ticket_tag_assignments')
    .select('ticket_id, tag_id, ticket_tags(id, name, color)')

  if (error) return { data: {} as Record<string, { id: string; name: string; color: string }[]> }

  // Build map: ticket_id → tag[]
  const map: Record<string, { id: string; name: string; color: string }[]> = {}
  for (const row of data || []) {
    const tag = row.ticket_tags as unknown as { id: string; name: string; color: string } | null
    if (!tag) continue
    if (!map[row.ticket_id]) map[row.ticket_id] = []
    map[row.ticket_id].push({ id: tag.id, name: tag.name, color: tag.color })
  }

  return { data: map }
}

// ============================================================================
// HELEN AI — DRAFT RESPONSES
// ============================================================================

export async function getDraftResponses(ticketId: string) {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('helen_draft_responses')
    .select('id, ticket_id, draft_type, body, status, ai_reasoning, created_at')
    .eq('ticket_id', ticketId)
    .eq('org_id', user.orgId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function getPendingDraftsForQueue() {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('helen_draft_responses')
    .select('id, ticket_id, draft_type, body, ai_reasoning')
    .eq('org_id', user.orgId)
    .eq('status', 'pending')

  if (error) return { data: [] }
  return { data: data || [] }
}

export async function approveDraftResponse(draftId: string, ticketId: string, editedBody?: string) {
  const user = await requirePermission('helpdesk', 'edit')
  const supabase = await createClient()

  // Fetch the draft
  const { data: draft, error: draftErr } = await supabase
    .from('helen_draft_responses')
    .select('*')
    .eq('id', draftId)
    .eq('org_id', user.orgId)
    .single()

  if (draftErr || !draft) return { error: draftErr?.message || 'Draft not found' }
  if (draft.status !== 'pending') return { error: 'Draft already processed' }

  const responseBody = editedBody || draft.body

  // Create real ticket message — Helen is the sender, agent just approved
  const { data: msg, error: msgErr } = await supabase
    .from('ticket_messages')
    .insert({
      ticket_id: ticketId,
      sender_type: 'agent',
      sender_id: null,
      sender_name: 'Helen (AI Assistant)',
      body: responseBody,
      is_internal: false,
    })
    .select('id')
    .single()

  if (msgErr || !msg) return { error: msgErr?.message || 'Failed to create message' }

  // Update draft status
  await supabase
    .from('helen_draft_responses')
    .update({
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      edited_body: editedBody || null,
      message_id: msg.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', draftId)

  // Track SLA first response if not yet recorded
  const { data: ticket } = await supabase
    .from('tickets')
    .select('first_responded_at, sla_plan_id')
    .eq('id', ticketId)
    .single()

  const ticketUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  // Set first response time for SLA tracking
  if (ticket && !ticket.first_responded_at) {
    ticketUpdates.first_responded_at = new Date().toISOString()

    // Record SLA response met event
    if (ticket.sla_plan_id) {
      await supabase.from('sla_events').insert({
        ticket_id: ticketId,
        event_type: 'response_met',
        event_data: { via: 'helen_draft_approved', approved_by: user.id },
      })
    }
  }

  // All approved drafts set waiting_on_customer + start auto-close countdown
  ticketUpdates.status = 'waiting_on_customer'
  ticketUpdates.waiting_since = new Date().toISOString()
  ticketUpdates.auto_close_warning_sent_at = null
  ticketUpdates.auto_nudge_sent_at = null

  await supabase
    .from('tickets')
    .update(ticketUpdates)
    .eq('id', ticketId)

  logActivity({ supabase, user, entityType: 'helen_draft', entityId: draftId, action: 'approved', details: { ticket_id: ticketId, edited: !!editedBody } })
  revalidatePath(`/helpdesk/tickets/${ticketId}`)
  revalidatePath('/helpdesk')
  return { success: true }
}

export async function rejectDraftResponse(draftId: string, ticketId: string) {
  const user = await requirePermission('helpdesk', 'edit')
  const supabase = await createClient()

  const { error } = await supabase
    .from('helen_draft_responses')
    .update({
      status: 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', draftId)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'helen_draft', entityId: draftId, action: 'rejected', details: { ticket_id: ticketId } })
  revalidatePath(`/helpdesk/tickets/${ticketId}`)
  return { success: true }
}

// ============================================================================
// DEPARTMENT CRUD
// ============================================================================

export async function getDepartments() {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  const { data: departments, error } = await supabase
    .from('departments')
    .select('*')
    .eq('org_id', user.orgId)
    .order('display_order')

  if (error) return { error: error.message }

  // Fetch members with user details for each department
  const deptIds = (departments || []).map(d => d.id)
  let members: { id: string; department_id: string; user_id: string; role: string; created_at: string; users: { id: string; first_name: string; last_name: string; initials: string | null; color: string | null } | null }[] = []

  if (deptIds.length > 0) {
    const { data: memberData } = await supabase
      .from('department_members')
      .select('*, users(id, first_name, last_name, initials, color)')
      .in('department_id', deptIds)

    members = (memberData || []) as typeof members
  }

  // Attach members to each department
  const result = (departments || []).map(dept => ({
    ...dept,
    members: members
      .filter(m => m.department_id === dept.id)
      .map(m => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        first_name: m.users?.first_name || '',
        last_name: m.users?.last_name || '',
        initials: m.users?.initials || null,
        color: m.users?.color || null,
      })),
  }))

  return { data: result }
}

export async function createDepartment(formData: {
  name: string
  description?: string
  escalation_type: 'sideways' | 'upward'
  priority_uplift?: number
  display_order?: number
}) {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('departments')
    .insert({
      org_id: user.orgId,
      name: formData.name,
      description: formData.description || null,
      escalation_type: formData.escalation_type,
      priority_uplift: formData.escalation_type === 'upward' ? (formData.priority_uplift ?? 1) : 0,
      display_order: formData.display_order ?? 0,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'department', entityId: data.id, action: 'created', details: { name: formData.name } })
  revalidatePath('/helpdesk/departments')
  return { data }
}

export async function updateDepartment(id: string, formData: {
  name?: string
  description?: string | null
  escalation_type?: 'sideways' | 'upward'
  priority_uplift?: number
  is_active?: boolean
  display_order?: number
}) {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  const updateData: Record<string, unknown> = { ...formData, updated_at: new Date().toISOString() }
  // If switching to sideways, reset priority_uplift
  if (formData.escalation_type === 'sideways') {
    updateData.priority_uplift = 0
  }

  const { error } = await supabase
    .from('departments')
    .update(updateData)
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'department', entityId: id, action: 'updated' })
  revalidatePath('/helpdesk/departments')
  return { success: true }
}

export async function deleteDepartment(id: string) {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  // Clear department_id on tickets referencing this department
  await supabase
    .from('tickets')
    .update({ department_id: null, updated_at: new Date().toISOString() })
    .eq('department_id', id)
    .eq('org_id', user.orgId)

  const { error } = await supabase
    .from('departments')
    .delete()
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'department', entityId: id, action: 'deleted' })
  revalidatePath('/helpdesk/departments')
  return { success: true }
}

export async function addDepartmentMember(departmentId: string, userId: string, role: DepartmentMemberRole = 'member') {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  const { error } = await supabase
    .from('department_members')
    .insert({ department_id: departmentId, user_id: userId, role })

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'department_member', entityId: departmentId, action: 'member_added', details: { user_id: userId, role } })
  revalidatePath('/helpdesk/departments')
  return { success: true }
}

export async function removeDepartmentMember(departmentId: string, userId: string) {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  const { error } = await supabase
    .from('department_members')
    .delete()
    .eq('department_id', departmentId)
    .eq('user_id', userId)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'department_member', entityId: departmentId, action: 'member_removed', details: { user_id: userId } })
  revalidatePath('/helpdesk/departments')
  return { success: true }
}

export async function updateMemberRole(departmentId: string, userId: string, role: DepartmentMemberRole) {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  const { error } = await supabase
    .from('department_members')
    .update({ role })
    .eq('department_id', departmentId)
    .eq('user_id', userId)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'department_member', entityId: departmentId, action: 'role_updated', details: { user_id: userId, role } })
  revalidatePath('/helpdesk/departments')
  return { success: true }
}

// ============================================================================
// TICKET ATTACHMENTS
// ============================================================================

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

export async function uploadAttachment(ticketId: string, formData: FormData) {
  const user = await requirePermission('helpdesk', 'create')
  const supabase = await createClient()

  const files = formData.getAll('files') as File[]
  if (!files.length) return { error: 'No files provided' }

  // Validate all files before uploading
  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return { error: `File type not allowed: ${file.name}` }
    }
    if (file.size > MAX_FILE_SIZE) {
      return { error: `File too large (max 20MB): ${file.name}` }
    }
  }

  const uploaded: { id: string; file_name: string }[] = []

  for (const file of files) {
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${user.orgId}/${ticketId}/${timestamp}-${safeName}`

    const { error: uploadError } = await supabase.storage
      .from('ticket-attachments')
      .upload(storagePath, file)

    if (uploadError) {
      return { error: `Upload failed for ${file.name}: ${uploadError.message}` }
    }

    const { data: row, error: insertError } = await supabase
      .from('ticket_attachments')
      .insert({
        ticket_id: ticketId,
        file_name: file.name,
        file_path: storagePath,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user.id,
      })
      .select('id, file_name')
      .single()

    if (insertError) {
      return { error: `Failed to save record for ${file.name}: ${insertError.message}` }
    }

    uploaded.push(row)
  }

  logActivity({
    supabase,
    user,
    entityType: 'ticket',
    entityId: ticketId,
    action: 'attachment_uploaded',
    details: { files: uploaded.map(f => f.file_name) },
  })

  revalidatePath(`/helpdesk/tickets/${ticketId}`)
  return { data: uploaded }
}

// ============================================================================
// SCRATCHPAD NOTES
// ============================================================================

export async function getScratchpadNotes(ticketId: string) {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ticket_scratchpad_notes')
    .select('*, creator:created_by(id, first_name, last_name, initials, color)')
    .eq('ticket_id', ticketId)
    .eq('org_id', user.orgId)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function addScratchpadNote(
  ticketId: string,
  input: { title?: string; body: string; source: 'manual' | 'helen_assist'; assist_log_id?: string }
) {
  const user = await requirePermission('helpdesk', 'create')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ticket_scratchpad_notes')
    .insert({
      ticket_id: ticketId,
      org_id: user.orgId,
      created_by: user.id,
      source: input.source,
      assist_log_id: input.assist_log_id || null,
      title: input.title || null,
      body: input.body,
    })
    .select('*, creator:created_by(id, first_name, last_name, initials, color)')
    .single()

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'ticket',
    entityId: ticketId,
    action: 'scratchpad_note_added',
    details: { source: input.source, title: input.title || null },
  })

  revalidatePath(`/helpdesk/tickets/${ticketId}`)
  return { data }
}

export async function updateScratchpadNote(
  noteId: string,
  input: { title?: string; body?: string; is_pinned?: boolean }
) {
  const user = await requirePermission('helpdesk', 'edit')
  const supabase = await createClient()

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.title !== undefined) updateData.title = input.title || null
  if (input.body !== undefined) updateData.body = input.body
  if (input.is_pinned !== undefined) updateData.is_pinned = input.is_pinned

  const { data, error } = await supabase
    .from('ticket_scratchpad_notes')
    .update(updateData)
    .eq('id', noteId)
    .eq('org_id', user.orgId)
    .select('*, creator:created_by(id, first_name, last_name, initials, color)')
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/helpdesk/tickets/${data.ticket_id}`)
  return { data }
}

export async function deleteScratchpadNote(noteId: string) {
  const user = await requirePermission('helpdesk', 'edit')
  const supabase = await createClient()

  // Only creator can delete (RLS enforces this too, but double-check)
  const { data: note } = await supabase
    .from('ticket_scratchpad_notes')
    .select('id, ticket_id, created_by')
    .eq('id', noteId)
    .eq('org_id', user.orgId)
    .single()

  if (!note) return { error: 'Note not found' }
  if (note.created_by !== user.id) return { error: 'Only the creator can delete this note' }

  const { error } = await supabase
    .from('ticket_scratchpad_notes')
    .delete()
    .eq('id', noteId)

  if (error) return { error: error.message }

  revalidatePath(`/helpdesk/tickets/${note.ticket_id}`)
  return { success: true }
}

// ============================================================================
// HELEN ASSIST HISTORY (per-ticket)
// ============================================================================

export async function getAssistHistory(ticketId: string) {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('helen_assist_log')
    .select('id, ticket_id, user_id, model, input_tokens, output_tokens, response_body, created_at')
    .eq('ticket_id', ticketId)
    .eq('org_id', user.orgId)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return { data: data || [] }
}

// ============================================================================
// HELEN ASSIST USAGE (reporting)
// ============================================================================

export async function getHelenAssistUsage(filters?: {
  startDate?: string
  endDate?: string
  userId?: string
}) {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  let query = supabase
    .from('v_helen_assist_usage')
    .select('*')
    .eq('org_id', user.orgId)
    .order('created_at', { ascending: false })

  if (filters?.startDate) {
    query = query.gte('created_at', filters.startDate)
  }
  if (filters?.endDate) {
    query = query.lte('created_at', filters.endDate + 'T23:59:59.999Z')
  }
  if (filters?.userId) {
    query = query.eq('user_id', filters.userId)
  }

  const { data, error } = await query

  if (error) return { error: error.message }
  return { data: data || [] }
}

// ============================================================================
// TICKET PRESENCE
// ============================================================================

export interface PresenceViewer {
  id: string
  firstName: string
  lastName: string
  initials: string | null
  color: string | null
  avatarUrl: string | null
}

export async function heartbeatPresence(ticketId: string): Promise<{ viewers: PresenceViewer[] }> {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  // Upsert own heartbeat
  await supabase
    .from('ticket_presence')
    .upsert(
      { ticket_id: ticketId, user_id: user.id, last_heartbeat: new Date().toISOString() },
      { onConflict: 'ticket_id,user_id' }
    )

  // Garbage-collect stale rows (>5 min old)
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  await supabase
    .from('ticket_presence')
    .delete()
    .eq('ticket_id', ticketId)
    .lt('last_heartbeat', fiveMinAgo)

  // Fetch other active viewers (heartbeat within last 45s)
  const threshold = new Date(Date.now() - 45 * 1000).toISOString()
  const { data } = await supabase
    .from('ticket_presence')
    .select('user_id, users:user_id(id, first_name, last_name, initials, color, avatar_url)')
    .eq('ticket_id', ticketId)
    .gt('last_heartbeat', threshold)
    .neq('user_id', user.id)

  const viewers: PresenceViewer[] = (data || []).map((row: Record<string, unknown>) => {
    const u = row.users as Record<string, unknown>
    return {
      id: u.id as string,
      firstName: u.first_name as string,
      lastName: u.last_name as string,
      initials: (u.initials as string) || null,
      color: (u.color as string) || null,
      avatarUrl: (u.avatar_url as string) || null,
    }
  })

  return { viewers }
}

export async function clearPresence(ticketId: string): Promise<void> {
  try {
    const user = await requirePermission('helpdesk', 'view')
    const supabase = await createClient()
    await supabase
      .from('ticket_presence')
      .delete()
      .eq('ticket_id', ticketId)
      .eq('user_id', user.id)
  } catch {
    // Best-effort — staleness threshold handles cleanup
  }
}

export async function getQueuePresence(): Promise<Record<string, PresenceViewer[]>> {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  const threshold = new Date(Date.now() - 45 * 1000).toISOString()
  const { data } = await supabase
    .from('ticket_presence')
    .select('ticket_id, user_id, users:user_id(id, first_name, last_name, initials, color, avatar_url)')
    .gt('last_heartbeat', threshold)

  const map: Record<string, PresenceViewer[]> = {}
  for (const row of (data || []) as Record<string, unknown>[]) {
    const ticketId = row.ticket_id as string
    const u = row.users as Record<string, unknown>
    if (!u) continue
    const viewer: PresenceViewer = {
      id: u.id as string,
      firstName: u.first_name as string,
      lastName: u.last_name as string,
      initials: (u.initials as string) || null,
      color: (u.color as string) || null,
      avatarUrl: (u.avatar_url as string) || null,
    }
    if (!map[ticketId]) map[ticketId] = []
    map[ticketId].push(viewer)
  }
  return map
}

// ============================================================================
// TICKET MERGE
// ============================================================================

export async function mergeTickets(ticketId1: string, ticketId2: string) {
  const user = await requirePermission('helpdesk', 'edit')
  const supabase = await createClient()

  // Fetch both tickets
  const { data: tickets, error: fetchErr } = await supabase
    .from('tickets')
    .select('id, org_id, ticket_number, customer_id, status, priority, assigned_to, category_id, merged_into_ticket_id, closed_at, pre_merge_status')
    .in('id', [ticketId1, ticketId2])
    .eq('org_id', user.orgId)

  if (fetchErr || !tickets || tickets.length !== 2) {
    return { error: 'Could not find both tickets' }
  }

  const t1 = tickets.find(t => t.id === ticketId1)!
  const t2 = tickets.find(t => t.id === ticketId2)!

  // Validate same customer (and both must have a customer assigned)
  if (!t1.customer_id || !t2.customer_id) {
    return { error: 'Both tickets must have a customer assigned before merging' }
  }
  if (t1.customer_id !== t2.customer_id) {
    return { error: 'Tickets must belong to the same customer to merge' }
  }

  // Validate neither is already merged
  if (t1.merged_into_ticket_id) {
    return { error: `${t1.ticket_number} is already merged into another ticket` }
  }
  if (t2.merged_into_ticket_id) {
    return { error: `${t2.ticket_number} is already merged into another ticket` }
  }

  // Validate neither is cancelled
  if (t1.status === 'cancelled') {
    return { error: `${t1.ticket_number} is cancelled and cannot be merged` }
  }
  if (t2.status === 'cancelled') {
    return { error: `${t2.ticket_number} is cancelled and cannot be merged` }
  }

  // Auto-determine: newer ticket number = target (live), older = source (closed)
  const t1Num = parseInt(t1.ticket_number.replace(/\D/g, ''), 10)
  const t2Num = parseInt(t2.ticket_number.replace(/\D/g, ''), 10)
  const source = t1Num < t2Num ? t1 : t2
  const target = t1Num < t2Num ? t2 : t1

  const now = new Date().toISOString()
  const userName = `${user.firstName} ${user.lastName}`

  // Snapshot source ticket state for un-merge restoration
  const sourceSnapshot = {
    status: source.status,
    priority: source.priority,
    assigned_to: source.assigned_to,
    category_id: source.category_id,
    closed_at: source.closed_at,
  }

  // Insert merge record
  const { data: merge, error: mergeErr } = await supabase
    .from('ticket_merges')
    .insert({
      org_id: user.orgId,
      source_ticket_id: source.id,
      target_ticket_id: target.id,
      merged_by: user.id,
      source_snapshot: sourceSnapshot,
    })
    .select('id')
    .single()

  if (mergeErr) return { error: mergeErr.message }

  // Close source ticket
  await supabase
    .from('tickets')
    .update({
      merged_into_ticket_id: target.id,
      pre_merge_status: source.status,
      status: 'closed',
      closed_at: now,
      updated_at: now,
    })
    .eq('id', source.id)

  // Copy tags from source → target (skip duplicates)
  const { data: sourceTags } = await supabase
    .from('ticket_tag_assignments')
    .select('tag_id')
    .eq('ticket_id', source.id)

  if (sourceTags && sourceTags.length > 0) {
    const { data: targetTags } = await supabase
      .from('ticket_tag_assignments')
      .select('tag_id')
      .eq('ticket_id', target.id)

    const existingTagIds = new Set((targetTags || []).map(t => t.tag_id))
    const newTags = sourceTags
      .filter(t => !existingTagIds.has(t.tag_id))
      .map(t => ({ ticket_id: target.id, tag_id: t.tag_id }))

    if (newTags.length > 0) {
      await supabase.from('ticket_tag_assignments').insert(newTags)
    }
  }

  // Copy watchers from source → target (skip duplicates)
  const { data: sourceWatchers } = await supabase
    .from('ticket_watchers')
    .select('user_id')
    .eq('ticket_id', source.id)

  if (sourceWatchers && sourceWatchers.length > 0) {
    const { data: targetWatchers } = await supabase
      .from('ticket_watchers')
      .select('user_id')
      .eq('ticket_id', target.id)

    const existingWatcherIds = new Set((targetWatchers || []).map(w => w.user_id))
    const newWatchers = sourceWatchers
      .filter(w => !existingWatcherIds.has(w.user_id))
      .map(w => ({ ticket_id: target.id, user_id: w.user_id }))

    if (newWatchers.length > 0) {
      await supabase.from('ticket_watchers').insert(newWatchers)
    }
  }

  // System messages on both tickets
  await supabase.from('ticket_messages').insert([
    {
      ticket_id: source.id,
      sender_type: 'system',
      sender_id: user.id,
      sender_name: userName,
      body: `Ticket merged into ${target.ticket_number}`,
      is_internal: false,
    },
    {
      ticket_id: target.id,
      sender_type: 'system',
      sender_id: user.id,
      sender_name: userName,
      body: `${source.ticket_number} was merged into this ticket`,
      is_internal: false,
    },
  ])

  // Activity log on both tickets
  logActivity({ supabase, user, entityType: 'ticket', entityId: source.id, action: 'merged', details: { merged_into: target.ticket_number, target_id: target.id } })
  logActivity({ supabase, user, entityType: 'ticket', entityId: target.id, action: 'merge_received', details: { merged_from: source.ticket_number, source_id: source.id } })

  // Notify source ticket's assignee & watchers about the merge
  const notifyIds = new Set<string>()
  if (source.assigned_to && source.assigned_to !== user.id) notifyIds.add(source.assigned_to)
  if (sourceWatchers) {
    for (const w of sourceWatchers) {
      if (w.user_id !== user.id) notifyIds.add(w.user_id)
    }
  }

  if (notifyIds.size > 0) {
    createNotifications(
      Array.from(notifyIds).map(userId => ({
        supabase,
        orgId: user.orgId,
        userId,
        type: 'ticket_merged',
        title: 'Ticket Merged',
        message: `${source.ticket_number} was merged into ${target.ticket_number} by ${userName}`,
        link: `/helpdesk/tickets/${target.id}`,
        entityType: 'ticket',
        entityId: target.id,
      }))
    )
  }

  revalidatePath(`/helpdesk/tickets/${source.id}`)
  revalidatePath(`/helpdesk/tickets/${target.id}`)
  revalidatePath('/helpdesk')

  return { success: true, mergeId: merge.id, sourceTicketNumber: source.ticket_number, targetTicketId: target.id, targetTicketNumber: target.ticket_number }
}

export async function unmergeTicket(mergeId: string) {
  const user = await requirePermission('helpdesk', 'edit')
  const supabase = await createClient()

  // Fetch merge record
  const { data: merge, error: fetchErr } = await supabase
    .from('ticket_merges')
    .select('*, source:source_ticket_id(id, ticket_number), target:target_ticket_id(id, ticket_number)')
    .eq('id', mergeId)
    .eq('org_id', user.orgId)
    .is('unmerged_at', null)
    .single()

  if (fetchErr || !merge) {
    return { error: 'Merge record not found or already un-merged' }
  }

  const source = merge.source as unknown as { id: string; ticket_number: string }
  const target = merge.target as unknown as { id: string; ticket_number: string }
  const snapshot = merge.source_snapshot as Record<string, unknown>
  const now = new Date().toISOString()
  const userName = `${user.firstName} ${user.lastName}`

  // Restore source ticket
  await supabase
    .from('tickets')
    .update({
      merged_into_ticket_id: null,
      pre_merge_status: null,
      status: (snapshot.status as string) || 'open',
      closed_at: (snapshot.closed_at as string) || null,
      updated_at: now,
    })
    .eq('id', source.id)

  // Mark merge record as un-merged
  await supabase
    .from('ticket_merges')
    .update({ unmerged_at: now, unmerged_by: user.id })
    .eq('id', mergeId)

  // System messages on both tickets
  await supabase.from('ticket_messages').insert([
    {
      ticket_id: source.id,
      sender_type: 'system',
      sender_id: user.id,
      sender_name: userName,
      body: `Ticket un-merged from ${target.ticket_number}`,
      is_internal: false,
    },
    {
      ticket_id: target.id,
      sender_type: 'system',
      sender_id: user.id,
      sender_name: userName,
      body: `${source.ticket_number} was un-merged from this ticket`,
      is_internal: false,
    },
  ])

  logActivity({ supabase, user, entityType: 'ticket', entityId: source.id, action: 'unmerged', details: { unmerged_from: target.ticket_number } })
  logActivity({ supabase, user, entityType: 'ticket', entityId: target.id, action: 'unmerge_removed', details: { unmerged_ticket: source.ticket_number } })

  revalidatePath(`/helpdesk/tickets/${source.id}`)
  revalidatePath(`/helpdesk/tickets/${target.id}`)
  revalidatePath('/helpdesk')

  return { success: true }
}

export async function getMergedTickets(ticketId: string) {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ticket_merges')
    .select('id, source_ticket_id, merged_by, merged_at, source:source_ticket_id(id, ticket_number, subject, status), merger:merged_by(first_name, last_name)')
    .eq('target_ticket_id', ticketId)
    .eq('org_id', user.orgId)
    .is('unmerged_at', null)
    .order('merged_at', { ascending: false })

  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function getMergeableTickets(ticketId: string, customerId: string) {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tickets')
    .select('id, ticket_number, subject, status, priority, created_at')
    .eq('org_id', user.orgId)
    .eq('customer_id', customerId)
    .neq('id', ticketId)
    .is('merged_into_ticket_id', null)
    .not('status', 'in', '(cancelled)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function getMergeRecordForSource(sourceTicketId: string) {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ticket_merges')
    .select('id')
    .eq('source_ticket_id', sourceTicketId)
    .eq('org_id', user.orgId)
    .is('unmerged_at', null)
    .single()

  if (error || !data) return { data: null }
  return { data }
}

export async function getMergedMessages(ticketId: string) {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  // Get all active merges where this ticket is the target (including chained)
  const sourceIds: string[] = []
  const sourceTicketMap = new Map<string, string>() // ticket_id → ticket_number

  async function collectSources(targetId: string, depth: number) {
    if (depth > 5) return // prevent infinite loops
    const { data: merges } = await supabase
      .from('ticket_merges')
      .select('source_ticket_id, source:source_ticket_id(id, ticket_number)')
      .eq('target_ticket_id', targetId)
      .eq('org_id', user.orgId)
      .is('unmerged_at', null)

    if (!merges) return
    for (const m of merges) {
      const src = m.source as unknown as { id: string; ticket_number: string }
      sourceIds.push(src.id)
      sourceTicketMap.set(src.id, src.ticket_number)
      // Check if any tickets were merged into this source (chained merges)
      await collectSources(src.id, depth + 1)
    }
  }

  await collectSources(ticketId, 0)

  if (sourceIds.length === 0) return { data: [] }

  // Fetch messages from all source tickets
  const { data: messages, error } = await supabase
    .from('ticket_messages')
    .select('*, sender:sender_id(id, first_name, last_name, initials, color, avatar_url)')
    .in('ticket_id', sourceIds)
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }

  // Annotate each message with its origin ticket number
  const annotated = (messages || []).map(msg => ({
    ...msg,
    origin_ticket_number: sourceTicketMap.get(msg.ticket_id) || null,
  }))

  return { data: annotated }
}

// ============================================================================
// AUTO-CLOSE
// ============================================================================

export async function triggerAutoClose() {
  const user = await requirePermission('helpdesk', 'view')
  const adminClient = createAdminClient()
  // Fire-and-forget — don't await, let it run in background
  processAutoClose(adminClient, user.orgId).catch((err) => {
    console.error('Auto-close processing error:', err)
  })
}

// ============================================================================
// AUTOGRUMP™ SETTINGS
// ============================================================================

export async function getAutogrumpStats() {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  const { count } = await supabase
    .from('tickets')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', user.orgId)
    .not('status', 'in', '("closed","resolved")')
    .gte('tone_score', 3)

  return { flagged: count || 0 }
}

export async function clearAllToneScores() {
  const user = await requirePermission('helpdesk', 'admin')
  const adminClient = createAdminClient()

  // Count first
  const { count } = await adminClient
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', user.orgId)
    .not('tone_score', 'is', null)

  // Then clear
  await adminClient
    .from('tickets')
    .update({
      tone_score: null,
      tone_trend: null,
      tone_summary: null,
      tone_updated_at: null,
    })
    .eq('org_id', user.orgId)
    .not('tone_score', 'is', null)

  return { cleared: count || 0 }
}

export async function getFrustratedTicketStats() {
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  const { data } = await supabase
    .from('tickets')
    .select('tone_score, tone_trend')
    .eq('org_id', user.orgId)
    .not('status', 'in', '("closed","resolved")')
    .gte('tone_score', 4)

  const frustrated = data?.length || 0
  const escalating = data?.filter(t => t.tone_trend === 'escalating').length || 0

  return { frustrated, escalating }
}
