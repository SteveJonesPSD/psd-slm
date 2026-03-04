'use server'

// =============================================================================
// Email Integration Server Actions
// CRUD for mail connections and channels, processing log queries,
// email-related ticket queries.
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'
import type { MailConnection, MailChannel, TicketEmail, MailProcessingLog } from './types'

function requireAdmin(user: { role: { name: string } }) {
  if (!['super_admin', 'admin'].includes(user.role.name)) {
    throw new Error('Admin access required')
  }
}

// =============================================================================
// Mail Connections
// =============================================================================

export async function getMailConnections(): Promise<{ data?: MailConnection[]; error?: string }> {
  const user = await requireAuth()
  requireAdmin(user)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('mail_connections')
    .select('*')
    .eq('org_id', user.orgId)
    .order('created_at')

  if (error) return { error: error.message }

  // Mask client_secret
  const masked = (data || []).map(c => ({
    ...c,
    client_secret: c.client_secret ? maskSecret(c.client_secret) : '',
  }))

  return { data: masked as MailConnection[] }
}

export async function saveMailConnection(formData: {
  tenant_id: string
  client_id: string
  client_secret: string
  name?: string
}, connectionId?: string): Promise<{ data?: MailConnection; error?: string }> {
  const user = await requireAuth()
  requireAdmin(user)
  const supabase = await createClient()

  if (connectionId) {
    // Update existing — only update client_secret if it's not masked
    const updates: Record<string, unknown> = {
      tenant_id: formData.tenant_id,
      client_id: formData.client_id,
      name: formData.name || 'Microsoft 365',
      updated_at: new Date().toISOString(),
    }

    const trimmedSecret = formData.client_secret?.trim()
    if (trimmedSecret) {
      updates.client_secret = trimmedSecret
    }

    const { data, error } = await supabase
      .from('mail_connections')
      .update(updates)
      .eq('id', connectionId)
      .eq('org_id', user.orgId)
      .select()
      .single()

    if (error) return { error: error.message }

    logActivity({
      supabase,
      user,
      entityType: 'mail_connection',
      entityId: connectionId,
      action: 'updated',
      details: { name: formData.name },
    })

    revalidatePath('/settings/email')
    return { data: data as MailConnection }
  }

  // Insert new
  const { data, error } = await supabase
    .from('mail_connections')
    .insert({
      org_id: user.orgId,
      tenant_id: formData.tenant_id.trim(),
      client_id: formData.client_id.trim(),
      client_secret: formData.client_secret.trim(),
      name: formData.name || 'Microsoft 365',
    })
    .select()
    .single()

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'mail_connection',
    entityId: data.id,
    action: 'created',
    details: { name: formData.name },
  })

  revalidatePath('/settings/email')
  return { data: data as MailConnection }
}

export async function deleteMailConnection(connectionId: string): Promise<{ error?: string }> {
  const user = await requireAuth()
  requireAdmin(user)
  const supabase = await createClient()

  const { error } = await supabase
    .from('mail_connections')
    .delete()
    .eq('id', connectionId)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'mail_connection',
    entityId: connectionId,
    action: 'deleted',
  })

  revalidatePath('/settings/email')
  return {}
}

// =============================================================================
// Mail Channels
// =============================================================================

export async function getMailChannels(): Promise<{ data?: MailChannel[]; error?: string }> {
  const user = await requireAuth()
  requireAdmin(user)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('mail_channels')
    .select('*')
    .eq('org_id', user.orgId)
    .order('created_at')

  if (error) return { error: error.message }
  return { data: (data || []) as MailChannel[] }
}

