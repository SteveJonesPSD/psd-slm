'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { PortalContext, PortalTicket, PortalTicketMessage } from './types'

export async function getPortalTickets(
  ctx: PortalContext,
  filter?: 'open' | 'closed' | 'all'
): Promise<PortalTicket[]> {
  const supabase = createAdminClient()

  let query = supabase
    .from('tickets')
    .select(`
      id, ticket_number, subject, status, priority, created_at, updated_at,
      assigned:assigned_to(first_name)
    `)
    .eq('customer_id', ctx.customerId)
    .eq('org_id', ctx.orgId)
    .order('updated_at', { ascending: false })

  if (filter === 'open') {
    query = query.not('status', 'in', '("resolved","closed","cancelled")')
  } else if (filter === 'closed') {
    query = query.in('status', ['resolved', 'closed'])
  }

  const { data } = await query

  return (data || []).map((t) => {
    const assigned = t.assigned as unknown as { first_name: string } | null
    return {
      id: t.id,
      ticketNumber: t.ticket_number,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      assignedToName: assigned?.first_name || null,
    }
  })
}

export async function getPortalTicketDetail(
  ticketId: string,
  ctx: PortalContext
): Promise<{
  ticket: PortalTicket
  messages: PortalTicketMessage[]
} | null> {
  const supabase = createAdminClient()

  const { data: ticket } = await supabase
    .from('tickets')
    .select(`
      id, ticket_number, subject, status, priority, created_at, updated_at,
      assigned:assigned_to(first_name)
    `)
    .eq('id', ticketId)
    .eq('customer_id', ctx.customerId)
    .eq('org_id', ctx.orgId)
    .single()

  if (!ticket) return null

  // Fetch messages — EXCLUDE internal notes at query level
  const { data: messages } = await supabase
    .from('ticket_messages')
    .select('id, body, sender_type, sender_name, created_at')
    .eq('ticket_id', ticketId)
    .eq('is_internal', false)
    .order('created_at', { ascending: true })

  const assigned = ticket.assigned as unknown as { first_name: string } | null

  return {
    ticket: {
      id: ticket.id,
      ticketNumber: ticket.ticket_number,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at,
      assignedToName: assigned?.first_name || null,
    },
    messages: (messages || []).map((m) => ({
      id: m.id,
      content: m.body,
      isInternal: false as const,
      authorName: m.sender_type === 'agent' ? (m.sender_name?.split(' ')[0] || 'Agent') : (m.sender_name || 'Customer'),
      authorType: m.sender_type === 'customer' ? 'customer' as const : 'agent' as const,
      createdAt: m.created_at,
    })),
  }
}

export async function addPortalMessage(
  ticketId: string,
  content: string,
  ctx: PortalContext
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()

  // Verify ownership
  const { data: ticket } = await supabase
    .from('tickets')
    .select('id, status, customer_id, org_id')
    .eq('id', ticketId)
    .eq('customer_id', ctx.customerId)
    .single()

  if (!ticket) return { error: 'Ticket not found' }

  await supabase.from('ticket_messages').insert({
    ticket_id: ticketId,
    body: content,
    sender_type: 'customer',
    is_internal: false,
    contact_id: ctx.contactId,
    sender_name: ctx.displayName,
    channel: 'portal',
  })

  // If resolved, reopen
  if (ticket.status === 'resolved') {
    await supabase
      .from('tickets')
      .update({ status: 'open', resolved_at: null, updated_at: new Date().toISOString() })
      .eq('id', ticketId)
  } else {
    await supabase
      .from('tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', ticketId)
  }

  // Fire-and-forget: activity log
  supabase
    .from('activity_log')
    .insert({
      org_id: ctx.orgId,
      entity_type: 'ticket',
      entity_id: ticketId,
      action: 'portal_reply',
      actor_type: 'portal_user',
      portal_user_id: ctx.portalUserId,
    })
    .then(() => {})

  // Fire-and-forget: AutoGRUMP tone analysis
  import('@/lib/helpdesk/tone-analysis').then(({ analyseCustomerTone }) => {
    analyseCustomerTone(ticketId).catch((err: Error) => {
      console.error('AutoGRUMP analysis failed:', err)
    })
  })

  return { error: null }
}

