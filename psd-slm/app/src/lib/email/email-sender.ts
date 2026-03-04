// =============================================================================
// Email Sender
// Sends outbound emails via Microsoft Graph API with proper threading headers.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { GraphClient } from './graph-client'
import type { MailConnection, MailChannel, TicketEmail } from './types'

const TICKET_REF_REGEX = /\[TKT-\d{4}-\d{4,}\]/

interface SendTicketReplyParams {
  orgId: string
  ticketId: string
  ticketNumber: string
  channelId: string
  fromAddress: string
  toAddress: string
  toName?: string
  ccAddresses?: { address: string; name?: string }[]
  subject: string
  bodyHtml: string
  bodyText: string
  userId: string
}

/**
 * Send a ticket reply via email through Microsoft Graph.
 */
export async function sendTicketReply(
  supabase: SupabaseClient,
  params: SendTicketReplyParams
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch the channel and its connection
    const { data: channel } = await supabase
      .from('mail_channels')
      .select('*, mail_connections(*)')
      .eq('id', params.channelId)
      .single()

    if (!channel || !channel.mail_connections) {
      return { success: false, error: 'Mail channel or connection not found' }
    }

    const connection = channel.mail_connections as MailConnection

    // Ensure subject contains ticket reference for threading
    let subject = params.subject
    if (!TICKET_REF_REGEX.test(subject)) {
      // Strip existing Re: prefix before adding our own
      const cleaned = subject.replace(/^Re:\s*/i, '')
      subject = `Re: [${params.ticketNumber}] ${cleaned}`
    }

    // Build References header from the ticket's email chain
    const { data: emailChain } = await supabase
      .from('ticket_emails')
      .select('internet_message_id')
      .eq('ticket_id', params.ticketId)
      .not('internet_message_id', 'is', null)
      .order('created_at', { ascending: true })

    const references = (emailChain || [])
      .map(e => e.internet_message_id)
      .filter(Boolean) as string[]

    // Find the most recent inbound email for In-Reply-To
    const { data: lastInbound } = await supabase
      .from('ticket_emails')
      .select('internet_message_id')
      .eq('ticket_id', params.ticketId)
      .eq('direction', 'inbound')
      .not('internet_message_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const inReplyTo = lastInbound?.internet_message_id || undefined

    // Wrap reply in branded HTML template
    const brandedHtml = wrapInTemplate(params.bodyHtml, params.ticketNumber)

    // Send via Graph API
    const client = new GraphClient(connection)
    await client.sendMail(params.fromAddress, {
      to: [{ address: params.toAddress, name: params.toName }],
      cc: params.ccAddresses,
      subject,
      bodyHtml: brandedHtml,
      inReplyTo,
      references: references.length > 0 ? references : undefined,
    })

    // Record the outbound email
    await supabase.from('ticket_emails').insert({
      org_id: params.orgId,
      ticket_id: params.ticketId,
      channel_id: params.channelId,
      direction: 'outbound',
      from_address: params.fromAddress,
      from_name: 'PSD Group Service Desk',
      to_addresses: [{ address: params.toAddress, name: params.toName }],
      cc_addresses: params.ccAddresses || [],
      subject,
      body_text: params.bodyText,
      body_html: params.bodyHtml,
      has_attachments: false,
      attachments: [],
      sent_at: new Date().toISOString(),
      processing_notes: `Reply sent for ${params.ticketNumber}`,
    })

    return { success: true }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error sending email'
    console.error('[email-sender]', errorMessage)
    return { success: false, error: errorMessage }
  }
}

/**
 * Send an acknowledgement email when a new ticket is created from an inbound email.
 * Fire-and-forget — failures are logged but never block ticket creation.
 */
