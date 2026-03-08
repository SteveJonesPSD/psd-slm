'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'
import type {
  OjiStatus,
  OjiPriority,
  OnsiteJobItem,
  OnsiteJobAuditEntry,
  OnsiteJobCategory,
  CreateOjiInput,
  PushTicketToOjiInput,
} from '@/lib/onsite-jobs/types'
import { canTransition } from '@/lib/onsite-jobs/types'

// ============================================================================
// HELPERS
// ============================================================================

async function writeAudit(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  itemId: string,
  action: string,
  actorType: 'portal_user' | 'internal_user' | 'system',
  actorUserId?: string | null,
  actorPortalUserId?: string | null,
  oldValue?: string | null,
  newValue?: string | null,
  note?: string | null,
) {
  supabase
    .from('onsite_job_audit')
    .insert({
      org_id: orgId,
      onsite_job_item_id: itemId,
      action,
      actor_type: actorType,
      actor_user_id: actorUserId || null,
      actor_portal_user_id: actorPortalUserId || null,
      old_value: oldValue || null,
      new_value: newValue || null,
      note: note || null,
    })
    .then(({ error }) => {
      if (error) console.error('[oji-audit]', error.message)
    })
}

async function autoLinkVisit(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  itemId: string,
  customerId: string,
): Promise<{ visit_date: string; start_time: string | null } | null> {
  try {
    const today = new Date().toISOString().split('T')[0]
    const { data: visit } = await supabase
      .from('visit_instances')
      .select('id, visit_date, start_time')
      .eq('customer_id', customerId)
      .in('status', ['scheduled', 'confirmed'])
      .gte('visit_date', today)
      .order('visit_date', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (visit) {
      await supabase
        .from('onsite_job_items')
        .update({ visit_instance_id: visit.id })
        .eq('id', itemId)

      writeAudit(supabase, orgId, itemId, 'visit_linked', 'system', null, null, null, visit.visit_date)
      return { visit_date: visit.visit_date, start_time: visit.start_time }
    }
  } catch (err) {
    console.error('[oji] auto-link visit failed:', err)
  }
  return null
}

async function sendOjiEmail(
  orgId: string,
  toAddress: string,
  toName: string | undefined,
  subject: string,
  bodyHtml: string,
) {
  try {
    const adminClient = createAdminClient()
    const { data: channel } = await adminClient
      .from('mail_channels')
      .select('mailbox_address, mail_connections(*)')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (!channel?.mail_connections) {
      console.warn('[oji-email] No active mail channel for org', orgId)
      return
    }

    const { GraphClient } = await import('@/lib/email/graph-client')
    const client = new GraphClient(channel.mail_connections as never)

    await client.sendMail(channel.mailbox_address, {
      to: [{ address: toAddress, name: toName }],
      subject,
      bodyHtml,
    })
  } catch (err) {
    console.error('[oji-email] Send failed:', err)
  }
}

// ============================================================================
// READ OPERATIONS
// ============================================================================

export async function getOnsiteJobItems(filters?: {
  customerId?: string
  status?: OjiStatus[]
  priority?: OjiPriority[]
}): Promise<{ data?: OnsiteJobItem[]; error?: string }> {
  const user = await requirePermission('onsite_jobs', 'view')
  const supabase = await createClient()

  let query = supabase
    .from('onsite_job_items')
    .select(`
      *,
      customers!onsite_job_items_customer_id_fkey(id, name),
      onsite_job_categories(id, name, colour, is_active, sort_order),
      contacts!onsite_job_items_requested_by_contact_id_fkey(id, first_name, last_name),
      users!onsite_job_items_completed_by_fkey(id, first_name, last_name),
      visit_instances(id, visit_date, start_time),
      source_ticket:tickets!onsite_job_items_source_ticket_id_fkey(id, ticket_number, subject)
    `)
    .eq('org_id', user.orgId)

  if (filters?.customerId) {
    query = query.eq('customer_id', filters.customerId)
  }
  if (filters?.status && filters.status.length > 0) {
    query = query.in('status', filters.status)
  }
  if (filters?.priority && filters.priority.length > 0) {
    query = query.in('priority', filters.priority)
  }

  query = query.order('created_at', { ascending: false })

  const { data, error } = await query

  if (error) return { error: error.message }

  const items = (data || []).map((row: Record<string, unknown>) => ({
    ...row,
    customer: row.customers,
    category: row.onsite_job_categories,
    requested_by_contact: row.contacts,
    completed_by_user: row.users,
    visit_instance: row.visit_instances,
    source_ticket: row.source_ticket,
  })) as unknown as OnsiteJobItem[]

  return { data: items }
}

export async function getOnsiteJobItem(id: string): Promise<{
  data?: OnsiteJobItem & { audit: OnsiteJobAuditEntry[] }
  error?: string
}> {
  const user = await requirePermission('onsite_jobs', 'view')
  const supabase = await createClient()

  const { data: item, error } = await supabase
    .from('onsite_job_items')
    .select(`
      *,
      customers!onsite_job_items_customer_id_fkey(id, name),
      onsite_job_categories(id, name, colour, is_active, sort_order),
      contacts!onsite_job_items_requested_by_contact_id_fkey(id, first_name, last_name),
      users!onsite_job_items_completed_by_fkey(id, first_name, last_name),
      visit_instances(id, visit_date, start_time),
      source_ticket:tickets!onsite_job_items_source_ticket_id_fkey(id, ticket_number, subject),
      escalation_ticket:tickets!onsite_job_items_escalation_ticket_id_fkey(id, ticket_number, subject)
    `)
    .eq('id', id)
    .eq('org_id', user.orgId)
    .single()

  if (error) return { error: error.message }

  const { data: auditRows } = await supabase
    .from('onsite_job_audit')
    .select(`
      *,
      users!onsite_job_audit_actor_user_id_fkey(id, first_name, last_name),
      portal_users!onsite_job_audit_actor_portal_user_id_fkey(id, contact_id, contacts(first_name, last_name))
    `)
    .eq('onsite_job_item_id', id)
    .order('created_at', { ascending: true })

  const mapped = {
    ...item,
    customer: (item as Record<string, unknown>).customers,
    category: (item as Record<string, unknown>).onsite_job_categories,
    requested_by_contact: (item as Record<string, unknown>).contacts,
    completed_by_user: (item as Record<string, unknown>).users,
    visit_instance: (item as Record<string, unknown>).visit_instances,
    source_ticket: (item as Record<string, unknown>).source_ticket,
    escalation_ticket: (item as Record<string, unknown>).escalation_ticket,
    audit: (auditRows || []).map((a: Record<string, unknown>) => ({
      ...a,
      actor_user: a.users,
      actor_portal_user: a.portal_users,
    })),
  } as unknown as OnsiteJobItem & { audit: OnsiteJobAuditEntry[] }

  return { data: mapped }
}

export async function getOnsiteJobCountForCustomer(customerId: string): Promise<number> {
  const user = await requirePermission('onsite_jobs', 'view')
  const supabase = await createClient()

  const { count } = await supabase
    .from('onsite_job_items')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', user.orgId)
    .eq('customer_id', customerId)
    .not('status', 'in', '("complete","cancelled")')

  return count || 0
}

export async function getTotalOpenOjiCount(): Promise<number> {
  const user = await requirePermission('onsite_jobs', 'view')
  const supabase = await createClient()

  const { count } = await supabase
    .from('onsite_job_items')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', user.orgId)
    .not('status', 'in', '("complete","cancelled")')

  return count || 0
}

// ============================================================================
// CREATE
// ============================================================================

export async function createOnsiteJobItem(input: CreateOjiInput): Promise<{ data?: OnsiteJobItem; error?: string }> {
  const user = await requirePermission('onsite_jobs', 'create')
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data, error } = await supabase
    .from('onsite_job_items')
    .insert({
      org_id: user.orgId,
      customer_id: input.customer_id,
      subject: input.subject,
      description: input.description || null,
      room_location: input.room_location || null,
      priority: input.priority || 'medium',
      category_id: input.category_id || null,
      requested_by_contact_id: input.requested_by_contact_id || null,
      on_behalf_of_name: input.on_behalf_of_name || null,
      on_behalf_of_contact_id: input.on_behalf_of_contact_id || null,
      preferred_datetime: input.preferred_datetime || null,
      source_type: input.source_type,
      source_ticket_id: input.source_ticket_id || null,
      created_by_user_id: input.created_by_user_id || user.id,
      created_by_portal_user_id: input.created_by_portal_user_id || null,
      ref_number: '', // trigger generates this
    })
    .select()
    .single()

  if (error) return { error: error.message }

  writeAudit(adminClient, user.orgId, data.id, 'created', 'internal_user', user.id)

  // Auto-link to next visit
  await autoLinkVisit(adminClient, user.orgId, data.id, input.customer_id)

  logActivity({ supabase, user, entityType: 'onsite_job_item', entityId: data.id, action: 'created', details: { subject: input.subject, source_type: input.source_type } })
  revalidatePath('/helpdesk/onsite-jobs')

  return { data: data as unknown as OnsiteJobItem }
}

