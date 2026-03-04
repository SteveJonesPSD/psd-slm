'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePortalAuth } from './auth'
import { revalidatePath } from 'next/cache'
import { calculateSlaDeadline } from '@/lib/sla'
import { formatTicketNumber } from '@/lib/helpdesk'
import { triageTicket } from '@/lib/helpdesk/triage'

// ============================================================================
// PORTAL TICKET QUERIES
// ============================================================================

export async function getPortalTickets(filters?: { status?: string; contactId?: string }) {
  const contact = await requirePortalAuth()
  const supabase = await createClient()

  let query = supabase
    .from('tickets')
    .select('id, ticket_number, subject, status, priority, updated_at, contact_id, contacts(first_name, last_name)')
    .eq('org_id', contact.customer.org_id)
    .order('updated_at', { ascending: false })

  if (contact.is_overseer) {
    // Overseer sees all company tickets
    query = query.eq('customer_id', contact.customer_id)
    if (filters?.contactId) {
      query = query.eq('contact_id', filters.contactId)
    }
  } else {
    // Standard contact sees own tickets only
    query = query.eq('contact_id', contact.id)
  }

  if (filters?.status === 'open') {
    query = query.not('status', 'in', '("resolved","closed","cancelled")')
  } else if (filters?.status === 'resolved') {
    query = query.in('status', ['resolved', 'closed'])
  }

  const { data } = await query
  return data || []
}

export async function getPortalTicket(ticketId: string) {
  const contact = await requirePortalAuth()
  const supabase = await createClient()

  const { data: ticket } = await supabase
    .from('tickets')
    .select('*, customers(name), contacts(first_name, last_name), assigned:assigned_to(first_name, last_name), ticket_categories(name), sla_plans(name, sla_plan_targets(priority, response_time_minutes, resolution_time_minutes))')
    .eq('id', ticketId)
    .eq('org_id', contact.customer.org_id)
    .single()

  if (!ticket) return null

  // Access control
  if (!contact.is_overseer && ticket.contact_id !== contact.id) return null
  if (contact.is_overseer && ticket.customer_id !== contact.customer_id) return null

  // Get messages (exclude internal notes)
  const { data: messages } = await supabase
    .from('ticket_messages')
    .select('id, body, sender_type, is_internal, created_at, sender_name, contact_id')
    .eq('ticket_id', ticketId)
    .eq('is_internal', false)
    .order('created_at', { ascending: true })

  return { ...ticket, messages: messages || [] }
}

export async function getPortalContacts() {
  const contact = await requirePortalAuth()
  if (!contact.is_overseer) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email')
    .eq('customer_id', contact.customer_id)
    .eq('is_active', true)
    .order('first_name')

  return data || []
}

// ============================================================================
// PORTAL TICKET CREATION
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

