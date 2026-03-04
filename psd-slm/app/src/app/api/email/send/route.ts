// =============================================================================
// POST /api/email/send
// Sends an email reply for a helpdesk ticket via Graph API.
// Authenticated: requires helpdesk.edit or helpdesk.create permission.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, hasPermission } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTicketReply, getTicketEmailContext } from '@/lib/email/email-sender'

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    if (!hasPermission(user, 'helpdesk', 'create') && !hasPermission(user, 'helpdesk', 'edit')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const body = await req.json()
    const { ticketId, bodyHtml, bodyText, ccAddresses } = body

    if (!ticketId || (!bodyHtml && !bodyText)) {
      return NextResponse.json({ error: 'ticketId and body are required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Get ticket details
    const { data: ticket } = await supabase
      .from('tickets')
      .select('id, ticket_number')
      .eq('id', ticketId)
      .eq('org_id', user.orgId)
      .single()

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Get email context for this ticket
    const emailContext = await getTicketEmailContext(supabase, ticketId)
    if (!emailContext) {
      return NextResponse.json({ error: 'No email context found for this ticket' }, { status: 400 })
    }

    const result = await sendTicketReply(supabase, {
      orgId: user.orgId,
      ticketId,
      ticketNumber: ticket.ticket_number,
      channelId: emailContext.channelId,
      fromAddress: emailContext.fromAddress,
      toAddress: emailContext.toAddress,
      toName: emailContext.toName || undefined,
      ccAddresses,
      subject: emailContext.subject,
      bodyHtml: bodyHtml || `<p>${bodyText.replace(/\n/g, '<br>')}</p>`,
      bodyText: bodyText || '',
      userId: user.id,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[email/send]', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Send failed' },
      { status: 500 }
    )
  }
}