// Portal version — uses admin client, no requirePermission
export async function createOnsiteJobItemFromPortal(
  input: CreateOjiInput,
  orgId: string,
): Promise<{ data?: OnsiteJobItem; error?: string }> {
  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from('onsite_job_items')
    .insert({
      org_id: orgId,
      customer_id: input.customer_id,
      subject: input.subject,
      description: input.description || null,
      room_location: input.room_location || null,
      priority: input.priority || 'medium',
      category_id: input.category_id || null,
      requested_by_contact_id: input.requested_by_contact_id || null,
      on_behalf_of_name: input.on_behalf_of_name || null,
      on_behalf_of_contact_id: input.on_behalf_of_contact_id || null,
      preferred_datetime: input.preferred_datetime || null,
      source_type: input.source_type,
      source_ticket_id: null,
      created_by_portal_user_id: input.created_by_portal_user_id || null,
      created_by_user_id: null,
      ref_number: '', // trigger generates this
    })
    .select()
    .single()

  if (error) return { error: error.message }

  writeAudit(adminClient, orgId, data.id, 'created', 'portal_user', null, input.created_by_portal_user_id)

  // Auto-link to next visit
  const visit = await autoLinkVisit(adminClient, orgId, data.id, input.customer_id)

  // Send confirmation email (fire-and-forget)
  if (input.created_by_portal_user_id) {
    const { data: pu } = await adminClient
      .from('portal_users')
      .select('contacts(email, first_name, last_name)')
      .eq('id', input.created_by_portal_user_id)
      .single()

    if (pu?.contacts) {
      const contact = pu.contacts as unknown as { email: string; first_name: string; last_name: string }
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
      const visitText = visit
        ? `<p>Your request will be addressed during your next scheduled ICT visit on <strong>${new Date(visit.visit_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>${visit.start_time ? ` at ${visit.start_time}` : ''}.</p>`
        : '<p>A member of our team will be in touch to confirm when this will be addressed.</p>'

      sendOjiEmail(
        orgId,
        contact.email,
        `${contact.first_name} ${contact.last_name}`,
        `Your IT Support Request Has Been Logged — ${data.ref_number}`,
        `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e293b;">IT Support Request Logged</h2>
          <p>Hi ${contact.first_name},</p>
          <p>Your support request has been logged with reference <strong>${data.ref_number}</strong>.</p>
          <table style="margin: 16px 0; border-collapse: collapse;">
            <tr><td style="padding: 4px 12px 4px 0; color: #64748b;">Subject:</td><td style="padding: 4px 0;">${input.subject}</td></tr>
            <tr><td style="padding: 4px 12px 4px 0; color: #64748b;">Priority:</td><td style="padding: 4px 0;">${(input.priority || 'medium').charAt(0).toUpperCase() + (input.priority || 'medium').slice(1)}</td></tr>
            ${input.preferred_datetime ? `<tr><td style="padding: 4px 12px 4px 0; color: #64748b;">Preferred Date:</td><td style="padding: 4px 0;">${new Date(input.preferred_datetime).toLocaleString('en-GB')}</td></tr>` : ''}
          </table>
          ${visitText}
          <p style="margin-top: 24px;"><a href="${siteUrl}/portal/onsite-jobs" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">View Your Request</a></p>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">This is an automated message from your IT support portal.</p>
        </div>`,
      )
    }
  }

  return { data: data as unknown as OnsiteJobItem }
}