export async function saveMailChannel(formData: {
  connection_id: string
  mailbox_address: string
  handler: 'helpdesk' | 'purchasing' | 'sales'
  display_name?: string
  poll_interval_seconds?: number
}, channelId?: string): Promise<{ data?: MailChannel; error?: string }> {
  const user = await requireAuth()
  requireAdmin(user)
  const supabase = await createClient()

  if (channelId) {
    const { data, error } = await supabase
      .from('mail_channels')
      .update({
        connection_id: formData.connection_id,
        mailbox_address: formData.mailbox_address,
        handler: formData.handler,
        display_name: formData.display_name || null,
        poll_interval_seconds: formData.poll_interval_seconds || 60,
        updated_at: new Date().toISOString(),
      })
      .eq('id', channelId)
      .eq('org_id', user.orgId)
      .select()
      .single()

    if (error) return { error: error.message }

    logActivity({
      supabase,
      user,
      entityType: 'mail_channel',
      entityId: channelId,
      action: 'updated',
      details: { mailbox_address: formData.mailbox_address },
    })

    revalidatePath('/settings/email')
    return { data: data as MailChannel }
  }

  const { data, error } = await supabase
    .from('mail_channels')
    .insert({
      org_id: user.orgId,
      connection_id: formData.connection_id,
      mailbox_address: formData.mailbox_address,
      handler: formData.handler,
      display_name: formData.display_name || null,
      poll_interval_seconds: formData.poll_interval_seconds || 60,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'mail_channel',
    entityId: data.id,
    action: 'created',
    details: { mailbox_address: formData.mailbox_address },
  })

  revalidatePath('/settings/email')
  return { data: data as MailChannel }
}

export async function toggleChannelActive(channelId: string, isActive: boolean): Promise<{ error?: string }> {
  const user = await requireAuth()
  requireAdmin(user)
  const supabase = await createClient()

  const { error } = await supabase
    .from('mail_channels')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', channelId)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'mail_channel',
    entityId: channelId,
    action: isActive ? 'activated' : 'paused',
  })

  revalidatePath('/settings/email')
  return {}
}

export async function deleteMailChannel(channelId: string): Promise<{ error?: string }> {
  const user = await requireAuth()
  requireAdmin(user)
  const supabase = await createClient()

  const { error } = await supabase
    .from('mail_channels')
    .delete()
    .eq('id', channelId)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'mail_channel',
    entityId: channelId,
    action: 'deleted',
  })

  revalidatePath('/settings/email')
  return {}
}

// =============================================================================
// Processing Log
// =============================================================================

export async function getProcessingLog(limit: number = 20): Promise<{ data?: MailProcessingLog[]; error?: string }> {
  const user = await requireAuth()
  requireAdmin(user)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('mail_processing_log')
    .select('*')
    .eq('org_id', user.orgId)
    .order('poll_started_at', { ascending: false })
    .limit(limit)

  if (error) return { error: error.message }
  return { data: (data || []) as MailProcessingLog[] }
}

export async function clearProcessingLog(): Promise<{ error?: string }> {
  const user = await requireAuth()
  requireAdmin(user)
  const supabase = await createClient()

  const { error } = await supabase
    .from('mail_processing_log')
    .delete()
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }
  revalidatePath('/settings/email')
  return {}
}

// =============================================================================
// Ticket Email Queries
// =============================================================================

export async function getTicketEmails(ticketId: string): Promise<{ data?: TicketEmail[]; error?: string }> {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ticket_emails')
    .select('*')
    .eq('ticket_id', ticketId)
    .eq('org_id', user.orgId)
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }
  return { data: (data || []) as TicketEmail[] }
}

export async function getTicketEmailContext(ticketId: string): Promise<{
  hasEmailContext: boolean
  recipientAddress?: string
  recipientName?: string | null
  channelId?: string
}> {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data } = await supabase
    .from('ticket_emails')
    .select('from_address, from_name, channel_id')
    .eq('ticket_id', ticketId)
    .eq('org_id', user.orgId)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) {
    return { hasEmailContext: false }
  }

  return {
    hasEmailContext: true,
    recipientAddress: data.from_address,
    recipientName: data.from_name,
    channelId: data.channel_id,
  }
}

// =============================================================================
// Manual Poll Trigger
// =============================================================================

export async function triggerPoll(): Promise<{ results?: unknown[]; error?: string }> {
  const user = await requireAuth()
  requireAdmin(user)

  try {
    const supabase = createAdminClient()
    const { pollMailChannels } = await import('./mail-poller')
    const results = await pollMailChannels(supabase, user.orgId)

    revalidatePath('/settings/email')
    return { results }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Poll trigger failed' }
  }
}

// =============================================================================
// Helpers
// =============================================================================

function maskSecret(value: string): string {
  if (!value || value.length <= 11) return '••••••••'
  return value.substring(0, 7) + '...' + value.substring(value.length - 4)
}
