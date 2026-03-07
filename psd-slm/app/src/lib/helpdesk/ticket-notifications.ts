import { SupabaseClient } from '@supabase/supabase-js'
import { createNotifications } from '@/lib/notifications'

interface TicketNotifyParams {
  supabase: SupabaseClient
  orgId: string
  ticketId: string
  ticketNumber: string
  subject: string
  actorId: string  // user who triggered the change — excluded from notifications
  type: string
  title: string
  message: string
}

/**
 * Fire-and-forget: notify ticket assignee + watchers about a change.
 * Excludes the actor (person who made the change) from receiving notifications.
 */
export async function notifyTicketStakeholders({
  supabase,
  orgId,
  ticketId,
  ticketNumber,
  subject,
  actorId,
  type,
  title,
  message,
}: TicketNotifyParams): Promise<void> {
  try {
    // Get assigned user
    const { data: ticket } = await supabase
      .from('tickets')
      .select('assigned_to')
      .eq('id', ticketId)
      .single()

    // Get watchers
    const { data: watchers } = await supabase
      .from('ticket_watchers')
      .select('user_id')
      .eq('ticket_id', ticketId)

    const recipientIds = new Set<string>()
    if (ticket?.assigned_to) recipientIds.add(ticket.assigned_to)
    if (watchers) {
      for (const w of watchers) recipientIds.add(w.user_id)
    }

    // Exclude the actor
    recipientIds.delete(actorId)

    if (recipientIds.size === 0) return

    const link = `/helpdesk/tickets/${ticketId}`

    createNotifications(
      Array.from(recipientIds).map(userId => ({
        supabase,
        orgId,
        userId,
        type,
        title: `${ticketNumber}: ${title}`,
        message,
        link,
        entityType: 'ticket',
        entityId: ticketId,
      }))
    )
  } catch (err) {
    console.error('[ticket-notifications]', err)
  }
}
