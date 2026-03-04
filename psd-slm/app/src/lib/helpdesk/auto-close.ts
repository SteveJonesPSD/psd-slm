import { SupabaseClient } from '@supabase/supabase-js'
import { calculateElapsedBusinessMinutes, calculateSlaDeadline } from '@/lib/sla'
import type { SlaPlan } from '@/types/database'

/** Default business-hours SLA plan used for auto-close calculations */
const DEFAULT_SLA_PLAN: SlaPlan = {
  id: 'auto-close-default',
  org_id: '',
  name: 'Auto-Close Default',
  description: null,
  business_hours_start: '08:00',
  business_hours_end: '17:30',
  business_days: [1, 2, 3, 4, 5],
  is_24x7: false,
  is_default: false,
  is_active: true,
  created_at: '',
  updated_at: '',
}

interface AutoCloseResult {
  processed: number
  closed: number
  warned: number
}

/**
 * Check if the remaining business hours until auto-close fall entirely
 * within business days (no weekend gap). If a weekend falls within the
 * remaining window, we skip the warning to avoid confusing timing.
 */
function isEntirelyWithinBusinessDays(fromDate: Date, businessHours: number): boolean {
  const deadlineDate = calculateSlaDeadline(fromDate, businessHours * 60, DEFAULT_SLA_PLAN)

  // Walk day-by-day from fromDate to deadline, checking for weekends
  const d = new Date(fromDate)
  d.setHours(0, 0, 0, 0)
  const end = new Date(deadlineDate)
  end.setHours(23, 59, 59, 999)

  while (d <= end) {
    const day = d.getDay()
    if (day === 0 || day === 6) return false
    d.setDate(d.getDate() + 1)
  }
  return true
}

/**
 * Process auto-close for all qualifying tickets in an organisation.
 * Called via fire-and-forget from the helpdesk queue page.
 */
export async function processAutoClose(
  supabase: SupabaseClient,
  orgId: string
): Promise<AutoCloseResult> {
  const result: AutoCloseResult = { processed: 0, closed: 0, warned: 0 }

  // 1. Read auto-close settings
  const { data: settings } = await supabase
    .from('org_settings')
    .select('setting_key, setting_value')
    .eq('org_id', orgId)
    .eq('category', 'helpdesk')
    .in('setting_key', ['auto_close_enabled', 'auto_close_hours', 'auto_close_warning_hours'])

  const settingsMap: Record<string, string> = {}
  for (const s of settings || []) {
    settingsMap[s.setting_key] = String(s.setting_value ?? '')
  }

  // Default to enabled if not configured
  const enabled = settingsMap.auto_close_enabled !== 'false'
  if (!enabled) return result

  const closeAfterHours = parseInt(settingsMap.auto_close_hours || '48', 10)
  const warningHours = parseInt(settingsMap.auto_close_warning_hours || '24', 10)
  const closeAfterMinutes = closeAfterHours * 60
  const warningThresholdMinutes = (closeAfterHours - warningHours) * 60

  // 2. Fetch qualifying tickets
  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, ticket_number, waiting_since, auto_close_warning_sent_at')
    .eq('org_id', orgId)
    .eq('status', 'waiting_on_customer')
    .eq('hold_open', false)
    .not('waiting_since', 'is', null)

  if (!tickets || tickets.length === 0) return result

  const now = new Date()

  for (const ticket of tickets) {
    result.processed++
    const waitingSince = new Date(ticket.waiting_since)
    const elapsed = calculateElapsedBusinessMinutes(waitingSince, now, DEFAULT_SLA_PLAN)

    // 3. Auto-close if past threshold
    if (elapsed >= closeAfterMinutes) {
      // Close the ticket
      const closeNow = new Date()
      await supabase
        .from('tickets')
        .update({
          status: 'closed',
          closed_at: closeNow.toISOString(),
          resolved_at: closeNow.toISOString(),
          waiting_since: null,
          auto_close_warning_sent_at: null,
          updated_at: closeNow.toISOString(),
        })
        .eq('id', ticket.id)

      // Add system message
      await supabase.from('ticket_messages').insert({
        ticket_id: ticket.id,
        sender_type: 'system',
        sender_name: null,
        body: `Ticket automatically closed after ${closeAfterHours} business hours without customer response.`,
        is_internal: false,
      })

      result.closed++
      continue
    }

    // 4. Warning if approaching threshold and not already warned
    if (
      elapsed >= warningThresholdMinutes &&
      !ticket.auto_close_warning_sent_at
    ) {
      // Check if remaining hours fall entirely within business days
      if (!isEntirelyWithinBusinessDays(now, warningHours)) {
        // Weekend gap — skip warning for now, re-evaluate next cycle
        continue
      }

      // Send warning
      await supabase
        .from('tickets')
        .update({
          auto_close_warning_sent_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', ticket.id)

      const remainingHours = closeAfterHours - Math.floor(elapsed / 60)
      await supabase.from('ticket_messages').insert({
        ticket_id: ticket.id,
        sender_type: 'system',
        sender_name: null,
        body: `Auto-close warning: This ticket will be automatically closed in approximately ${remainingHours} business hours if no customer response is received.`,
        is_internal: true,
      })

      result.warned++
    }
  }

  return result
}
