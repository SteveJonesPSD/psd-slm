/**
 * Automation Macro execution engine
 *
 * Evaluates trigger conditions against a ticket's current state and
 * executes matching actions (escalate, set status, notify).
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { createNotification, createNotifications } from '@/lib/notifications'
import type { AutomationMacro, MacroAction } from '@/types/database'

export async function executeMacros(
  supabase: SupabaseClient,
  ticketId: string,
  orgId: string,
  allTagIds: string[],
  ticketPriority: string,
  ticketStatus: string
): Promise<string[]> {
  const { data: macros, error } = await supabase
    .from('automation_macros')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('sort_order')

  if (error || !macros || macros.length === 0) return []

  const executedIds: string[] = []

  for (const macro of macros as AutomationMacro[]) {
    if (!shouldTrigger(macro, allTagIds, ticketPriority, ticketStatus)) continue

    const actions = macro.actions as MacroAction[]
    for (const action of actions) {
      await executeAction(supabase, ticketId, orgId, action)
    }

    executedIds.push(macro.id)
  }

  return executedIds
}

function shouldTrigger(
  macro: AutomationMacro,
  allTagIds: string[],
  ticketPriority: string,
  ticketStatus: string
): boolean {
  const conditions = macro.trigger_conditions as Record<string, unknown>

  switch (macro.trigger_type) {
    case 'tag_applied': {
      const triggerTagIds = (conditions.tag_ids as string[]) || []
      const match = (conditions.match as string) || 'any'
      if (triggerTagIds.length === 0) return false
      if (match === 'all') {
        return triggerTagIds.every((id) => allTagIds.includes(id))
      }
      return triggerTagIds.some((id) => allTagIds.includes(id))
    }
    case 'priority_set': {
      const priorities = (conditions.priorities as string[]) || []
      return priorities.includes(ticketPriority)
    }
    case 'status_changed': {
      const statuses = (conditions.statuses as string[]) || []
      return statuses.includes(ticketStatus)
    }
    default:
      return false
  }
}

async function executeAction(
  supabase: SupabaseClient,
  ticketId: string,
  orgId: string,
  action: MacroAction
): Promise<void> {
  switch (action.type) {
    case 'escalate': {
      const level = action.level ?? 2
      await supabase
        .from('tickets')
        .update({
          escalation_level: level,
          status: 'escalated',
          escalated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', ticketId)
      break
    }
    case 'set_status': {
      if (action.status) {
        await supabase
          .from('tickets')
          .update({
            status: action.status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', ticketId)
      }
      break
    }
    case 'notify_users': {
      const userIds = action.user_ids || []
      if (userIds.length === 0) break

      // Fetch ticket subject for notification
      const { data: ticket } = await supabase
        .from('tickets')
        .select('ticket_number, subject')
        .eq('id', ticketId)
        .single()

      const subject = ticket?.subject || 'Unknown'
      const ticketNumber = ticket?.ticket_number || ''

      createNotifications(
        userIds.map((userId) => ({
          supabase,
          orgId,
          userId,
          type: 'triage_escalation',
          title: 'Ticket Auto-Escalated',
          message: `${ticketNumber}: ${subject}`,
          link: `/helpdesk/tickets/${ticketId}`,
          entityType: 'ticket',
          entityId: ticketId,
        }))
      )
      break
    }
    case 'notify_roles': {
      const roleNames = action.role_names || []
      if (roleNames.length === 0) break

      // Fetch users by role
      const { data: users } = await supabase
        .from('users')
        .select('id, roles!inner(name)')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .in('roles.name', roleNames)

      if (!users || users.length === 0) break

      const { data: ticket } = await supabase
        .from('tickets')
        .select('ticket_number, subject')
        .eq('id', ticketId)
        .single()

      const subject = ticket?.subject || 'Unknown'
      const ticketNumber = ticket?.ticket_number || ''

      createNotifications(
        users.map((u) => ({
          supabase,
          orgId,
          userId: u.id,
          type: 'triage_escalation',
          title: 'Ticket Auto-Escalated',
          message: `${ticketNumber}: ${subject}`,
          link: `/helpdesk/tickets/${ticketId}`,
          entityType: 'ticket',
          entityId: ticketId,
        }))
      )
      break
    }
  }
}
