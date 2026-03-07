import { SupabaseClient } from '@supabase/supabase-js'
import { calculateElapsedBusinessMinutes, calculateSlaDeadline } from '@/lib/sla'
import type { SlaPlan } from '@/types/database'
import Anthropic from '@anthropic-ai/sdk'

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
  nudged: number
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
  const result: AutoCloseResult = { processed: 0, closed: 0, warned: 0, nudged: 0 }

  // 1. Read auto-close settings + helen nudge settings
  const { data: settings } = await supabase
    .from('org_settings')
    .select('setting_key, setting_value')
    .eq('org_id', orgId)
    .in('category', ['helpdesk', 'helen'])
    .in('setting_key', ['auto_close_enabled', 'auto_close_hours', 'auto_close_warning_hours', 'helen_nudge_enabled', 'helen_nudge_template', 'helen_nudge_guardrails', 'helen_persona', 'helen_guardrails'])

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

  // Auto-nudge config: fires at 50% of auto-close period using calendar time
  const nudgeEnabled = settingsMap.helen_nudge_enabled === 'true'
  const nudgeCalendarMs = (closeAfterHours * 60 * 60 * 1000) / 2 // 50% in milliseconds

  // 2. Fetch qualifying tickets
  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, ticket_number, subject, waiting_since, auto_close_warning_sent_at, auto_nudge_sent_at, customer_id, contact_id, portal_token')
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

    // 2b. Auto-nudge check (calendar time, not business hours)
    if (nudgeEnabled && !ticket.auto_nudge_sent_at) {
      const calendarElapsedMs = now.getTime() - waitingSince.getTime()
      if (calendarElapsedMs >= nudgeCalendarMs) {
        try {
          const nudgeBody = await generateNudge(supabase, orgId, ticket, settingsMap)
          if (nudgeBody) {
            // Build the full message with close link footer
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
            const portalToken = ticket.portal_token
            let fullBody = nudgeBody
            if (portalToken && siteUrl) {
              fullBody += `\n\nIf you feel the issue is now resolved and would prefer to close the ticket, please click the close ticket button below.\n\n---\nClose this ticket: ${siteUrl}/t/${portalToken}/close\nView and reply to this ticket: ${siteUrl}/t/${portalToken}`
            }

            // Send as customer-facing message from Helen
            await supabase.from('ticket_messages').insert({
              ticket_id: ticket.id,
              sender_type: 'agent',
              sender_id: null,
              sender_name: 'Helen (AI Assistant)',
              body: fullBody,
              is_internal: false,
            })

            // Mark nudge as sent but keep waiting_since unchanged — auto-close countdown continues
            await supabase
              .from('tickets')
              .update({
                auto_nudge_sent_at: now.toISOString(),
                updated_at: now.toISOString(),
              })
              .eq('id', ticket.id)

            // Fire-and-forget: send email if ticket originated from email
            sendNudgeEmail(supabase, ticket.id, fullBody, orgId, portalToken).catch(err =>
              console.error('[auto-nudge-email]', err)
            )

            result.nudged++
          }
        } catch (err) {
          console.error('[auto-nudge]', ticket.ticket_number, err)
        }
      }
    }

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
          auto_nudge_sent_at: null,
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

/**
 * Generate an AI nudge message for a ticket, falling back to template if AI fails.
 */