export async function createPortalTicket(formData: FormData) {
  const contact = await requirePortalAuth()
  const supabase = await createClient()

  const subject = formData.get('subject') as string
  const description = formData.get('description') as string
  const priority = formData.get('priority') as string || 'medium'
  const categoryId = formData.get('category_id') as string || null
  const onBehalfOf = formData.get('on_behalf_of') as string || null

  const ticketContactId = (contact.is_overseer && onBehalfOf) ? onBehalfOf : contact.id
  const orgId = contact.customer.org_id

  const ticketNumber = await generateTicketNumber(supabase, orgId)

  // Resolve SLA plan from contract
  let slaPlanId: string | null = null
  let slaResponseDueAt: string | null = null
  let slaResolutionDueAt: string | null = null

  const { data: contractData } = await supabase
    .from('support_contracts')
    .select('sla_plan_id, sla_plans(*, sla_plan_targets(*))')
    .eq('customer_id', contact.customer_id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (contractData?.sla_plan_id) {
    slaPlanId = contractData.sla_plan_id
  } else {
    const { data: defaultPlan } = await supabase
      .from('sla_plans')
      .select('*, sla_plan_targets(*)')
      .eq('org_id', orgId)
      .eq('is_default', true)
      .eq('is_active', true)
      .maybeSingle()
    if (defaultPlan) slaPlanId = defaultPlan.id
  }

  if (slaPlanId) {
    const plan = contractData?.sla_plans || null
    if (plan) {
      const targets = (plan as unknown as Record<string, unknown>).sla_plan_targets as Record<string, unknown>[]
      const target = targets?.find(t => t.priority === priority)
      if (target) {
        const now = new Date()
        if ((target.response_time_minutes as number) > 0) {
          slaResponseDueAt = calculateSlaDeadline(now, target.response_time_minutes as number, plan as never).toISOString()
        }
        if ((target.resolution_time_minutes as number) > 0) {
          slaResolutionDueAt = calculateSlaDeadline(now, target.resolution_time_minutes as number, plan as never).toISOString()
        }
      }
    }
  }

  const portalToken = crypto.randomUUID()

  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({
      org_id: orgId,
      ticket_number: ticketNumber,
      subject,
      description,
      priority,
      category_id: categoryId,
      customer_id: contact.customer_id,
      contact_id: ticketContactId,
      status: 'new',
      ticket_type: 'helpdesk',
      channel: 'portal',
      sla_plan_id: slaPlanId,
      sla_response_due_at: slaResponseDueAt,
      sla_resolution_due_at: slaResolutionDueAt,
      portal_token: portalToken,
    })
    .select()
    .single()

  if (error) return { error: error.message, data: null }

  // Create initial message
  await supabase.from('ticket_messages').insert({
    ticket_id: ticket.id,
    body: description,
    sender_type: 'customer',
    is_internal: false,
    contact_id: ticketContactId,
    sender_name: `${contact.first_name} ${contact.last_name}`,
    channel: 'portal',
  })

  // SLA started event
  if (slaPlanId) {
    await supabase.from('sla_events').insert({
      ticket_id: ticket.id,
      event_type: 'started',
      details: { sla_plan_id: slaPlanId },
    })
  }

  // Fire-and-forget activity log
  supabase.from('activity_log').insert({
    org_id: orgId,
    user_id: null,
    entity_type: 'portal.ticket',
    entity_id: ticket.id,
    action: 'created',
    details: { ticket_number: ticketNumber, contact_id: ticketContactId, is_behalf_of: !!onBehalfOf },
  }).then(() => {})

  // Fire-and-forget AI triage
  triageTicket(ticket.id, orgId, [])
    .catch(err => console.error('[triage]', err))

  revalidatePath('/portal/tickets')
  return { error: null, data: ticket }
}

// ============================================================================
// PORTAL TICKET REPLY
// ============================================================================

export async function addPortalReply(ticketId: string, formData: FormData) {
  const contact = await requirePortalAuth()
  const supabase = await createClient()

  const body = formData.get('body') as string

  // Verify access
  const { data: ticket } = await supabase
    .from('tickets')
    .select('id, status, contact_id, customer_id, org_id')
    .eq('id', ticketId)
    .single()

  if (!ticket) return { error: 'Ticket not found' }
  if (!contact.is_overseer && ticket.contact_id !== contact.id) return { error: 'Access denied' }
  if (contact.is_overseer && ticket.customer_id !== contact.customer_id) return { error: 'Access denied' }

  await supabase.from('ticket_messages').insert({
    ticket_id: ticketId,
    body,
    sender_type: 'customer',
    is_internal: false,
    contact_id: contact.id,
    sender_name: `${contact.first_name} ${contact.last_name}`,
    channel: 'portal',
  })

  // If resolved, reopen
  if (ticket.status === 'resolved') {
    await supabase
      .from('tickets')
      .update({ status: 'open', resolved_at: null, updated_at: new Date().toISOString() })
      .eq('id', ticketId)

    await supabase.from('ticket_messages').insert({
      ticket_id: ticketId,
      body: 'Status changed from Resolved to Open (customer replied)',
      sender_type: 'system',
      is_internal: false,
      sender_name: 'System',
    })
  } else {
    await supabase
      .from('tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', ticketId)
  }

  // Fire-and-forget activity log
  supabase.from('activity_log').insert({
    org_id: ticket.org_id,
    user_id: null,
    entity_type: 'portal.ticket',
    entity_id: ticketId,
    action: 'replied',
    details: { contact_id: contact.id },
  }).then(() => {})

  revalidatePath(`/portal/tickets/${ticketId}`)
  return { error: null }
}

// ============================================================================
// PORTAL KB
// ============================================================================

export async function getPortalKbArticles() {
  const contact = await requirePortalAuth()
  const supabase = await createClient()

  const { data } = await supabase
    .from('kb_articles')
    .select('id, title, slug, body, category_id, kb_categories(name), view_count, updated_at')
    .eq('org_id', contact.customer.org_id)
    .eq('status', 'published')
    .eq('is_public', true)
    .eq('is_internal', false)
    .order('title')

  return data || []
}

export async function getPortalKbArticle(slug: string) {
  const contact = await requirePortalAuth()
  const supabase = await createClient()

  const { data: article } = await supabase
    .from('kb_articles')
    .select('*, kb_categories(name)')
    .eq('org_id', contact.customer.org_id)
    .eq('slug', slug)
    .eq('status', 'published')
    .eq('is_public', true)
    .eq('is_internal', false)
    .single()

  if (!article) return null

  // Increment view count
  await supabase
    .from('kb_articles')
    .update({ view_count: (article.view_count || 0) + 1 })
    .eq('id', article.id)

  // Get ratings
  const { data: ratings } = await supabase
    .from('kb_article_ratings')
    .select('is_helpful')
    .eq('article_id', article.id)

  const totalRatings = ratings?.length || 0
  const helpfulCount = ratings?.filter(r => r.is_helpful).length || 0

  // Check if this contact already rated
  const { data: myRating } = await supabase
    .from('kb_article_ratings')
    .select('id, is_helpful')
    .eq('article_id', article.id)
    .eq('contact_id', contact.id)
    .maybeSingle()

  return { ...article, totalRatings, helpfulCount, myRating }
}

export async function rateKbArticle(articleId: string, isHelpful: boolean) {
  const contact = await requirePortalAuth()
  const supabase = await createClient()

  // Upsert - one rating per contact per article
  const { data: existing } = await supabase
    .from('kb_article_ratings')
    .select('id')
    .eq('article_id', articleId)
    .eq('contact_id', contact.id)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('kb_article_ratings')
      .update({ is_helpful: isHelpful })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('kb_article_ratings')
      .insert({ article_id: articleId, is_helpful: isHelpful, contact_id: contact.id })
  }

  revalidatePath(`/portal/knowledge-base`)
  return { error: null }
}

