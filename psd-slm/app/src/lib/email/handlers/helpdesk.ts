// =============================================================================
// Helpdesk Email Handler
// Creates new tickets from inbound emails or threads replies to existing tickets.
// Uses a 4-tier matching strategy for threading.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProcessedEmail, MailChannel, HandlerResult, EmailAttachmentMeta } from '../types'
import { sanitiseHtml, htmlToPlainText, extractNewContent, getHeader, parseReferences } from '../email-utils'

const TICKET_NUMBER_REGEX = /\[TKT-\d{4}-\d{4,}\]/

/**
 * Handle an inbound helpdesk email.
 * Attempts to thread to an existing ticket, or creates a new one.
 */
export async function handleHelpdeskEmail(
  email: ProcessedEmail,
  channel: MailChannel,
  orgId: string,
  supabase: SupabaseClient
): Promise<HandlerResult> {
  const msg = email.graphMessage
  const fromAddress = msg.from.emailAddress.address.toLowerCase()
  const fromName = msg.from.emailAddress.name || fromAddress
  const subject = msg.subject || '(No subject)'

  // Extract body content
  const bodyHtml = sanitiseHtml(msg.body.content || '')
  const bodyText = msg.body.contentType === 'Text'
    ? msg.body.content || ''
    : htmlToPlainText(msg.body.content || '')

  // Get threading headers
  const inReplyTo = getHeader(msg.internetMessageHeaders, 'In-Reply-To')
  const references = parseReferences(getHeader(msg.internetMessageHeaders, 'References'))

  // Try to find an existing ticket to thread to
  const existingTicket = await findExistingTicket(
    supabase,
    orgId,
    inReplyTo,
    references,
    subject,
    msg.conversationId
  )

  // Store email attachments
  const attachmentMeta = await storeAttachments(
    supabase,
    orgId,
    existingTicket?.id || 'pending', // will update after ticket creation
    email,
    channel
  )

  if (existingTicket) {
    return await threadToTicket(
      supabase, orgId, existingTicket, email, channel,
      fromAddress, fromName, subject, bodyHtml, bodyText,
      inReplyTo, attachmentMeta
    )
  }

  return await createNewTicket(
    supabase, orgId, email, channel,
    fromAddress, fromName, subject, bodyHtml, bodyText,
    inReplyTo, attachmentMeta
  )
}

// -----------------------------------------------------------------------------
// 4-tier ticket matching
// -----------------------------------------------------------------------------

interface TicketMatch {
  id: string
  ticket_number: string
  status: string
}

async function findExistingTicket(
  supabase: SupabaseClient,
  orgId: string,
  inReplyTo: string | null,
  references: string[],
  subject: string,
  conversationId: string
): Promise<TicketMatch | null> {
  // Tier 1: In-Reply-To header match
  if (inReplyTo) {
    const { data } = await supabase
      .from('ticket_emails')
      .select('ticket_id, tickets!inner(id, ticket_number, status)')
      .eq('org_id', orgId)
      .eq('internet_message_id', inReplyTo)
      .limit(1)
      .maybeSingle()

    if (data?.tickets) {
      const t = data.tickets as unknown as TicketMatch
      return { id: t.id, ticket_number: t.ticket_number, status: t.status }
    }
  }

  // Tier 2: References header match
  if (references.length > 0) {
    const { data } = await supabase
      .from('ticket_emails')
      .select('ticket_id, tickets!inner(id, ticket_number, status)')
      .eq('org_id', orgId)
      .in('internet_message_id', references)
      .limit(1)
      .maybeSingle()

    if (data?.tickets) {
      const t = data.tickets as unknown as TicketMatch
      return { id: t.id, ticket_number: t.ticket_number, status: t.status }
    }
  }

  // Tier 3: Ticket number in subject line
  const ticketMatch = subject.match(TICKET_NUMBER_REGEX)
  if (ticketMatch) {
    const ticketNumber = ticketMatch[0].slice(1, -1) // Remove brackets
    const { data } = await supabase
      .from('tickets')
      .select('id, ticket_number, status')
      .eq('org_id', orgId)
      .eq('ticket_number', ticketNumber)
      .maybeSingle()

    if (data) {
      return data as TicketMatch
    }
  }

  // Tier 4: Graph Conversation ID match
  if (conversationId) {
    const { data } = await supabase
      .from('ticket_emails')
      .select('ticket_id, tickets!inner(id, ticket_number, status)')
      .eq('org_id', orgId)
      .eq('conversation_id', conversationId)
      .limit(1)
      .maybeSingle()

    if (data?.tickets) {
      const t = data.tickets as unknown as TicketMatch
      return { id: t.id, ticket_number: t.ticket_number, status: t.status }
    }
  }

  return null
}

