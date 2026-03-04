// =============================================================================
// Mail Poller
// Orchestrates poll cycles: fetches messages, routes to handlers, updates cursors.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { MailChannelWithConnection, ProcessedEmail, PollResult } from './types'
import { GraphClient } from './graph-client'
import { getHandler } from './mail-router'
import { getHeader, parseReferences } from './email-utils'

/**
 * Poll all active mail channels for an organisation.
 * Uses admin Supabase client (bypasses RLS).
 */
export async function pollMailChannels(
  supabase: SupabaseClient,
  orgId: string
): Promise<PollResult[]> {
  // Fetch active channels with their connection details
  const { data: channels, error } = await supabase
    .from('mail_channels')
    .select('*, mail_connections(*)')
    .eq('org_id', orgId)
    .eq('is_active', true)

  if (error || !channels || channels.length === 0) {
    return []
  }

  const results: PollResult[] = []

  for (const channel of channels as MailChannelWithConnection[]) {
    // Check if enough time has elapsed since last poll
    if (channel.last_poll_at) {
      const elapsed = (Date.now() - new Date(channel.last_poll_at).getTime()) / 1000
      if (elapsed < channel.poll_interval_seconds * 0.8) {
        continue // Too soon to poll again
      }
    }

    const result = await pollChannel(supabase, orgId, channel)
    results.push(result)
  }

  return results
}

async function pollChannel(
  supabase: SupabaseClient,
  orgId: string,
  channel: MailChannelWithConnection
): Promise<PollResult> {
  const result: PollResult = {
    channelId: channel.id,
    messagesFound: 0,
    messagesProcessed: 0,
    messagesSkipped: 0,
    messagesRejected: 0,
    errors: [],
    rejections: [],
  }

  // Start processing log entry
  const { data: logEntry } = await supabase
    .from('mail_processing_log')
    .insert({
      org_id: orgId,
      channel_id: channel.id,
      poll_started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  const logId = logEntry?.id

  try {
    const connection = channel.mail_connections
    if (!connection || !connection.is_active) {
      throw new Error('Mail connection is not active')
    }

    const client = new GraphClient(connection)

    // Fetch messages since the last processed message
    const since = channel.last_message_at || null
    const messages = await client.listMessages(channel.mailbox_address, since, 50)

    result.messagesFound = messages.length

    if (messages.length === 0) {
      // Update last_poll_at even with no messages
      await supabase
        .from('mail_channels')
        .update({
          last_poll_at: new Date().toISOString(),
          error_count: 0,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', channel.id)

      await finishLog(supabase, logId, result)
      return result
    }

    // Get the handler for this channel
    const handler = getHandler(channel.handler)
    if (!handler) {
      throw new Error(`No handler registered for '${channel.handler}'`)
    }

    let latestMessageTime = channel.last_message_at

    for (const msg of messages) {
      // Skip our own outbound emails (acks and agent replies sent from this mailbox)
      const senderAddress = msg.from?.emailAddress?.address?.toLowerCase() || ''
      if (senderAddress === channel.mailbox_address.toLowerCase()) {
        result.messagesSkipped++
        // Mark as read so it doesn't reappear next poll
        await client.markAsRead(channel.mailbox_address, msg.id).catch(() => {})
        // Track time even for skipped
        if (!latestMessageTime || msg.receivedDateTime > latestMessageTime) {
          latestMessageTime = msg.receivedDateTime
        }
        continue
      }

      // Skip messages we've already processed (duplicate detection)
      const { data: existing } = await supabase
        .from('ticket_emails')
        .select('id')
        .eq('org_id', orgId)
        .eq('graph_message_id', msg.id)
        .maybeSingle()

      if (existing) {
        result.messagesSkipped++
        continue
      }

      try {
        // Build processed email
        const processedEmail = await buildProcessedEmail(client, channel, msg)

        // Route to handler
        const handlerResult = await handler(processedEmail, channel, orgId, supabase)

        if (handlerResult.action === 'error') {
          result.errors.push({ messageId: msg.id, error: handlerResult.notes })
        } else if (handlerResult.action === 'rejected') {
          result.messagesRejected++
          result.rejections.push({ messageId: msg.id, reason: handlerResult.notes })
        } else {
          result.messagesProcessed++
        }

        // Mark as read in Graph
        await client.markAsRead(channel.mailbox_address, msg.id).catch(() => {
          // Non-blocking — marking as read is best-effort
        })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        result.errors.push({ messageId: msg.id, error: errorMessage })
      }

      // Track the latest message time
      if (!latestMessageTime || msg.receivedDateTime > latestMessageTime) {
        latestMessageTime = msg.receivedDateTime
      }
    }

    // Update channel sync state
    await supabase
      .from('mail_channels')
      .update({
        last_poll_at: new Date().toISOString(),
        last_message_at: latestMessageTime,
        error_count: 0,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', channel.id)

    // Update connection last_token_at
    await supabase
      .from('mail_connections')
      .update({
        last_token_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id)

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'

    // Increment error count on channel
    await supabase
      .from('mail_channels')
      .update({
        last_poll_at: new Date().toISOString(),
        error_count: (channel.error_count || 0) + 1,
        last_error: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', channel.id)

    result.errors.push({ messageId: 'channel', error: errorMessage })
  }

  await finishLog(supabase, logId, result)
  return result
}

async function buildProcessedEmail(
  client: GraphClient,
  channel: MailChannelWithConnection,
  msg: import('./types').GraphMessage
): Promise<ProcessedEmail> {
  // Get headers if not already included
  let inReplyTo = getHeader(msg.internetMessageHeaders, 'In-Reply-To')
  let references = parseReferences(getHeader(msg.internetMessageHeaders, 'References'))

  // If headers weren't included in the list response, fetch them separately
  if (!msg.internetMessageHeaders) {
    const headers = await client.getMessageHeaders(channel.mailbox_address, msg.id)
    inReplyTo = getHeader(headers, 'In-Reply-To')
    references = parseReferences(getHeader(headers, 'References'))
  }

  // Fetch attachments if the message has them
  let attachments: import('./types').GraphAttachment[] = []
  if (msg.hasAttachments) {
    attachments = await client.getAttachments(channel.mailbox_address, msg.id)
  }

  return {
    graphMessage: msg,
    attachments,
    inReplyTo,
    references,
  }
}

async function finishLog(
  supabase: SupabaseClient,
  logId: string | undefined,
  result: PollResult
): Promise<void> {
  if (!logId) return

  await supabase
    .from('mail_processing_log')
    .update({
      poll_ended_at: new Date().toISOString(),
      messages_found: result.messagesFound,
      messages_processed: result.messagesProcessed,
      messages_skipped: result.messagesSkipped,
      messages_rejected: result.messagesRejected,
      errors: result.errors,
      rejections: result.rejections,
    })
    .eq('id', logId)
}