async function generateNudge(
  supabase: SupabaseClient,
  orgId: string,
  ticket: { id: string; ticket_number: string; subject: string; customer_id: string | null; contact_id: string | null },
  settingsMap: Record<string, string>
): Promise<string | null> {
  // Fetch customer and contact names
  let customerName = 'Customer'
  let contactName = 'there'

  if (ticket.customer_id) {
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', ticket.customer_id)
      .single()
    if (company) customerName = company.name
  }

  if (ticket.contact_id) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('first_name, last_name')
      .eq('id', ticket.contact_id)
      .single()
    if (contact) contactName = contact.first_name || contactName
  }

  // Fetch recent messages for context
  const { data: messages } = await supabase
    .from('ticket_messages')
    .select('sender_type, sender_name, body, is_internal, created_at')
    .eq('ticket_id', ticket.id)
    .eq('is_internal', false)
    .order('created_at', { ascending: true })
    .limit(20)

  const conversationHistory = (messages || [])
    .map(m => {
      const role = m.sender_type === 'customer' ? 'Customer' : m.sender_type === 'system' ? 'System' : (m.sender_name || 'Agent')
      const date = new Date(m.created_at).toLocaleString('en-GB')
      return `[${date}] ${role}: ${m.body}`
    })
    .join('\n\n')

  const lastAgentMsg = (messages || []).filter(m => m.sender_type === 'agent').pop()

  try {
    const persona = settingsMap.helen_persona || 'You are Helen, a friendly and professional IT support assistant.'
    const nudgeGuardrails = settingsMap.helen_nudge_guardrails || ''
    const generalGuardrails = settingsMap.helen_guardrails || ''

    const anthropic = new Anthropic()
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: `${persona}\n\n${generalGuardrails ? `## General Guardrails\n${generalGuardrails}\n` : ''}${nudgeGuardrails ? `## Nudge Guardrails\n${nudgeGuardrails}\n` : ''}
## Task
Write a brief, polite follow-up nudge to a customer who hasn't responded to a support ticket. The goal is to check in and encourage a reply.

## Rules
- Use British English
- Write ONLY the body text — no greeting or signature`,
      messages: [{
        role: 'user',
        content: `Ticket: ${ticket.ticket_number}\nSubject: ${ticket.subject}\nCustomer: ${customerName}\nContact: ${contactName}\n\n## Recent conversation\n${conversationHistory}\n\n${lastAgentMsg ? `## Last agent message (awaiting response)\n${lastAgentMsg.body}` : ''}\n\nWrite a brief follow-up nudge.`,
      }],
    })

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    if (text.trim()) return text.trim()
  } catch (err) {
    console.error('[auto-nudge-ai]', err)
  }

  // Fallback to template
  const template = settingsMap.helen_nudge_template || ''
  if (!template) return null

  return template
    .replace(/\{ticket_number\}/g, ticket.ticket_number)
    .replace(/\{subject\}/g, ticket.subject)
    .replace(/\{customer_name\}/g, customerName)
    .replace(/\{contact_name\}/g, contactName)
}

/**
 * Fire-and-forget: send nudge as email if ticket has email context.
 * Includes a styled "Close Ticket" button in the HTML email.
 */
async function sendNudgeEmail(
  supabase: SupabaseClient,
  ticketId: string,
  body: string,
  orgId: string,
  portalToken: string | null
): Promise<void> {
  try {
    const { getTicketEmailContext, sendTicketReply } = await import('@/lib/email/email-sender')

    const emailContext = await getTicketEmailContext(supabase, ticketId)
    if (!emailContext) return

    const { data: ticket } = await supabase
      .from('tickets')
      .select('ticket_number')
      .eq('id', ticketId)
      .single()

    if (!ticket) return

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''

    // Build HTML with close button
    // Strip the close/view links from the body text for HTML (we render them as buttons instead)
    const bodyForHtml = body.split('\n---\n')[0].trim()
    const bodyHtml = `<p>${bodyForHtml.replace(/\n/g, '<br>')}</p>`

    let buttonsHtml = ''
    if (portalToken && siteUrl) {
      buttonsHtml = `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;">
  <tr>
    <td style="padding-right:12px;">
      <a href="${siteUrl}/t/${portalToken}/close" style="display:inline-block;padding:12px 24px;background-color:#059669;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;font-family:Arial,sans-serif;">Close Ticket</a>
    </td>
    <td>
      <a href="${siteUrl}/t/${portalToken}" style="display:inline-block;padding:12px 24px;background-color:#4f46e5;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;font-family:Arial,sans-serif;">View &amp; Reply</a>
    </td>
  </tr>
</table>`
    }

    const fullHtml = `${bodyHtml}${buttonsHtml}`

    await sendTicketReply(supabase, {
      orgId,
      ticketId,
      ticketNumber: ticket.ticket_number,
      channelId: emailContext.channelId,
      fromAddress: emailContext.fromAddress,
      toAddress: emailContext.toAddress,
      toName: emailContext.toName || undefined,
      subject: emailContext.subject,
      bodyHtml: fullHtml,
      bodyText: body,
      userId: 'system-auto-nudge',
    })
  } catch (err) {
    console.error('[nudge-email]', err instanceof Error ? err.message : err)
  }
}