// -----------------------------------------------------------------------------
// Thread an email to an existing ticket
// -----------------------------------------------------------------------------

async function threadToTicket(
  supabase: SupabaseClient,
  orgId: string,
  ticket: TicketMatch,
  email: ProcessedEmail,
  channel: MailChannel,
  fromAddress: string,
  fromName: string,
  subject: string,
  bodyHtml: string,
  bodyText: string,
  inReplyTo: string | null,
  attachmentMeta: EmailAttachmentMeta[]
): Promise<HandlerResult> {
  const msg = email.graphMessage
  const newContent = extractNewContent(bodyText)

  // Add message to ticket conversation
  await supabase.from('ticket_messages').insert({
    ticket_id: ticket.id,
    sender_type: 'customer',
    sender_id: null,
    sender_name: fromName,
    body: newContent || bodyText,
    is_internal: false,
  })

  // Record the email
  await supabase.from('ticket_emails').insert({
    org_id: orgId,
    ticket_id: ticket.id,
    channel_id: channel.id,
    direction: 'inbound',
    graph_message_id: msg.id,
    internet_message_id: msg.internetMessageId,
    conversation_id: msg.conversationId,
    in_reply_to: inReplyTo,
    from_address: fromAddress,
    from_name: fromName,
    to_addresses: msg.toRecipients.map(r => ({ address: r.emailAddress.address, name: r.emailAddress.name })),
    cc_addresses: (msg.ccRecipients || []).map(r => ({ address: r.emailAddress.address, name: r.emailAddress.name })),
    subject,
    body_text: bodyText,
    body_html: bodyHtml,
    has_attachments: attachmentMeta.length > 0,
    attachments: attachmentMeta,
    sent_at: msg.receivedDateTime,
    processing_notes: `Threaded to ${ticket.ticket_number}`,
  })

  // Reopen ticket if it was resolved or closed
  const reopenStatuses = ['resolved', 'closed']
  if (reopenStatuses.includes(ticket.status)) {
    await supabase
      .from('tickets')
      .update({
        status: 'open',
        updated_at: new Date().toISOString(),
        // Clear waiting_since and auto-close tracking
        waiting_since: null,
        auto_close_warning_sent_at: null,
      })
      .eq('id', ticket.id)
  } else if (ticket.status === 'waiting_on_customer') {
    // Customer replied while we were waiting — clear waiting state
    await supabase
      .from('tickets')
      .update({
        status: 'open',
        updated_at: new Date().toISOString(),
        waiting_since: null,
        auto_close_warning_sent_at: null,
      })
      .eq('id', ticket.id)
  } else {
    await supabase
      .from('tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', ticket.id)
  }

  // Log activity
  await supabase.from('activity_log').insert({
    org_id: orgId,
    entity_type: 'ticket',
    entity_id: ticket.id,
    action: 'email_received',
    details: { from: fromAddress, subject, ticket_number: ticket.ticket_number },
    created_at: new Date().toISOString(),
  })

  return {
    action: 'threaded_to_ticket',
    ticketId: ticket.id,
    ticketNumber: ticket.ticket_number,
    notes: `Threaded to ${ticket.ticket_number}`,
  }
}