// ============================================================================
// STATUS TRANSITIONS
// ============================================================================

export async function updateOnsiteJobStatus(
  id: string,
  newStatus: OjiStatus,
  engineerNote?: string,
): Promise<{ error?: string }> {
  const user = await requirePermission('onsite_jobs', 'edit')
  const supabase = await createClient()

  // Fetch current status
  const { data: current, error: fetchError } = await supabase
    .from('onsite_job_items')
    .select('status, org_id')
    .eq('id', id)
    .eq('org_id', user.orgId)
    .single()

  if (fetchError || !current) return { error: 'Item not found' }

  if (!canTransition(current.status as OjiStatus, newStatus)) {
    return { error: `Cannot transition from ${current.status} to ${newStatus}` }
  }

  if (newStatus === 'complete' && !engineerNote) {
    return { error: 'Engineer notes are required when completing an item' }
  }

  const updates: Record<string, unknown> = { status: newStatus }
  if (newStatus === 'complete') {
    updates.completed_at = new Date().toISOString()
    updates.completed_by = user.id
    if (engineerNote) updates.engineer_notes = engineerNote
  }
  if (engineerNote && newStatus !== 'complete') {
    updates.engineer_notes = engineerNote
  }

  const { error } = await supabase
    .from('onsite_job_items')
    .update(updates)
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  const adminClient = createAdminClient()
  writeAudit(adminClient, user.orgId, id, 'status_changed', 'internal_user', user.id, null, current.status, newStatus)

  if (engineerNote) {
    writeAudit(adminClient, user.orgId, id, 'engineer_note', 'internal_user', user.id, null, null, engineerNote)
  }

  logActivity({ supabase, user, entityType: 'onsite_job_item', entityId: id, action: 'status_changed', details: { from: current.status, to: newStatus } })
  revalidatePath('/helpdesk/onsite-jobs')
  revalidatePath(`/helpdesk/onsite-jobs/${id}`)

  return {}
}