// ============================================================================
// PORTAL CATEGORIES (for ticket creation)
// ============================================================================

export async function getPortalCategories() {
  const contact = await requirePortalAuth()
  const supabase = await createClient()

  const { data } = await supabase
    .from('ticket_categories')
    .select('id, name')
    .eq('org_id', contact.customer.org_id)
    .eq('is_active', true)
    .order('sort_order')

  return data || []
}

// ============================================================================
// OVERSEER DASHBOARD
// ============================================================================

export async function getOverseerDashboard() {
  const contact = await requirePortalAuth()
  if (!contact.is_overseer) return null

  const supabase = await createClient()
  const companyId = contact.customer_id
  const orgId = contact.customer.org_id

  // Open tickets
  const { data: openTickets } = await supabase
    .from('tickets')
    .select('id, priority, status')
    .eq('org_id', orgId)
    .eq('customer_id', companyId)
    .not('status', 'in', '("closed","cancelled","resolved")')

  const open = openTickets || []
  const urgentHigh = open.filter(t => t.priority === 'urgent' || t.priority === 'high').length

  // 30-day metrics
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recentResolved } = await supabase
    .from('tickets')
    .select('created_at, resolved_at, paused_minutes, sla_response_met, sla_resolution_met')
    .eq('org_id', orgId)
    .eq('customer_id', companyId)
    .gte('resolved_at', thirtyDaysAgo)

  const resolved = recentResolved || []
  let totalResMs = 0
  let resCount = 0
  let slaMet = 0

  for (const t of resolved) {
    if (t.resolved_at && t.created_at) {
      const pausedMs = (t.paused_minutes || 0) * 60 * 1000
      totalResMs += new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime() - pausedMs
      resCount++
    }
    if (t.sla_response_met !== false && t.sla_resolution_met !== false) slaMet++
  }

  const avgResolutionMs = resCount > 0 ? totalResMs / resCount : 0
  const slaCompliancePct = resolved.length > 0 ? Math.round((slaMet / resolved.length) * 100) : 100

  // Priority breakdown
  const priorityCounts: Record<string, number> = { urgent: 0, high: 0, medium: 0, low: 0 }
  for (const t of open) {
    if (priorityCounts[t.priority] !== undefined) priorityCounts[t.priority]++
  }

  // Recent tickets
  const { data: recentTickets } = await supabase
    .from('tickets')
    .select('id, ticket_number, subject, status, priority, updated_at, contacts(first_name, last_name)')
    .eq('org_id', orgId)
    .eq('customer_id', companyId)
    .order('updated_at', { ascending: false })
    .limit(10)

  // Weekly trend (8 weeks)
  const eightWeeksAgo = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString()
  const { data: weeklyTickets } = await supabase
    .from('tickets')
    .select('created_at')
    .eq('org_id', orgId)
    .eq('customer_id', companyId)
    .gte('created_at', eightWeeksAgo)

  const weekCounts: Record<string, number> = {}
  for (const t of weeklyTickets || []) {
    const d = new Date(t.created_at)
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay())
    const key = weekStart.toISOString().substring(0, 10)
    weekCounts[key] = (weekCounts[key] || 0) + 1
  }

  return {
    openCount: open.length,
    urgentHigh,
    avgResolutionMs,
    slaCompliancePct,
    priorityCounts,
    recentTickets: recentTickets || [],
    weeklyTrend: Object.entries(weekCounts).sort(([a], [b]) => a.localeCompare(b)),
  }
}
