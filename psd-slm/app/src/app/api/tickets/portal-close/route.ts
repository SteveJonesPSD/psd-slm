import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/tickets/portal-close
 * Closes a ticket via portal token (unauthenticated).
 * Used by the "Close Ticket" link in nudge emails.
 */
export async function POST(req: NextRequest) {
  const { token } = await req.json()

  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Find ticket by portal token
  const { data: ticket } = await supabase
    .from('tickets')
    .select('id, ticket_number, status, org_id')
    .eq('portal_token', token)
    .single()

  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  }

  // Already closed or cancelled
  if (ticket.status === 'closed' || ticket.status === 'cancelled') {
    return NextResponse.json({ alreadyClosed: true, ticketNumber: ticket.ticket_number })
  }

  const now = new Date().toISOString()

  // Close the ticket
  await supabase
    .from('tickets')
    .update({
      status: 'closed',
      closed_at: now,
      resolved_at: now,
      waiting_since: null,
      auto_close_warning_sent_at: null,
      auto_nudge_sent_at: null,
      updated_at: now,
    })
    .eq('id', ticket.id)

  // Add system message
  await supabase.from('ticket_messages').insert({
    ticket_id: ticket.id,
    sender_type: 'customer',
    sender_name: null,
    body: 'Customer closed this ticket via the email close link.',
    is_internal: false,
  })

  return NextResponse.json({ closed: true, ticketNumber: ticket.ticket_number })
}