// ============================================================================
// ENGINEER NOTES
// ============================================================================

export async function addEngineerNote(id: string, note: string): Promise<{ error?: string }> {
  const user = await requirePermission('onsite_jobs', 'edit')
  const supabase = await createClient()

  const { error } = await supabase
    .from('onsite_job_items')
    .update({ engineer_notes: note })
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  const adminClient = createAdminClient()
  writeAudit(adminClient, user.orgId, id, 'engineer_note', 'internal_user', user.id, null, null, note)

  logActivity({ supabase, user, entityType: 'onsite_job_item', entityId: id, action: 'note_added' })
  revalidatePath(`/helpdesk/onsite-jobs/${id}`)

  return {}
}

// ============================================================================
// NOTIFY SALES
// ============================================================================

export async function notifySales(id: string): Promise<{ error?: string }> {
  const user = await requirePermission('onsite_jobs', 'notify_sales')
  const supabase = await createClient()

  // Check idempotency
  const { data: item, error: fetchError } = await supabase
    .from('onsite_job_items')
    .select('notify_sales_at, subject, engineer_notes, org_id, customer_id, customers!onsite_job_items_customer_id_fkey(name)')
    .eq('id', id)
    .eq('org_id', user.orgId)
    .single()

  if (fetchError || !item) return { error: 'Item not found' }
  if (item.notify_sales_at) return {} // Already sent

  // Set notify_sales_at
  const { error } = await supabase
    .from('onsite_job_items')
    .update({ notify_sales_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  const adminClient = createAdminClient()
  writeAudit(adminClient, user.orgId, id, 'sales_notified', 'internal_user', user.id)

  // Get sales alert email from org_settings
  const { data: setting } = await adminClient
    .from('org_settings')
    .select('setting_value')
    .eq('org_id', user.orgId)
    .eq('setting_key', 'sales_alert_email')
    .maybeSingle()

  const salesEmail = setting?.setting_value ? JSON.parse(setting.setting_value) : null
  const customerName = ((item as Record<string, unknown>).customers as Record<string, unknown>)?.name as string || 'Unknown'

  if (salesEmail) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    sendOjiEmail(
      user.orgId,
      salesEmail,
      undefined,
      `Onsite Alert — ${customerName} — ${item.subject}`,
      `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e293b;">Onsite Sales Alert</h2>
        <table style="margin: 16px 0; border-collapse: collapse;">
          <tr><td style="padding: 4px 12px 4px 0; color: #64748b;">Customer:</td><td style="padding: 4px 0;"><strong>${customerName}</strong></td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #64748b;">Subject:</td><td style="padding: 4px 0;">${item.subject}</td></tr>
          ${item.engineer_notes ? `<tr><td style="padding: 4px 12px 4px 0; color: #64748b; vertical-align: top;">Notes:</td><td style="padding: 4px 0;">${item.engineer_notes}</td></tr>` : ''}
        </table>
        <p><a href="${siteUrl}/helpdesk/onsite-jobs/${id}" style="background-color: #f59e0b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">View in Engage</a></p>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">This alert was triggered by ${user.firstName} ${user.lastName} during an onsite visit.</p>
      </div>`,
    )
  }

  logActivity({ supabase, user, entityType: 'onsite_job_item', entityId: id, action: 'sales_notified' })
  revalidatePath(`/helpdesk/onsite-jobs/${id}`)

  return {}
}

// ============================================================================
// PUSH TICKET TO OJI
// ============================================================================

export async function pushTicketToOji(input: PushTicketToOjiInput): Promise<{ data?: OnsiteJobItem; error?: string }> {
  const user = await requirePermission('onsite_jobs', 'push_ticket')
  // Also verify helpdesk.edit
  if (!user.permissions.includes('helpdesk.edit')) {
    return { error: 'Permission denied: helpdesk.edit' }
  }

  const supabase = await createClient()
  const adminClient = createAdminClient()

  // Fetch ticket details
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select('id, ticket_number, subject, customer_id, contact_id, org_id, contacts(email, first_name, last_name)')
    .eq('id', input.ticket_id)
    .eq('org_id', user.orgId)
    .single()

  if (ticketError || !ticket) return { error: 'Ticket not found' }

  // Create OJI
  const { data: oji, error: createError } = await supabase
    .from('onsite_job_items')
    .insert({
      org_id: user.orgId,
      customer_id: ticket.customer_id,
      subject: input.subject,
      description: input.description || null,
      room_location: input.room_location || null,
      priority: input.priority || 'medium',
      category_id: input.category_id || null,
      source_type: 'ticket_push',
      source_ticket_id: ticket.id,
      requested_by_contact_id: ticket.contact_id,
      created_by_user_id: user.id,
      ref_number: '', // trigger generates
    })
    .select()
    .single()

  if (createError || !oji) return { error: createError?.message || 'Failed to create OJI' }

  // Write audit on OJI
  writeAudit(adminClient, user.orgId, oji.id, 'created', 'internal_user', user.id, null, null, null, `Pushed from ticket ${ticket.ticket_number}`)

  // Close the ticket
  await supabase
    .from('tickets')
    .update({
      status: 'closed',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', ticket.id)
    .eq('org_id', user.orgId)

  // Audit on ticket closure
  writeAudit(adminClient, user.orgId, oji.id, 'ticket_closed_source', 'internal_user', user.id, null, ticket.ticket_number, oji.ref_number)

  // Auto-link to next visit
  const visit = await autoLinkVisit(adminClient, user.orgId, oji.id, ticket.customer_id)

  // Send email notification to ticket requester (fire-and-forget)
  const contactArr = ticket.contacts as unknown as { email: string; first_name: string; last_name: string }[] | null
  const contact = contactArr?.[0] ?? null
  if (contact?.email) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const visitText = visit
      ? `<p>The work will be carried out during your next scheduled ICT visit on <strong>${new Date(visit.visit_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>.</p>`
      : '<p>Your ticket has been closed and the work will be carried out during your next scheduled ICT visit.</p>'

    sendOjiEmail(
      user.orgId,
      contact.email,
      `${contact.first_name} ${contact.last_name}`,
      `Your Support Ticket Has Been Moved to Your Onsite Job List — ${oji.ref_number}`,
      `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e293b;">Ticket Moved to Onsite Jobs</h2>
        <p>Hi ${contact.first_name},</p>
        <p>Your support ticket <strong>${ticket.ticket_number}</strong> has been closed and added to your onsite job list as <strong>${oji.ref_number}</strong>.</p>
        ${visitText}
        <p style="margin-top: 24px;"><a href="${siteUrl}/portal/onsite-jobs" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">View Your Onsite Jobs</a></p>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">This is an automated message from your IT support portal.</p>
      </div>`,
    )
  }

  logActivity({ supabase, user, entityType: 'onsite_job_item', entityId: oji.id, action: 'created', details: { source: 'ticket_push', ticket_id: ticket.id, ticket_number: ticket.ticket_number } })
  logActivity({ supabase, user, entityType: 'ticket', entityId: ticket.id, action: 'closed', details: { reason: `Pushed to OJI ${oji.ref_number}` } })

  revalidatePath('/helpdesk/onsite-jobs')
  revalidatePath(`/helpdesk/tickets/${ticket.id}`)

  return { data: oji as unknown as OnsiteJobItem }
}

// ============================================================================
// ESCALATION
// ============================================================================

export async function createEscalation(input: {
  customer_id: string
  description: string
  org_id: string
  created_by_portal_user_id?: string
}): Promise<{ data?: OnsiteJobItem; error?: string }> {
  const adminClient = createAdminClient()

  // Get customer name
  const { data: customer } = await adminClient
    .from('customers')
    .select('name')
    .eq('id', input.customer_id)
    .single()

  const customerName = customer?.name || 'Unknown'

  // Create urgent OJI
  const { data: oji, error: createError } = await adminClient
    .from('onsite_job_items')
    .insert({
      org_id: input.org_id,
      customer_id: input.customer_id,
      subject: `Urgent Onsite Request — ${customerName}`,
      description: input.description,
      priority: 'urgent',
      status: 'escalated',
      source_type: 'escalation',
      created_by_portal_user_id: input.created_by_portal_user_id || null,
      ref_number: '', // trigger generates
    })
    .select()
    .single()

  if (createError || !oji) return { error: createError?.message || 'Failed to create escalation' }

  writeAudit(adminClient, input.org_id, oji.id, 'created', input.created_by_portal_user_id ? 'portal_user' : 'system', null, input.created_by_portal_user_id)
  writeAudit(adminClient, input.org_id, oji.id, 'escalated', input.created_by_portal_user_id ? 'portal_user' : 'system', null, input.created_by_portal_user_id)

  // Auto-create a service desk ticket
  const year = new Date().getFullYear()
  const prefix = `TKT-${year}-`
  const { data: lastTicket } = await adminClient
    .from('tickets')
    .select('ticket_number')
    .eq('org_id', input.org_id)
    .like('ticket_number', `${prefix}%`)
    .order('ticket_number', { ascending: false })
    .limit(1)

  let seq = 1
  if (lastTicket && lastTicket.length > 0) {
    const num = parseInt(lastTicket[0].ticket_number.replace(prefix, ''), 10)
    if (!isNaN(num)) seq = num + 1
  }
  const ticketNumber = `${prefix}${String(seq).padStart(4, '0')}`

  const { data: ticket } = await adminClient
    .from('tickets')
    .insert({
      org_id: input.org_id,
      ticket_number: ticketNumber,
      customer_id: input.customer_id,
      subject: `Urgent Onsite Request — ${customerName}`,
      description: input.description,
      priority: 'urgent',
      status: 'new',
      source: 'portal',
    })
    .select()
    .single()

  if (ticket) {
    await adminClient
      .from('onsite_job_items')
      .update({ escalation_ticket_id: ticket.id })
      .eq('id', oji.id)
  }

  // Send escalation acknowledgement email
  if (input.created_by_portal_user_id) {
    const { data: pu } = await adminClient
      .from('portal_users')
      .select('contacts(email, first_name, last_name)')
      .eq('id', input.created_by_portal_user_id)
      .single()

    if (pu?.contacts) {
      const contact = pu.contacts as unknown as { email: string; first_name: string; last_name: string }

      // Check contract status
      const { data: contract } = await adminClient
        .from('customer_contracts')
        .select('contract_types(includes_onsite)')
        .eq('customer_id', input.customer_id)
        .eq('org_id', input.org_id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

      const contractType = contract?.contract_types as unknown as { includes_onsite: boolean } | null
      const hasOnsiteContract = !!contractType?.includes_onsite
      const chargeWarning = !hasOnsiteContract
        ? '<div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 12px; margin: 16px 0;"><strong>Please note:</strong> Urgent onsite visits are not included in your current support contract and will be arranged as a chargeable call-out. Our team will confirm costs before proceeding.</div>'
        : '<p>Our team will be in touch to arrange the earliest possible attendance or adjust your next scheduled visit.</p>'

      sendOjiEmail(
        input.org_id,
        contact.email,
        `${contact.first_name} ${contact.last_name}`,
        `Urgent Onsite Support Request Received — ${oji.ref_number}`,
        `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #991b1b;">Urgent Support Request Received</h2>
          <p>Hi ${contact.first_name},</p>
          <p>Your urgent onsite support request has been received and logged with reference <strong>${oji.ref_number}</strong>.</p>
          ${chargeWarning}
          <p>A member of our team will contact you shortly.</p>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">This is an automated message from your IT support portal.</p>
        </div>`,
      )
    }
  }

  return { data: oji as unknown as OnsiteJobItem }
}

// ============================================================================
// CANCEL
// ============================================================================

export async function cancelOnsiteJobItem(id: string, reason?: string): Promise<{ error?: string }> {
  const user = await requirePermission('onsite_jobs', 'cancel')
  const supabase = await createClient()

  const { data: item, error: fetchError } = await supabase
    .from('onsite_job_items')
    .select('status, org_id')
    .eq('id', id)
    .eq('org_id', user.orgId)
    .single()

  if (fetchError || !item) return { error: 'Item not found' }

  if (!['pending', 'in_progress'].includes(item.status)) {
    return { error: `Cannot cancel an item with status ${item.status}` }
  }

  const { error } = await supabase
    .from('onsite_job_items')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  const adminClient = createAdminClient()
  writeAudit(adminClient, user.orgId, id, 'cancelled', 'internal_user', user.id, null, item.status, 'cancelled', reason)

  logActivity({ supabase, user, entityType: 'onsite_job_item', entityId: id, action: 'cancelled' })
  revalidatePath('/helpdesk/onsite-jobs')

  return {}
}

// Portal cancel — portal users can only cancel their own pending items
export async function cancelPortalOnsiteJobItem(
  id: string,
  portalUserId: string,
  customerId: string,
  orgId: string,
): Promise<{ error?: string }> {
  const adminClient = createAdminClient()

  const { data: item } = await adminClient
    .from('onsite_job_items')
    .select('status, created_by_portal_user_id')
    .eq('id', id)
    .eq('customer_id', customerId)
    .eq('org_id', orgId)
    .single()

  if (!item) return { error: 'Item not found' }
  if (item.status !== 'pending') return { error: 'Can only cancel pending items' }
  if (item.created_by_portal_user_id !== portalUserId) return { error: 'You can only cancel your own items' }

  const { error } = await adminClient
    .from('onsite_job_items')
    .update({ status: 'cancelled' })
    .eq('id', id)

  if (error) return { error: error.message }

  writeAudit(adminClient, orgId, id, 'cancelled', 'portal_user', null, portalUserId, 'pending', 'cancelled')

  return {}
}

// ============================================================================
// CATEGORY MANAGEMENT (Admin)
// ============================================================================

export async function getOnsiteJobCategories(): Promise<{ data?: OnsiteJobCategory[]; error?: string }> {
  const user = await requirePermission('onsite_jobs', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('onsite_job_categories')
    .select('*')
    .eq('org_id', user.orgId)
    .order('sort_order')

  if (error) return { error: error.message }
  return { data: (data || []) as unknown as OnsiteJobCategory[] }
}

// Public version for portal
export async function getOnsiteJobCategoriesPublic(orgId: string): Promise<OnsiteJobCategory[]> {
  const adminClient = createAdminClient()

  const { data } = await adminClient
    .from('onsite_job_categories')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('sort_order')

  return (data || []) as unknown as OnsiteJobCategory[]
}

export async function createOnsiteJobCategory(input: {
  name: string
  colour?: string
}): Promise<{ data?: OnsiteJobCategory; error?: string }> {
  const user = await requirePermission('onsite_jobs', 'admin')
  const supabase = await createClient()

  // Get next sort_order
  const { data: maxRow } = await supabase
    .from('onsite_job_categories')
    .select('sort_order')
    .eq('org_id', user.orgId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (maxRow?.sort_order || 0) + 1

  const { data, error } = await supabase
    .from('onsite_job_categories')
    .insert({
      org_id: user.orgId,
      name: input.name,
      colour: input.colour || null,
      sort_order: nextOrder,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'onsite_job_category', entityId: data.id, action: 'created', details: { name: input.name } })
  revalidatePath('/helpdesk/onsite-jobs/config')

  return { data: data as unknown as OnsiteJobCategory }
}

export async function updateOnsiteJobCategory(
  id: string,
  input: { name?: string; colour?: string; is_active?: boolean; sort_order?: number },
): Promise<{ error?: string }> {
  const user = await requirePermission('onsite_jobs', 'admin')
  const supabase = await createClient()

  const { error } = await supabase
    .from('onsite_job_categories')
    .update(input)
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'onsite_job_category', entityId: id, action: 'updated' })
  revalidatePath('/helpdesk/onsite-jobs/config')

  return {}
}