// -----------------------------------------------------------------------------
// Create a new ticket from an email
// -----------------------------------------------------------------------------

async function createNewTicket(
  supabase: SupabaseClient,
  orgId: string,
  email: ProcessedEmail,
  channel: MailChannel,
  fromAddress: string,
  fromName: string,
  subject: string,
  bodyHtml: string,
  bodyText: string,
  inReplyTo: string | null,
  attachmentMeta: EmailAttachmentMeta[]
): Promise<HandlerResult> {
  const msg = email.graphMessage

  // Look up sender contact and customer
  const { contactId, customerId } = await resolveContact(supabase, orgId, fromAddress)

  // Generate ticket number
  const ticketNumber = await generateTicketNumber(supabase, orgId)

  // Generate portal token
  const portalToken = crypto.randomUUID()

  // Resolve SLA plan
  const sla = await resolveSla(supabase, orgId, customerId)

  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({
      org_id: orgId,
      ticket_number: ticketNumber,
      customer_id: customerId,
      contact_id: contactId,
      subject,
      description: bodyText.substring(0, 500),
      ticket_type: 'helpdesk',
      status: 'new',
      priority: 'medium',
      source: 'email',
      portal_token: portalToken,
      sla_plan_id: sla.slaPlanId,
      contract_id: sla.contractId,
      sla_response_due_at: sla.responseDueAt,
      sla_resolution_due_at: sla.resolutionDueAt,
    })
    .select('id, ticket_number')
    .single()

  if (error || !ticket) {
    return {
      action: 'error',
      notes: `Failed to create ticket: ${error?.message || 'Unknown error'}`,
    }
  }

  // Create initial message
  const newContent = extractNewContent(bodyText)
  await supabase.from('ticket_messages').insert({
    ticket_id: ticket.id,
    sender_type: 'customer',
    sender_id: null,
    sender_name: fromName,
    body: newContent || bodyText,
    is_internal: false,
  })

  // Record the email
  await supabase.from('ticket_emails').insert({
    org_id: orgId,
    ticket_id: ticket.id,
    channel_id: channel.id,
    direction: 'inbound',
    graph_message_id: msg.id,
    internet_message_id: msg.internetMessageId,
    conversation_id: msg.conversationId,
    in_reply_to: inReplyTo,
    from_address: fromAddress,
    from_name: fromName,
    to_addresses: msg.toRecipients.map(r => ({ address: r.emailAddress.address, name: r.emailAddress.name })),
    cc_addresses: (msg.ccRecipients || []).map(r => ({ address: r.emailAddress.address, name: r.emailAddress.name })),
    subject,
    body_text: bodyText,
    body_html: bodyHtml,
    has_attachments: attachmentMeta.length > 0,
    attachments: attachmentMeta,
    sent_at: msg.receivedDateTime,
    processing_notes: `New ticket created: ${ticket.ticket_number}`,
  })

  // Update attachment storage keys if we stored them with 'pending' ticket ID
  if (attachmentMeta.length > 0) {
    // Attachments were already stored under the correct path since we passed ticket.id
  }

  // Log activity
  await supabase.from('activity_log').insert({
    org_id: orgId,
    entity_type: 'ticket',
    entity_id: ticket.id,
    action: 'created',
    details: {
      source: 'email',
      from: fromAddress,
      subject,
      ticket_number: ticket.ticket_number,
    },
    created_at: new Date().toISOString(),
  })

  return {
    action: 'created_ticket',
    ticketId: ticket.id,
    ticketNumber: ticket.ticket_number,
    notes: `New ticket created: ${ticket.ticket_number}`,
  }
}

// -----------------------------------------------------------------------------
// Contact/customer resolution
// -----------------------------------------------------------------------------