export async function sendTicketAcknowledgement(
  supabase: SupabaseClient,
  params: {
    orgId: string
    ticketId: string
    ticketNumber: string
    channelId: string
    fromAddress: string    // mailbox address (we send FROM this)
    toAddress: string      // customer email
    toName: string | null
    contactFirstName: string
    originalSubject: string
    inReplyToMessageId: string | null  // internet_message_id of the inbound email
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch the channel and its connection
    const { data: channel } = await supabase
      .from('mail_channels')
      .select('*, mail_connections(*)')
      .eq('id', params.channelId)
      .single()

    if (!channel || !channel.mail_connections) {
      return { success: false, error: 'Mail channel or connection not found' }
    }

    const connection = channel.mail_connections as MailConnection

    // Build subject with ticket reference
    const cleanSubject = params.originalSubject.replace(/^Re:\s*/i, '')
    const subject = `[${params.ticketNumber}] Re: ${cleanSubject}`

    // Build acknowledgement body
    const bodyHtml = buildAckHtml(params.contactFirstName, params.ticketNumber, params.originalSubject)

    // Threading headers — reply to the original inbound email
    const inReplyTo = params.inReplyToMessageId || undefined
    const references = params.inReplyToMessageId ? [params.inReplyToMessageId] : undefined

    // Send via Graph API
    const client = new GraphClient(connection)
    await client.sendMail(params.fromAddress, {
      to: [{ address: params.toAddress, name: params.toName || undefined }],
      subject,
      bodyHtml,
      inReplyTo,
      references,
    })

    // Record the outbound acknowledgement
    await supabase.from('ticket_emails').insert({
      org_id: params.orgId,
      ticket_id: params.ticketId,
      channel_id: params.channelId,
      direction: 'outbound',
      from_address: params.fromAddress,
      from_name: 'PSD Group Service Desk',
      to_addresses: [{ address: params.toAddress, name: params.toName }],
      cc_addresses: [],
      subject,
      body_text: `Hi ${params.contactFirstName}, Thank you for contacting PSD Group IT Support. Your request has been logged as ticket ${params.ticketNumber}.`,
      body_html: bodyHtml,
      has_attachments: false,
      attachments: [],
      sent_at: new Date().toISOString(),
      processing_notes: `Acknowledgement sent for ${params.ticketNumber}`,
    })

    return { success: true }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error sending acknowledgement'
    console.error('[email-sender] Ack failed:', errorMessage)
    return { success: false, error: errorMessage }
  }
}

/**
 * Build the HTML body for a ticket acknowledgement email.
 */
function buildAckHtml(firstName: string, ticketNumber: string, originalSubject: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.6; margin: 0; padding: 0; }
  .container { max-width: 640px; margin: 0 auto; padding: 24px; }
  .content { margin-bottom: 24px; }
  .footer { border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px; font-size: 12px; color: #94a3b8; }
  .ref { font-size: 11px; color: #94a3b8; margin-top: 8px; }
</style>
</head>
<body>
<div class="container">
  <div class="content">
    <p>Hi ${firstName},</p>
    <p>Thank you for contacting PSD Group IT Support. Your request has been logged as ticket <strong>${ticketNumber}</strong>.</p>
    <p><strong>Subject:</strong> ${originalSubject}</p>
    <p>A member of our team will review your request and get back to you shortly. You can reply to this email to add more information to your ticket.</p>
    <p>Kind regards,<br>PSD Group IT Support</p>
  </div>
  <div class="footer">
    <p>PSD Group Service Desk</p>
    <p class="ref">Reference: ${ticketNumber} — Please do not change the subject line to ensure your reply reaches the right ticket.</p>
  </div>
</div>
</body>
</html>`
}

/**
 * Find the email channel and recipient for a ticket.
 * Returns null if the ticket has no email context.
 */
export async function getTicketEmailContext(
  supabase: SupabaseClient,
  ticketId: string
): Promise<{
  channelId: string
  fromAddress: string
  toAddress: string
  toName: string | null
  subject: string
} | null> {
  // Get the most recent inbound email for this ticket
  const { data: lastEmail } = await supabase
    .from('ticket_emails')
    .select('channel_id, from_address, from_name, subject, mail_channels(mailbox_address)')
    .eq('ticket_id', ticketId)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lastEmail || !lastEmail.channel_id) return null

  const mailChannel = lastEmail.mail_channels as unknown as { mailbox_address: string } | null

  return {
    channelId: lastEmail.channel_id,
    fromAddress: mailChannel?.mailbox_address || '',
    toAddress: lastEmail.from_address,
    toName: lastEmail.from_name,
    subject: lastEmail.subject || '',
  }
}

/**
 * Wrap email body in a branded HTML template.
 */
function wrapInTemplate(bodyHtml: string, ticketNumber: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.6; margin: 0; padding: 0; }
  .container { max-width: 640px; margin: 0 auto; padding: 24px; }
  .content { margin-bottom: 24px; }
  .footer { border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px; font-size: 12px; color: #94a3b8; }
  .footer a { color: #6366f1; text-decoration: none; }
  .ref { font-size: 11px; color: #94a3b8; margin-top: 8px; }
</style>
</head>
<body>
<div class="container">
  <div class="content">
    ${bodyHtml}
  </div>
  <div class="footer">
    <p>PSD Group Service Desk</p>
    <p class="ref">Reference: ${ticketNumber} — Please do not change the subject line to ensure your reply reaches the right ticket.</p>
  </div>
</div>
</body>
</html>`
}
