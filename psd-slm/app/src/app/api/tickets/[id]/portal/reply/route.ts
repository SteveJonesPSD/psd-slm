import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotifications } from '@/lib/notifications'

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()

  const formData = await request.formData()
  const token = formData.get('token') as string
  const message = formData.get('message') as string
  const senderName = formData.get('sender_name') as string

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  }

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  if (!senderName?.trim()) {
    return NextResponse.json({ error: 'Your name is required' }, { status: 400 })
  }

  // Validate token matches ticket
  const { data: ticket } = await supabase
    .from('tickets')
    .select('id, org_id, ticket_number, status, portal_token, assigned_to, resolved_at')
    .eq('id', id)
    .eq('portal_token', token)
    .single()

  if (!ticket) {
    return NextResponse.json({ error: 'Invalid ticket or token' }, { status: 404 })
  }

  // Reject if closed or cancelled
  if (ticket.status === 'closed' || ticket.status === 'cancelled') {
    return NextResponse.json({ error: 'This ticket is closed and cannot accept replies' }, { status: 400 })
  }

  // Insert the message
  const { data: msg, error: msgError } = await supabase
    .from('ticket_messages')
    .insert({
      ticket_id: id,
      sender_type: 'customer',
      sender_name: senderName.trim(),
      body: message.trim(),
      is_internal: false,
      channel: 'magic_link',
    })
    .select('id')
    .single()

  if (msgError || !msg) {
    return NextResponse.json({ error: msgError?.message || 'Failed to send message' }, { status: 500 })
  }

  // Handle file uploads
  const files = formData.getAll('files') as File[]
  for (const file of files) {
    if (!file || file.size === 0) continue

    if (file.size > MAX_FILE_SIZE) continue
    if (!ALLOWED_MIME_TYPES.includes(file.type)) continue

    const ext = file.name.split('.').pop() || 'bin'
    const storagePath = `${ticket.org_id}/${id}/${msg.id}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('ticket-attachments')
      .upload(storagePath, file, { contentType: file.type })

    if (!uploadError) {
      await supabase.from('ticket_attachments').insert({
        ticket_id: id,
        message_id: msg.id,
        file_name: file.name,
        file_path: storagePath,
        file_size: file.size,
        mime_type: file.type,
      })
    }
  }

  // Status transitions
  const now = new Date().toISOString()
  const updates: Record<string, unknown> = { updated_at: now }

  if (ticket.status === 'waiting_on_customer') {
    updates.status = 'open'
    updates.waiting_since = null
    updates.auto_close_warning_sent_at = null
    // Add system message for the transition
    await supabase.from('ticket_messages').insert({
      ticket_id: id,
      sender_type: 'system',
      sender_name: null,
      body: 'Customer replied — ticket reopened',
      is_internal: false,
    })
  } else if (ticket.status === 'resolved') {
    updates.status = 'open'
    updates.resolved_at = null
    await supabase.from('ticket_messages').insert({
      ticket_id: id,
      sender_type: 'system',
      sender_name: null,
      body: 'Customer replied — ticket reopened from resolved',
      is_internal: false,
    })
  }

  await supabase.from('tickets').update(updates).eq('id', id)

  // Notify assigned agent + watchers
  const userIds = new Set<string>()
  if (ticket.assigned_to) userIds.add(ticket.assigned_to)

  const { data: watchers } = await supabase
    .from('ticket_watchers')
    .select('user_id')
    .eq('ticket_id', id)

  if (watchers) {
    for (const w of watchers) userIds.add(w.user_id)
  }

  if (userIds.size > 0) {
    const notifications = Array.from(userIds).map((userId) => ({
      supabase,
      orgId: ticket.org_id,
      userId,
      type: 'ticket_customer_reply',
      title: 'Customer Reply',
      message: `${senderName.trim()} replied to ${ticket.ticket_number} via magic link`,
      link: `/helpdesk/tickets/${id}`,
      entityType: 'ticket',
      entityId: id,
    }))

    createNotifications(notifications)
  }

  return NextResponse.json({ success: true })
}