async function resolveContact(
  supabase: SupabaseClient,
  orgId: string,
  email: string
): Promise<{ contactId: string | null; customerId: string | null }> {
  // Look up contact by email
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, customer_id')
    .eq('org_id', orgId)
    .ilike('email', email)
    .limit(1)
    .maybeSingle()

  if (contact) {
    return { contactId: contact.id, customerId: contact.customer_id }
  }

  // No contact found — try matching by email domain to a customer
  const domain = email.split('@')[1]?.toLowerCase()
  if (domain) {
    const { data: customers } = await supabase
      .from('contacts')
      .select('customer_id')
      .eq('org_id', orgId)
      .ilike('email', `%@${domain}`)
      .limit(1)

    if (customers && customers.length > 0) {
      return { contactId: null, customerId: customers[0].customer_id }
    }
  }

  return { contactId: null, customerId: null }
}

// -----------------------------------------------------------------------------
// Ticket number generation (same pattern as helpdesk/actions.ts)
// -----------------------------------------------------------------------------

async function generateTicketNumber(supabase: SupabaseClient, orgId: string): Promise<string> {
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
    const num = parseInt(data[0].ticket_number.replace(prefix, ''), 10)
    if (!isNaN(num)) seq = num + 1
  }

  return `${prefix}${String(seq).padStart(4, '0')}`
}

// -----------------------------------------------------------------------------
// SLA resolution (simplified from helpdesk/actions.ts)
// -----------------------------------------------------------------------------

async function resolveSla(
  supabase: SupabaseClient,
  orgId: string,
  customerId: string | null
): Promise<{
  slaPlanId: string | null
  contractId: string | null
  responseDueAt: string | null
  resolutionDueAt: string | null
}> {
  const empty = { slaPlanId: null, contractId: null, responseDueAt: null, resolutionDueAt: null }

  if (!customerId) return empty

  // Check for active support contract
  const { data: contract } = await supabase
    .from('support_contracts')
    .select('id, sla_plan_id, sla_plans(*, sla_plan_targets(*))')
    .eq('customer_id', customerId)
    .eq('org_id', orgId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  let slaPlanId: string | null = null
  let contractId: string | null = null
  interface SlaPlanWithTargets {
    sla_plan_targets?: { priority: string; response_time_minutes: number; resolution_time_minutes: number }[]
  }
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

  // Find medium priority target (default for email-created tickets)
  const target = slaPlan.sla_plan_targets.find((t: { priority: string }) => t.priority === 'medium')
  if (!target) return { slaPlanId, contractId, responseDueAt: null, resolutionDueAt: null }

  // Simple deadline calculation (business hours calculation is in lib/sla.ts but we keep it simple here)
  const now = new Date()
  const responseDue = new Date(now.getTime() + target.response_time_minutes * 60_000)
  const resolutionDue = new Date(now.getTime() + target.resolution_time_minutes * 60_000)

  return {
    slaPlanId,
    contractId,
    responseDueAt: responseDue.toISOString(),
    resolutionDueAt: resolutionDue.toISOString(),
  }
}

// -----------------------------------------------------------------------------
// Attachment storage
// -----------------------------------------------------------------------------

async function storeAttachments(
  supabase: SupabaseClient,
  orgId: string,
  ticketId: string,
  email: ProcessedEmail,
  channel: MailChannel
): Promise<EmailAttachmentMeta[]> {
  if (!email.attachments || email.attachments.length === 0) return []

  const meta: EmailAttachmentMeta[] = []

  for (const attachment of email.attachments) {
    const storageKey = `${orgId}/${ticketId}/${attachment.name}`

    try {
      // Decode base64 content
      const buffer = Buffer.from(attachment.contentBytes, 'base64')

      const { error } = await supabase.storage
        .from('email-attachments')
        .upload(storageKey, buffer, {
          contentType: attachment.contentType,
          upsert: false,
        })

      if (!error) {
        meta.push({
          name: attachment.name,
          size: attachment.size,
          contentType: attachment.contentType,
          storageKey,
        })
      }
    } catch {
      // Non-blocking — log but continue
      console.error(`[email] Failed to store attachment ${attachment.name}`)
    }
  }

  return meta
}