export async function createPortalTicket(
  subject: string,
  description: string,
  categoryId: string | null,
  ctx: PortalContext
): Promise<{ ticketId: string | null; error: string | null }> {
  const supabase = createAdminClient()

  // Generate ticket number
  const year = new Date().getFullYear()
  const prefix = `TKT-${year}-`
  const { data: lastTicket } = await supabase
    .from('tickets')
    .select('ticket_number')
    .eq('org_id', ctx.orgId)
    .like('ticket_number', `${prefix}%`)
    .order('ticket_number', { ascending: false })
    .limit(1)

  let seq = 1
  if (lastTicket && lastTicket.length > 0) {
    const num = parseInt(lastTicket[0].ticket_number.replace(prefix, ''), 10)
    if (!isNaN(num)) seq = num + 1
  }
  const ticketNumber = `TKT-${year}-${String(seq).padStart(4, '0')}`

  // Resolve SLA plan
  let slaPlanId: string | null = null
  const { data: contractData } = await supabase
    .from('customer_contracts')
    .select('sla_plan_id')
    .eq('customer_id', ctx.customerId)
    .eq('status', 'active')
    .not('sla_plan_id', 'is', null)
    .limit(1)
    .maybeSingle()

  if (contractData?.sla_plan_id) {
    slaPlanId = contractData.sla_plan_id
  } else {
    const { data: defaultPlan } = await supabase
      .from('sla_plans')
      .select('id')
      .eq('org_id', ctx.orgId)
      .eq('is_default', true)
      .eq('is_active', true)
      .maybeSingle()
    if (defaultPlan) slaPlanId = defaultPlan.id
  }

  const portalToken = crypto.randomUUID()

  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({
      org_id: ctx.orgId,
      ticket_number: ticketNumber,
      subject,
      description,
      priority: 'medium',
      category_id: categoryId,
      customer_id: ctx.customerId,
      contact_id: ctx.contactId,
      status: 'new',
      ticket_type: 'helpdesk',
      channel: 'portal',
      sla_plan_id: slaPlanId,
      portal_token: portalToken,
    })
    .select('id')
    .single()

  if (error || !ticket) return { ticketId: null, error: error?.message || 'Failed to create ticket' }

  // Initial message
  await supabase.from('ticket_messages').insert({
    ticket_id: ticket.id,
    body: description,
    sender_type: 'customer',
    is_internal: false,
    contact_id: ctx.contactId,
    sender_name: ctx.displayName,
    channel: 'portal',
  })

  // Fire-and-forget
  supabase
    .from('activity_log')
    .insert({
      org_id: ctx.orgId,
      entity_type: 'ticket',
      entity_id: ticket.id,
      action: 'created',
      actor_type: 'portal_user',
      portal_user_id: ctx.portalUserId,
      details: { ticket_number: ticketNumber, via: 'customer_portal' },
    })
    .then(() => {})

  return { ticketId: ticket.id, error: null }
}

export async function getPortalTicketStats(ctx: PortalContext): Promise<{
  open: number
  pendingResponse: number
  resolvedThisMonth: number
}> {
  const supabase = createAdminClient()

  const { data: tickets } = await supabase
    .from('tickets')
    .select('status, updated_at, resolved_at')
    .eq('customer_id', ctx.customerId)
    .eq('org_id', ctx.orgId)

  const all = tickets || []
  const open = all.filter((t) => !['resolved', 'closed', 'cancelled'].includes(t.status)).length
  const pendingResponse = all.filter((t) => t.status === 'waiting_on_customer').length

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const resolvedThisMonth = all.filter(
    (t) => t.resolved_at && new Date(t.resolved_at) >= monthStart
  ).length

  return { open, pendingResponse, resolvedThisMonth }
}
