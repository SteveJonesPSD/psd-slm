import { createAdminClient } from '@/lib/supabase/admin'
import { decryptContactRow } from '@/lib/crypto-helpers'
import { TicketPortalNotFound } from './ticket-portal-not-found'
import { TicketPortalClosed } from './ticket-portal-closed'
import { TicketPortalMerged } from './ticket-portal-merged'
import { TicketPortalView } from './ticket-portal-view'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function TicketPortalPage({ params }: PageProps) {
  const { token } = await params
  const supabase = createAdminClient()

  // Fetch ticket by portal_token
  const { data: ticket } = await supabase
    .from('tickets')
    .select(`
      id,
      org_id,
      ticket_number,
      subject,
      status,
      priority,
      ticket_type,
      created_at,
      portal_token,
      merged_into_ticket_id,
      customers(name),
      contacts(first_name, last_name, email)
    `)
    .eq('portal_token', token)
    .single()

  if (!ticket) {
    return <TicketPortalNotFound />
  }

  // Merged ticket → follow chain to live ticket and show merge page
  if (ticket.merged_into_ticket_id) {
    // Follow the merge chain (max 5 hops)
    let targetId = ticket.merged_into_ticket_id
    for (let i = 0; i < 5; i++) {
      const { data: target } = await supabase
        .from('tickets')
        .select('id, ticket_number, portal_token, merged_into_ticket_id')
        .eq('id', targetId)
        .single()

      if (!target) break

      if (!target.merged_into_ticket_id) {
        // Found the live ticket
        return (
          <TicketPortalMerged
            ticketNumber={ticket.ticket_number}
            subject={ticket.subject}
            targetToken={target.portal_token || ''}
            targetTicketNumber={target.ticket_number}
          />
        )
      }
      targetId = target.merged_into_ticket_id
    }

    // Fallback if chain is broken
    return (
      <TicketPortalClosed
        ticketNumber={ticket.ticket_number}
        subject={ticket.subject}
      />
    )
  }

  // Closed/cancelled → read-only view
  if (ticket.status === 'closed' || ticket.status === 'cancelled') {
    return (
      <TicketPortalClosed
        ticketNumber={ticket.ticket_number}
        subject={ticket.subject}
      />
    )
  }

  // Fetch non-internal messages
  const { data: messages } = await supabase
    .from('ticket_messages')
    .select('id, body, sender_type, sender_name, is_internal, created_at')
    .eq('ticket_id', ticket.id)
    .eq('is_internal', false)
    .order('created_at', { ascending: true })

  // Fetch all attachments for the ticket
  const { data: attachments } = await supabase
    .from('ticket_attachments')
    .select('id, message_id, file_name, file_size, mime_type')
    .eq('ticket_id', ticket.id)

  const rawContact = ticket.contacts as unknown as { first_name: string; last_name: string; email: string | null } | null
  const contact = rawContact ? decryptContactRow(rawContact) : null

  return (
    <TicketPortalView
      ticket={{
        id: ticket.id,
        orgId: ticket.org_id,
        ticketNumber: ticket.ticket_number,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        ticketType: ticket.ticket_type,
        createdAt: ticket.created_at,
        customerName: (ticket.customers as unknown as { name: string } | null)?.name || null,
        contactName: contact ? `${contact.first_name} ${contact.last_name}` : null,
      }}
      messages={(messages || []).map(m => ({
        id: m.id,
        body: m.body,
        senderType: m.sender_type,
        senderName: m.sender_name,
        createdAt: m.created_at,
      }))}
      attachments={(attachments || []).map(a => ({
        id: a.id,
        messageId: a.message_id,
        fileName: a.file_name,
        fileSize: a.file_size,
        mimeType: a.mime_type,
      }))}
      token={token}
    />
  )
}
