'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission, requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'
import type { JobStatus, JobTaskTemplate, JobTaskTemplateItem, JobTask, TaskResponseType, GpsCoords, GpsEventType } from '@/types/database'
import { notifyTeamsJobEvent } from '@/lib/teams/teams-notifier'

// ============================================================================
// GPS EVENT LOGGING (fire-and-forget, same pattern as logActivity)
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function logGpsEvent(supabase: any, user: { id: string; orgId: string }, jobId: string, eventType: GpsEventType, gps: GpsCoords | null | undefined, metadata?: Record<string, unknown>): void {
  if (!gps) return
  supabase
    .from('job_gps_log')
    .insert({
      job_id: jobId,
      user_id: user.id,
      org_id: user.orgId,
      event_type: eventType,
      latitude: gps.latitude,
      longitude: gps.longitude,
      accuracy_metres: gps.accuracy ?? null,
      metadata: metadata ?? null,
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) console.error('[gps-log]', error.message)
    })
}

// ============================================================================
// VISIT INSTANCE SYNC (for visit-sourced jobs)
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncVisitFromJob(supabase: any, user: { id: string; orgId: string }, visitId: string, jobStatus: string, notes?: string): Promise<void> {
  if (jobStatus === 'completed') {
    await supabase
      .from('visit_instances')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: user.id,
        completion_notes: notes || 'Completed via scheduling',
        updated_at: new Date().toISOString(),
      })
      .eq('id', visitId)
      .not('status', 'in', '(completed,cancelled)')
  } else if (jobStatus === 'cancelled') {
    await supabase
      .from('visit_instances')
      .update({
        status: 'cancelled',
        cancellation_reason: 'Job cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', visitId)
      .not('status', 'in', '(completed,cancelled)')
  }
}

// ============================================================================
// TEAMS NOTIFICATION HELPER (fire-and-forget)
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fireTeamsNotification(supabase: any, orgId: string, jobId: string, eventType: 'assigned' | 'rescheduled' | 'cancelled', engineerId?: string | null): void {
  // Fetch job + engineer details then fire notification — fully async, never blocks
  Promise.all([
    supabase
      .from('jobs')
      .select('id, job_number, title, internal_notes, scheduled_date, scheduled_time, estimated_duration_minutes, site_address_line1, site_city, site_postcode, assigned_to, company:companies(name)')
      .eq('id', jobId)
      .single(),
    engineerId
      ? supabase.from('users').select('id, full_name, teams_upn').eq('id', engineerId).single()
      : Promise.resolve({ data: null }),
  ]).then(([jobRes, engRes]) => {
    const job = jobRes.data
    if (!job) return
    const eng = engRes.data
    if (!eng && eventType !== 'cancelled') return

    const siteParts = [job.site_address_line1, job.site_city, job.site_postcode].filter(Boolean)
    const siteAddress = siteParts.length > 0 ? siteParts.join(', ') : 'Not specified'

    // Format date
    let scheduledDate = job.scheduled_date || 'TBC'
    if (job.scheduled_date) {
      try {
        scheduledDate = new Date(job.scheduled_date + 'T00:00:00').toLocaleDateString('en-GB', {
          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
        })
      } catch { /* keep raw */ }
    }

    // Format time
    let scheduledTime = job.scheduled_time || 'TBC'
    if (job.scheduled_time && job.estimated_duration_minutes) {
      try {
        const [h, m] = job.scheduled_time.split(':').map(Number)
        const endMinutes = h * 60 + m + job.estimated_duration_minutes
        const endH = Math.floor(endMinutes / 60).toString().padStart(2, '0')
        const endM = (endMinutes % 60).toString().padStart(2, '0')
        scheduledTime = `${job.scheduled_time.substring(0, 5)} – ${endH}:${endM}`
      } catch { /* keep raw */ }
    }

    notifyTeamsJobEvent(orgId, {
      eventType,
      jobRef: job.job_number,
      jobId: job.id,
      customerName: job.company?.name || 'Unknown',
      siteAddress,
      scheduledDate,
      scheduledTime,
      engineerName: eng?.full_name || 'Unassigned',
      engineerUpn: eng?.teams_upn ?? null,
      notes: job.internal_notes ?? undefined,
      engageUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/scheduling/jobs/${job.id}`,
    }).catch(() => {})
  }).catch(() => {})
}

// ============================================================================
// JOB NUMBER GENERATION (shared utility — re-exported for backwards compat)
// ============================================================================

import { generateJobNumber, formatJobNumber } from '@/lib/job-utils'
export { generateJobNumber, formatJobNumber }

// ============================================================================
// JOB TYPES
// ============================================================================

export async function getJobTypes() {
  const user = await requirePermission('scheduling', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('job_types')
    .select('*, task_template:task_template_id(id, name)')
    .eq('org_id', user.orgId)
    .eq('is_active', true)
    .order('sort_order')

  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function getAllJobTypes() {
  const user = await requirePermission('scheduling', 'admin')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('job_types')
    .select('*, task_template:task_template_id(id, name)')
    .eq('org_id', user.orgId)
    .order('sort_order')

  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function createJobType(input: {
  name: string
  slug: string
  color: string
  background: string
  default_duration_minutes: number
  task_template_id?: string | null
  is_active?: boolean
}) {
  const user = await requirePermission('scheduling', 'admin')
  const supabase = await createClient()

  // Get next sort_order
  const { data: existing } = await supabase
    .from('job_types')
    .select('sort_order')
    .eq('org_id', user.orgId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1

  const { data, error } = await supabase
    .from('job_types')
    .insert({
      org_id: user.orgId,
      name: input.name,
      slug: input.slug,
      color: input.color,
      background: input.background,
      default_duration_minutes: input.default_duration_minutes,
      task_template_id: input.task_template_id || null,
      is_active: input.is_active ?? true,
      sort_order: nextOrder,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  logActivity({
    supabase, user,
    entityType: 'job_type', entityId: data.id,
    action: 'created',
    details: { name: input.name },
  })

  revalidatePath('/scheduling')
  revalidatePath('/scheduling/config/job-types')
  return { data }
}

export async function updateJobType(id: string, input: {
  name?: string
  slug?: string
  color?: string
  background?: string
  default_duration_minutes?: number
  task_template_id?: string | null
  is_active?: boolean
}) {
  const user = await requirePermission('scheduling', 'admin')
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {}
  if (input.name !== undefined) updates.name = input.name
  if (input.slug !== undefined) updates.slug = input.slug
  if (input.color !== undefined) updates.color = input.color
  if (input.background !== undefined) updates.background = input.background
  if (input.default_duration_minutes !== undefined) updates.default_duration_minutes = input.default_duration_minutes
  if (input.task_template_id !== undefined) updates.task_template_id = input.task_template_id || null
  if (input.is_active !== undefined) updates.is_active = input.is_active

  const { error } = await supabase
    .from('job_types')
    .update(updates)
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({
    supabase, user,
    entityType: 'job_type', entityId: id,
    action: 'updated',
    details: { changed_fields: Object.keys(updates) },
  })

  revalidatePath('/scheduling')
  revalidatePath('/scheduling/config/job-types')
  return { success: true }
}

export async function deleteJobType(id: string) {
  const user = await requirePermission('scheduling', 'admin')
  const supabase = await createClient()

  // Check if any jobs reference this type
  const { count } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('job_type_id', id)

  if (count && count > 0) {
    return { error: `Cannot delete: ${count} job(s) use this type. Deactivate instead.` }
  }

  const { error } = await supabase
    .from('job_types')
    .delete()
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({
    supabase, user,
    entityType: 'job_type', entityId: id,
    action: 'deleted',
    details: {},
  })

  revalidatePath('/scheduling')
  revalidatePath('/scheduling/config/job-types')
  return { success: true }
}

// ============================================================================
// TASK TEMPLATES
// ============================================================================

export async function getTaskTemplates() {
  const user = await requirePermission('scheduling', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('job_task_templates')
    .select('*, items:job_task_template_items(id)')
    .eq('org_id', user.orgId)
    .order('name')

  if (error) return { error: error.message }

  const templates = (data || []).map(t => ({
    ...t,
    item_count: t.items?.length || 0,
    items: undefined,
  }))

  return { data: templates }
}

export async function getTaskTemplate(id: string) {
  const user = await requirePermission('scheduling', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('job_task_templates')
    .select('*, items:job_task_template_items(*)')
    .eq('id', id)
    .eq('org_id', user.orgId)
    .single()

  if (error) return { error: error.message }

  // Sort items by sort_order
  if (data.items) {
    data.items.sort((a: JobTaskTemplateItem, b: JobTaskTemplateItem) => a.sort_order - b.sort_order)
  }

  return { data }
}

export async function createTaskTemplate(input: {
  name: string
  description?: string
  items: { description: string; is_required: boolean; response_type?: string; sort_order: number }[]
}) {
  const user = await requirePermission('scheduling', 'admin')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('job_task_templates')
    .insert({
      org_id: user.orgId,
      name: input.name,
      description: input.description || null,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Insert items
  if (input.items.length > 0) {
    const { error: itemsError } = await supabase
      .from('job_task_template_items')
      .insert(input.items.map(item => ({
        template_id: data.id,
        description: item.description,
        is_required: item.is_required,
        response_type: item.response_type || 'yes_no',
        sort_order: item.sort_order,
      })))

    if (itemsError) return { error: itemsError.message }
  }

  logActivity({
    supabase, user,
    entityType: 'task_template', entityId: data.id,
    action: 'created',
    details: { name: input.name, item_count: input.items.length },
  })

  revalidatePath('/scheduling/config/task-templates')
  return { data }
}

export async function updateTaskTemplate(id: string, input: {
  name?: string
  description?: string | null
  is_active?: boolean
  items?: { id?: string; description: string; is_required: boolean; response_type?: string; sort_order: number }[]
}) {
  const user = await requirePermission('scheduling', 'admin')
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {}
  if (input.name !== undefined) updates.name = input.name
  if (input.description !== undefined) updates.description = input.description
  if (input.is_active !== undefined) updates.is_active = input.is_active

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from('job_task_templates')
      .update(updates)
      .eq('id', id)
      .eq('org_id', user.orgId)

    if (error) return { error: error.message }
  }

  // Replace items if provided
  if (input.items !== undefined) {
    // Delete existing items
    await supabase
      .from('job_task_template_items')
      .delete()
      .eq('template_id', id)

    // Insert new items
    if (input.items.length > 0) {
      const { error: itemsError } = await supabase
        .from('job_task_template_items')
        .insert(input.items.map(item => ({
          template_id: id,
          description: item.description,
          is_required: item.is_required,
          response_type: item.response_type || 'yes_no',
          sort_order: item.sort_order,
        })))

      if (itemsError) return { error: itemsError.message }
    }
  }

  logActivity({
    supabase, user,
    entityType: 'task_template', entityId: id,
    action: 'updated',
    details: { changed_fields: Object.keys(updates), item_count: input.items?.length },
  })

  revalidatePath('/scheduling/config/task-templates')
  return { success: true }
}

export async function deleteTaskTemplate(id: string) {
  const user = await requirePermission('scheduling', 'admin')
  const supabase = await createClient()

  // Check if any job types reference this template
  const { data: linkedTypes } = await supabase
    .from('job_types')
    .select('id, name')
    .eq('task_template_id', id)
    .eq('org_id', user.orgId)

  if (linkedTypes && linkedTypes.length > 0) {
    return { error: `Cannot delete: linked to job type(s): ${linkedTypes.map(t => t.name).join(', ')}` }
  }

  const { error } = await supabase
    .from('job_task_templates')
    .delete()
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({
    supabase, user,
    entityType: 'task_template', entityId: id,
    action: 'deleted',
    details: {},
  })

  revalidatePath('/scheduling/config/task-templates')
  return { success: true }
}

// ============================================================================
// JOB TASKS (toggle completion)
// ============================================================================

export async function toggleJobTask(taskId: string, opts?: { notes?: string; response_value?: string; gps?: GpsCoords | null }) {
  const user = await requireAuth()
  const supabase = await createClient()

  // Get current task state
  const { data: task, error: fetchError } = await supabase
    .from('job_tasks')
    .select('id, job_id, is_completed, response_type')
    .eq('id', taskId)
    .single()

  if (fetchError || !task) return { error: 'Task not found' }

  // For yes_no: toggle. For text/date: completed = has a response_value
  const isYesNo = task.response_type === 'yes_no'
  const newCompleted = isYesNo ? !task.is_completed : !!opts?.response_value

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {
    is_completed: newCompleted,
    completed_at: newCompleted ? new Date().toISOString() : null,
    completed_by: newCompleted ? user.id : null,
  }
  if (opts?.notes !== undefined) updates.notes = opts.notes || null
  if (opts?.response_value !== undefined) updates.response_value = opts.response_value || null

  const { error } = await supabase
    .from('job_tasks')
    .update(updates)
    .eq('id', taskId)

  if (error) return { error: error.message }

  logGpsEvent(supabase, user, task.job_id, 'task_toggled', opts?.gps, { task_id: taskId, is_completed: newCompleted })

  revalidatePath(`/scheduling/jobs/${task.job_id}`)
  revalidatePath(`/field/job/${task.job_id}`)
  revalidatePath(`/field/job/${task.job_id}/complete`)
  return { success: true, is_completed: newCompleted }
}

// ============================================================================
// ENGINEERS (users in scheduling teams: Infrastructure / Engineering)
// ============================================================================

export async function getEngineers() {
  const user = await requirePermission('scheduling', 'view')
  const supabase = await createClient()

  // Find teams that are used for scheduling (Infrastructure, Engineering)
  const { data: teams } = await supabase
    .from('teams')
    .select('id')
    .eq('org_id', user.orgId)
    .eq('is_active', true)
    .in('slug', ['infrastructure', 'engineering'])

  const teamIds = teams?.map(t => t.id) || []

  if (teamIds.length === 0) {
    // No scheduling teams configured — fall back to all active users
    const { data, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, initials, color, avatar_url')
      .eq('org_id', user.orgId)
      .eq('is_active', true)
      .order('first_name')
    if (error) return { error: error.message }
    return { data: data || [] }
  }

  // Get distinct users who are members of those teams
  const { data: members } = await supabase
    .from('team_members')
    .select('user_id')
    .in('team_id', teamIds)

  const userIds = [...new Set(members?.map(m => m.user_id) || [])]

  if (userIds.length === 0) {
    return { data: [] }
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, first_name, last_name, initials, color')
    .eq('org_id', user.orgId)
    .eq('is_active', true)
    .in('id', userIds)
    .order('first_name')

  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function getTeams() {
  const user = await requirePermission('scheduling', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('teams')
    .select('*, team_members(user_id, users(id, first_name, last_name))')
    .eq('org_id', user.orgId)
    .eq('is_active', true)
    .order('name')

  if (error) return { error: error.message }
  return { data: data || [] }
}

// ============================================================================
// COLLECTION STATUS HELPER
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function attachCollectionStatus(supabase: any, jobs: any[]) {
  if (jobs.length === 0) return jobs

  const jobIds = jobs.map(j => j.id)

  // Fetch SO links and collection statuses in parallel
  const [soResult, colResult] = await Promise.all([
    supabase
      .from('job_sales_orders')
      .select('job_id, sales_orders(so_number)')
      .in('job_id', jobIds),
    supabase
      .from('job_collections')
      .select('job_id, status')
      .in('job_id', jobIds)
      .neq('status', 'cancelled'),
  ])

  // Build SO numbers per job
  const soNumbersByJob = new Map<string, string[]>()
  for (const r of (soResult.data || []) as { job_id: string; sales_orders: { so_number: string } | null }[]) {
    const existing = soNumbersByJob.get(r.job_id) || []
    if (r.sales_orders?.so_number) existing.push(r.sales_orders.so_number)
    soNumbersByJob.set(r.job_id, existing)
  }
  const jobsWithSo = new Set(soNumbersByJob.keys())

  // Build collection status per job: 'collected' if all collected, 'pending' if any pending/partial
  const collectionsByJob = new Map<string, string[]>()
  for (const c of (colResult.data || []) as { job_id: string; status: string }[]) {
    const existing = collectionsByJob.get(c.job_id) || []
    existing.push(c.status)
    collectionsByJob.set(c.job_id, existing)
  }

  return jobs.map(job => {
    const hasSo = jobsWithSo.has(job.id)
    const soNumbers = soNumbersByJob.get(job.id) || []
    const statuses = collectionsByJob.get(job.id)
    let collectionStatus: 'none' | 'pending' | 'collected' = 'none'

    if (statuses && statuses.length > 0) {
      const allCollected = statuses.every(s => s === 'collected')
      collectionStatus = allCollected ? 'collected' : 'pending'
    }

    return { ...job, _hasSo: hasSo, _soNumbers: soNumbers, _collectionStatus: collectionStatus }
  })
}

// ============================================================================
// JOBS CRUD
// ============================================================================

export async function getJobs(filters?: {
  status?: string
  jobTypeId?: string
  engineerId?: string
  priority?: string
  search?: string
  dateFrom?: string
  dateTo?: string
  date?: string
}) {
  const user = await requirePermission('scheduling', 'view')
  const supabase = await createClient()

  let query = supabase
    .from('jobs')
    .select(`
      *,
      company:company_id(id, name),
      contact:contact_id(id, first_name, last_name, phone, email),
      job_type:job_type_id(id, name, slug, color, background, default_duration_minutes),
      engineer:assigned_to(id, first_name, last_name, initials, color, avatar_url)
    `)
    .eq('org_id', user.orgId)

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.jobTypeId) {
    query = query.eq('job_type_id', filters.jobTypeId)
  }
  if (filters?.engineerId) {
    query = query.eq('assigned_to', filters.engineerId)
  }
  if (filters?.priority) {
    query = query.eq('priority', filters.priority)
  }
  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,job_number.ilike.%${filters.search}%`)
  }
  if (filters?.dateFrom) {
    query = query.gte('scheduled_date', filters.dateFrom)
  }
  if (filters?.dateTo) {
    query = query.lte('scheduled_date', filters.dateTo)
  }
  if (filters?.date) {
    query = query.eq('scheduled_date', filters.date)
  }

  const { data, error } = await query.order('scheduled_date', { ascending: true, nullsFirst: false }).order('scheduled_time', { ascending: true, nullsFirst: false })

  if (error) return { error: error.message }

  const jobs = data || []
  return { data: await attachCollectionStatus(supabase, jobs) }
}

export async function getJob(id: string) {
  const user = await requirePermission('scheduling', 'view')
  const supabase = await createClient()

  const [jobResult, notesResult, photosResult, partsResult, tasksResult, historyResult] = await Promise.all([
    supabase
      .from('jobs')
      .select(`
        *,
        company:company_id(id, name, address_line1, address_line2, city, county, postcode, phone, email),
        contact:contact_id(id, first_name, last_name, job_title, phone, email, mobile),
        job_type:job_type_id(id, name, slug, color, background, default_duration_minutes, task_template_id),
        engineer:assigned_to(id, first_name, last_name, initials, color, avatar_url),
        created_by_user:created_by(id, first_name, last_name),
        validated_by_user:validated_by(id, first_name, last_name)
      `)
      .eq('id', id)
      .eq('org_id', user.orgId)
      .single(),
    supabase
      .from('job_notes')
      .select('*, user:user_id(id, first_name, last_name, initials, color, avatar_url)')
      .eq('job_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('job_photos')
      .select('*, user:user_id(id, first_name, last_name)')
      .eq('job_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('job_parts')
      .select('*, product:product_id(id, name, sku)')
      .eq('job_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('job_tasks')
      .select('*, completed_by_user:completed_by(id, first_name, last_name)')
      .eq('job_id', id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('v_company_job_history')
      .select('*')
      .eq('org_id', user.orgId)
      .neq('id', id)
      .order('scheduled_date', { ascending: false })
      .limit(10),
  ])

  if (jobResult.error) return { error: jobResult.error.message }

  // Filter history to same company
  const companyHistory = (historyResult.data || []).filter(
    (h: { company_id: string }) => h.company_id === jobResult.data.company_id
  ).slice(0, 5)

  return {
    data: {
      ...jobResult.data,
      notes: notesResult.data || [],
      photos: photosResult.data || [],
      parts: partsResult.data || [],
      tasks: tasksResult.data || [],
      company_history: companyHistory,
    }
  }
}

export interface CreateJobInput {
  company_id: string
  contact_id?: string
  title: string
  description?: string
  job_type_id: string
  priority: string
  assigned_to?: string
  scheduled_date?: string
  scheduled_time?: string
  estimated_duration_minutes: number
  chargeable_type?: 'as_per_so' | 'no' | 'contract' | 'hourly'
  internal_notes?: string
  site_address_line1?: string
  site_address_line2?: string
  site_city?: string
  site_county?: string
  site_postcode?: string
  source_type?: 'manual' | 'sales_order' | 'ticket' | 'contract'
  source_id?: string
  linked_so_ids?: string[]
}

export async function createJob(input: CreateJobInput) {
  const user = await requirePermission('scheduling', 'create')
  const supabase = await createClient()

  const jobNumber = await generateJobNumber(supabase, user.orgId)

  // Determine status based on assignment
  const hasEngineer = !!input.assigned_to
  const hasDate = !!input.scheduled_date
  const status: JobStatus = (hasEngineer && hasDate) ? 'scheduled' : 'unscheduled'

  const { data, error } = await supabase
    .from('jobs')
    .insert({
      org_id: user.orgId,
      job_number: jobNumber,
      title: input.title,
      description: input.description || null,
      company_id: input.company_id,
      contact_id: input.contact_id || null,
      job_type_id: input.job_type_id,
      priority: input.priority || 'normal',
      status,
      assigned_to: input.assigned_to || null,
      scheduled_date: input.scheduled_date || null,
      scheduled_time: input.scheduled_time || null,
      estimated_duration_minutes: input.estimated_duration_minutes,
      internal_notes: input.internal_notes || null,
      site_address_line1: input.site_address_line1 || null,
      site_address_line2: input.site_address_line2 || null,
      site_city: input.site_city || null,
      site_county: input.site_county || null,
      site_postcode: input.site_postcode || null,
      chargeable_type: input.chargeable_type || 'as_per_so',
      source_type: input.source_type || 'manual',
      source_id: input.source_id || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Materialise task template items as job_tasks
  const { data: jobType } = await supabase
    .from('job_types')
    .select('task_template_id')
    .eq('id', input.job_type_id)
    .single()

  if (jobType?.task_template_id) {
    const { data: templateItems } = await supabase
      .from('job_task_template_items')
      .select('*')
      .eq('template_id', jobType.task_template_id)
      .order('sort_order')

    if (templateItems && templateItems.length > 0) {
      await supabase.from('job_tasks').insert(
        templateItems.map(item => ({
          job_id: data.id,
          template_item_id: item.id,
          description: item.description,
          is_required: item.is_required,
          response_type: item.response_type || 'yes_no',
          sort_order: item.sort_order,
        }))
      )
    }
  }

  // Link sales orders via junction table
  const soIds = input.linked_so_ids?.filter(Boolean) || []
  // Also include source_id if it's a sales_order source (ensures consistency)
  if (input.source_type === 'sales_order' && input.source_id && !soIds.includes(input.source_id)) {
    soIds.push(input.source_id)
  }
  if (soIds.length > 0) {
    await supabase.from('job_sales_orders').insert(
      soIds.map(soId => ({ job_id: data.id, sales_order_id: soId, org_id: user.orgId }))
    )
    // Auto-set requires_install on linked SOs that don't have it
    await supabase
      .from('sales_orders')
      .update({ requires_install: true })
      .in('id', soIds)
      .eq('requires_install', false)
  }

  logActivity({
    supabase, user,
    entityType: 'job', entityId: data.id,
    action: 'created',
    details: { title: input.title, company_id: input.company_id, job_type: input.job_type_id, assigned_to: input.assigned_to },
  })

  // Fire-and-forget Teams notification if job is created already assigned
  if (input.assigned_to && input.scheduled_date) {
    fireTeamsNotification(supabase, user.orgId, data.id, 'assigned', input.assigned_to)
  }

  revalidatePath('/scheduling')
  revalidatePath('/orders')
  return { data }
}

export async function createMultipleJobs(input: CreateJobInput, engineerIds: string[]) {
  // Creates one job per engineer with identical data
  const results: { id: string; job_number: string; assigned_to: string | null }[] = []
  const errors: string[] = []

  for (const engineerId of engineerIds) {
    const result = await createJob({ ...input, assigned_to: engineerId })
    if (result.error) {
      errors.push(result.error)
    } else if (result.data) {
      results.push({ id: result.data.id, job_number: result.data.job_number, assigned_to: engineerId })
    }
  }

  if (errors.length > 0 && results.length === 0) {
    return { error: errors[0] }
  }

  return { data: results }
}

export async function updateJob(id: string, input: Partial<CreateJobInput>) {
  const user = await requirePermission('scheduling', 'edit')
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {}
  const changedFields: string[] = []

  if (input.title !== undefined) { updates.title = input.title; changedFields.push('title') }
  if (input.description !== undefined) { updates.description = input.description || null; changedFields.push('description') }
  if (input.company_id !== undefined) { updates.company_id = input.company_id; changedFields.push('company_id') }
  if (input.contact_id !== undefined) { updates.contact_id = input.contact_id || null; changedFields.push('contact_id') }
  if (input.job_type_id !== undefined) { updates.job_type_id = input.job_type_id; changedFields.push('job_type_id') }
  if (input.priority !== undefined) { updates.priority = input.priority; changedFields.push('priority') }
  if (input.assigned_to !== undefined) { updates.assigned_to = input.assigned_to || null; changedFields.push('assigned_to') }
  if (input.scheduled_date !== undefined) { updates.scheduled_date = input.scheduled_date || null; changedFields.push('scheduled_date') }
  if (input.scheduled_time !== undefined) { updates.scheduled_time = input.scheduled_time || null; changedFields.push('scheduled_time') }
  if (input.estimated_duration_minutes !== undefined) { updates.estimated_duration_minutes = input.estimated_duration_minutes; changedFields.push('estimated_duration_minutes') }
  if (input.chargeable_type !== undefined) { updates.chargeable_type = input.chargeable_type; changedFields.push('chargeable_type') }
  if (input.internal_notes !== undefined) { updates.internal_notes = input.internal_notes || null; changedFields.push('internal_notes') }
  if (input.site_address_line1 !== undefined) { updates.site_address_line1 = input.site_address_line1 || null; changedFields.push('site_address') }
  if (input.site_address_line2 !== undefined) { updates.site_address_line2 = input.site_address_line2 || null }
  if (input.site_city !== undefined) { updates.site_city = input.site_city || null }
  if (input.site_county !== undefined) { updates.site_county = input.site_county || null }
  if (input.site_postcode !== undefined) { updates.site_postcode = input.site_postcode || null }

  // Auto-update status when engineer + date change on an unscheduled job
  // Fetch current status to decide
  const { data: currentJob } = await supabase
    .from('jobs')
    .select('status, assigned_to, scheduled_date')
    .eq('id', id)
    .eq('org_id', user.orgId)
    .single()

  if (currentJob) {
    const effectiveEngineer = input.assigned_to !== undefined ? (input.assigned_to || null) : currentJob.assigned_to
    const effectiveDate = input.scheduled_date !== undefined ? (input.scheduled_date || null) : currentJob.scheduled_date

    if (currentJob.status === 'unscheduled' && effectiveEngineer && effectiveDate) {
      updates.status = 'scheduled'
      changedFields.push('status')
    } else if (currentJob.status === 'scheduled' && (!effectiveEngineer || !effectiveDate)) {
      updates.status = 'unscheduled'
      changedFields.push('status')
    }
  }

  const { error } = await supabase
    .from('jobs')
    .update(updates)
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  // Sync linked sales orders if provided
  if (input.linked_so_ids !== undefined) {
    // Delete existing links
    await supabase.from('job_sales_orders').delete().eq('job_id', id)
    // Insert new links
    const soIds = input.linked_so_ids.filter(Boolean)
    if (soIds.length > 0) {
      await supabase.from('job_sales_orders').insert(
        soIds.map(soId => ({ job_id: id, sales_order_id: soId, org_id: user.orgId }))
      )
      // Auto-set requires_install on linked SOs that don't have it
      await supabase
        .from('sales_orders')
        .update({ requires_install: true })
        .in('id', soIds)
        .eq('requires_install', false)
    }
    changedFields.push('linked_sales_orders')
  }

  logActivity({
    supabase, user,
    entityType: 'job', entityId: id,
    action: 'updated',
    details: { changed_fields: changedFields },
  })

  revalidatePath('/scheduling')
  revalidatePath(`/scheduling/jobs/${id}`)
  revalidatePath('/orders')
  return { success: true }
}

// ============================================================================
// JOB STATUS CHANGES
// ============================================================================

export async function changeJobStatus(id: string, newStatus: JobStatus, extra?: { cancel_reason?: string; completion_notes?: string; follow_up_required?: boolean; gps?: GpsCoords | null }) {
  const user = await requirePermission('scheduling', 'edit')
  const supabase = await createClient()

  // Get current job
  const { data: job, error: fetchError } = await supabase
    .from('jobs')
    .select('status, source_type, source_id, assigned_to')
    .eq('id', id)
    .eq('org_id', user.orgId)
    .single()

  if (fetchError) return { error: fetchError.message }

  const oldStatus = job.status

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = { status: newStatus }

  if (newStatus === 'travelling') {
    updates.travel_started_at = new Date().toISOString()
  }
  if (newStatus === 'on_site') {
    updates.arrived_at = new Date().toISOString()
  }
  if (newStatus === 'completed') {
    updates.completed_at = new Date().toISOString()
    if (extra?.completion_notes) updates.completion_notes = extra.completion_notes
    if (extra?.follow_up_required !== undefined) updates.follow_up_required = extra.follow_up_required
  }
  if (newStatus === 'cancelled') {
    updates.cancelled_at = new Date().toISOString()
    if (extra?.cancel_reason) updates.cancel_reason = extra.cancel_reason
  }
  // Reopen: back to scheduled
  if (newStatus === 'scheduled' && oldStatus === 'completed') {
    updates.completed_at = null
    updates.completion_notes = null
    updates.follow_up_required = false
  }
  // Unschedule: back to pool
  if (newStatus === 'unscheduled') {
    updates.assigned_to = null
    updates.scheduled_date = null
    updates.scheduled_time = null
    updates.travel_started_at = null
    updates.arrived_at = null
  }

  const { error } = await supabase
    .from('jobs')
    .update(updates)
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({
    supabase, user,
    entityType: 'job', entityId: id,
    action: 'status_changed',
    details: { from: oldStatus, to: newStatus, timestamp: new Date().toISOString() },
  })

  // GPS logging
  const gpsEventMap: Record<string, GpsEventType> = {
    travelling: 'travel_started',
    on_site: 'arrived',
    completed: 'completed',
  }
  const gpsEvent = gpsEventMap[newStatus] || 'status_changed'
  logGpsEvent(supabase, user, id, gpsEvent, extra?.gps, { from: oldStatus, to: newStatus })

  // Fire-and-forget Teams notification for cancellation
  if (newStatus === 'cancelled' && job.assigned_to) {
    fireTeamsNotification(supabase, user.orgId, id, 'cancelled', job.assigned_to)
  }

  // Sync visit instance for visit-sourced jobs
  if (job.source_type === 'visit' && job.source_id) {
    await syncVisitFromJob(supabase, user, job.source_id, newStatus)
    revalidatePath('/visit-scheduling')
  }

  revalidatePath('/scheduling')
  revalidatePath(`/scheduling/jobs/${id}`)
  revalidatePath('/field')
  return { success: true }
}

export async function assignJob(id: string, engineerId: string, date: string, time?: string) {
  const user = await requirePermission('scheduling', 'edit')
  const supabase = await createClient()

  const { data: job } = await supabase
    .from('jobs')
    .select('assigned_to')
    .eq('id', id)
    .eq('org_id', user.orgId)
    .single()

  const { error } = await supabase
    .from('jobs')
    .update({
      assigned_to: engineerId,
      scheduled_date: date,
      scheduled_time: time || null,
      status: 'scheduled',
    })
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  const fromEngineer = job?.assigned_to
  logActivity({
    supabase, user,
    entityType: 'job', entityId: id,
    action: fromEngineer ? 'reassigned' : 'assigned',
    details: fromEngineer
      ? { from_engineer: fromEngineer, to_engineer: engineerId }
      : { engineer_id: engineerId, date, time },
  })

  // Fire-and-forget Teams notification
  fireTeamsNotification(supabase, user.orgId, id, 'assigned', engineerId)

  revalidatePath('/scheduling')
  revalidatePath(`/scheduling/jobs/${id}`)
  return { success: true }
}

export async function rescheduleJob(id: string, date: string, time?: string, engineerId?: string) {
  const user = await requirePermission('scheduling', 'edit')
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {
    scheduled_date: date,
    scheduled_time: time || null,
  }
  if (engineerId !== undefined) {
    updates.assigned_to = engineerId || null
  }

  const { error } = await supabase
    .from('jobs')
    .update(updates)
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({
    supabase, user,
    entityType: 'job', entityId: id,
    action: 'updated',
    details: { changed_fields: ['scheduled_date', 'scheduled_time', ...(engineerId !== undefined ? ['assigned_to'] : [])] },
  })

  // Fire-and-forget Teams notification — fetch current assigned_to for the notification
  const { data: rescheduledJob } = await supabase
    .from('jobs')
    .select('assigned_to')
    .eq('id', id)
    .single()
  if (rescheduledJob?.assigned_to) {
    fireTeamsNotification(supabase, user.orgId, id, 'rescheduled', rescheduledJob.assigned_to)
  }

  revalidatePath('/scheduling')
  revalidatePath(`/scheduling/jobs/${id}`)
  return { success: true }
}

// ============================================================================
// JOB NOTES
// ============================================================================

export async function addJobNote(jobId: string, note: string, gps?: GpsCoords | null) {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('job_notes')
    .insert({
      job_id: jobId,
      user_id: user.id,
      note,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  logActivity({
    supabase, user,
    entityType: 'job_note', entityId: data.id,
    action: 'created',
    details: { job_id: jobId, note_preview: note.substring(0, 100) },
  })

  logGpsEvent(supabase, user, jobId, 'note_added', gps, { note_id: data.id })

  revalidatePath(`/scheduling/jobs/${jobId}`)
  revalidatePath(`/field/job/${jobId}`)
  return { data }
}

// ============================================================================
// JOB PHOTOS
// ============================================================================

export async function uploadJobPhoto(jobId: string, formData: FormData) {
  const user = await requireAuth()
  const supabase = await createClient()

  const file = formData.get('file') as File
  if (!file) return { error: 'No file provided' }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
  if (!allowedTypes.includes(file.type)) return { error: 'Invalid file type. Only images allowed.' }
  if (file.size > 10 * 1024 * 1024) return { error: 'File too large. Max 10MB.' }

  const ext = file.name.split('.').pop() || 'jpg'
  const storagePath = `${user.orgId}/${jobId}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('job-photos')
    .upload(storagePath, file)

  if (uploadError) return { error: uploadError.message }

  const caption = formData.get('caption') as string | null

  const { data, error } = await supabase
    .from('job_photos')
    .insert({
      job_id: jobId,
      user_id: user.id,
      storage_path: storagePath,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      caption: caption || null,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  logActivity({
    supabase, user,
    entityType: 'job_photo', entityId: data.id,
    action: 'uploaded',
    details: { job_id: jobId, file_name: file.name },
  })

  revalidatePath(`/scheduling/jobs/${jobId}`)
  revalidatePath(`/field/job/${jobId}`)
  return { data }
}

export async function getJobPhotoUrl(storagePath: string) {
  const supabase = await createClient()

  const { data } = await supabase.storage
    .from('job-photos')
    .createSignedUrl(storagePath, 300) // 5 min

  return data?.signedUrl || null
}

export async function getJobSignatureUrl(storagePath: string) {
  const supabase = await createClient()

  const { data } = await supabase.storage
    .from('job-signatures')
    .createSignedUrl(storagePath, 300) // 5 min

  return data?.signedUrl || null
}

// ============================================================================
// COMPLETE JOB (from field)
// ============================================================================

export async function completeJob(jobId: string, formData: FormData) {
  const user = await requireAuth()
  const supabase = await createClient()

  const completionNotes = formData.get('completion_notes') as string
  const followUpRequired = formData.get('follow_up_required') === 'true'

  // GPS coordinates (optional, from mobile device)
  const gpsLat = formData.get('gps_latitude') as string | null
  const gpsLng = formData.get('gps_longitude') as string | null
  const gpsAcc = formData.get('gps_accuracy') as string | null
  const gps: GpsCoords | null = gpsLat && gpsLng
    ? { latitude: parseFloat(gpsLat), longitude: parseFloat(gpsLng), accuracy: gpsAcc ? parseFloat(gpsAcc) : null }
    : null

  if (!completionNotes?.trim()) return { error: 'Completion notes are required' }

  // Verify all required tasks are completed
  const { data: incompleteTasks } = await supabase
    .from('job_tasks')
    .select('id')
    .eq('job_id', jobId)
    .eq('is_required', true)
    .eq('is_completed', false)

  if (incompleteTasks && incompleteTasks.length > 0) {
    return { error: `${incompleteTasks.length} required task(s) not completed` }
  }

  // Signature data
  const engineerSignatureData = formData.get('engineer_signature') as string | null
  const engineerName = formData.get('engineer_name') as string | null
  const customerNotPresent = formData.get('customer_not_present') === 'true'
  const customerSignatureData = formData.get('customer_signature') as string | null
  const customerName = formData.get('customer_name') as string | null

  if (!engineerSignatureData) return { error: 'Engineer signature is required' }
  if (!engineerName?.trim()) return { error: 'Engineer name is required' }
  if (!customerNotPresent && !customerSignatureData) return { error: 'Customer signature is required' }

  // Upload signatures to storage
  let engineerSigPath: string | null = null
  let customerSigPath: string | null = null

  // Engineer signature
  try {
    const base64Data = engineerSignatureData.replace(/^data:image\/png;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    engineerSigPath = `${user.orgId}/${jobId}/engineer-${crypto.randomUUID()}.png`

    const { error: sigErr } = await supabase.storage
      .from('job-signatures')
      .upload(engineerSigPath, buffer, { contentType: 'image/png' })

    if (sigErr) {
      console.error('[completeJob] engineer sig upload error:', sigErr.message)
      engineerSigPath = null
    }
  } catch (err) {
    console.error('[completeJob] engineer sig decode error:', err)
  }

  // Customer signature (if present)
  if (!customerNotPresent && customerSignatureData) {
    try {
      const base64Data = customerSignatureData.replace(/^data:image\/png;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')
      customerSigPath = `${user.orgId}/${jobId}/customer-${crypto.randomUUID()}.png`

      const { error: sigErr } = await supabase.storage
        .from('job-signatures')
        .upload(customerSigPath, buffer, { contentType: 'image/png' })

      if (sigErr) {
        console.error('[completeJob] customer sig upload error:', sigErr.message)
        customerSigPath = null
      }
    } catch (err) {
      console.error('[completeJob] customer sig decode error:', err)
    }
  }

  // Update job status
  const { error: updateError } = await supabase
    .from('jobs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      completion_notes: completionNotes,
      follow_up_required: followUpRequired,
      engineer_signature_path: engineerSigPath,
      engineer_signature_name: engineerName?.trim() || null,
      customer_signature_path: customerSigPath,
      customer_signature_name: customerName?.trim() || null,
      customer_not_present: customerNotPresent,
    })
    .eq('id', jobId)
    .eq('org_id', user.orgId)

  if (updateError) return { error: updateError.message }

  // Upload photos
  const files = formData.getAll('photos') as File[]
  let photosCount = 0
  for (const file of files) {
    if (file.size === 0) continue
    const ext = file.name.split('.').pop() || 'jpg'
    const storagePath = `${user.orgId}/${jobId}/${crypto.randomUUID()}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('job-photos')
      .upload(storagePath, file)

    if (!upErr) {
      await supabase.from('job_photos').insert({
        job_id: jobId,
        user_id: user.id,
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
      })
      photosCount++
    }
  }

  logActivity({
    supabase, user,
    entityType: 'job', entityId: jobId,
    action: 'completed',
    details: { notes_count: 1, photos_count: photosCount, has_signatures: true, customer_not_present: customerNotPresent },
  })

  logGpsEvent(supabase, user, jobId, 'completed', gps)

  // Sync linked visit instance for visit-sourced jobs
  const { data: jobSource } = await supabase
    .from('jobs')
    .select('source_type, source_id')
    .eq('id', jobId)
    .single()

  if (jobSource?.source_type === 'visit' && jobSource.source_id) {
    await syncVisitFromJob(supabase, user, jobSource.source_id, 'completed', completionNotes)
    revalidatePath('/visit-scheduling')
  }

  revalidatePath('/scheduling')
  revalidatePath(`/scheduling/jobs/${jobId}`)
  revalidatePath('/field')
  return { success: true }
}

// ============================================================================
// FIELD ENGINEER: TODAY'S JOBS
// ============================================================================

export async function getMyTodayJobs() {
  const user = await requireAuth()
  const supabase = await createClient()

  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('jobs')
    .select(`
      *,
      company:company_id(id, name),
      contact:contact_id(id, first_name, last_name, phone, email, mobile),
      job_type:job_type_id(id, name, slug, color, background)
    `)
    .eq('org_id', user.orgId)
    .eq('assigned_to', user.id)
    .eq('scheduled_date', today)
    .neq('status', 'cancelled')
    .order('scheduled_time', { ascending: true, nullsFirst: false })

  if (error) return { error: error.message }

  const jobs = data || []
  return { data: await attachCollectionStatus(supabase, jobs) }
}

export async function getMyScheduleRange() {
  const user = await requireAuth()
  const supabase = await createClient()

  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const end = new Date(now)
  end.setDate(end.getDate() + 13) // 2 weeks from today
  const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`

  const [jobsResult, activitiesResult] = await Promise.all([
    supabase
      .from('jobs')
      .select(`
        *,
        company:company_id(id, name, phone),
        contact:contact_id(id, first_name, last_name, phone, email, mobile),
        job_type:job_type_id(id, name, slug, color, background)
      `)
      .eq('org_id', user.orgId)
      .eq('assigned_to', user.id)
      .gte('scheduled_date', today)
      .lte('scheduled_date', endDate)
      .neq('status', 'cancelled')
      .order('scheduled_date')
      .order('scheduled_time', { ascending: true, nullsFirst: false }),
    supabase
      .from('activities')
      .select(`
        *,
        activity_type:activity_type_id(id, name, slug, color, background)
      `)
      .eq('org_id', user.orgId)
      .eq('engineer_id', user.id)
      .gte('scheduled_date', today)
      .lte('scheduled_date', endDate)
      .order('scheduled_date')
      .order('scheduled_time', { ascending: true, nullsFirst: false }),
  ])

  const jobs = await attachCollectionStatus(supabase, jobsResult.data || [])

  return {
    jobs,
    activities: activitiesResult.data || [],
    today,
    endDate,
  }
}

// ============================================================================
// GPS LOG (for office visibility)
// ============================================================================

export async function getJobGpsLog(jobId: string) {
  const user = await requirePermission('scheduling', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('job_gps_log')
    .select('*, user:user_id(first_name, last_name)')
    .eq('job_id', jobId)
    .eq('org_id', user.orgId)
    .order('captured_at', { ascending: true })

  if (error) return { error: error.message }
  return { data: data || [] }
}

// ============================================================================
// COMPANIES & CONTACTS (for form dropdowns)
// ============================================================================

export async function getCompaniesForSelect() {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('customers')
    .select('id, name, address_line1, address_line2, city, county, postcode')
    .eq('org_id', user.orgId)
    .eq('is_active', true)
    .order('name')

  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function getContactsForCompany(companyId: string) {
  const user = await requireAuth()
  const supabase = await createClient()

  // Direct contacts (primary by default)
  const { data: direct, error } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, job_title, phone, email, mobile')
    .eq('customer_id', companyId)
    .eq('is_active', true)
    .order('first_name')

  if (error) return { error: error.message }

  // Linked contacts (from other companies)
  const { data: links } = await supabase
    .from('contact_customer_links')
    .select('is_primary, contacts(id, first_name, last_name, job_title, phone, email, mobile, is_active)')
    .eq('customer_id', companyId)

  const linked = (links || [])
    .filter((l) => {
      const c = l.contacts as unknown as { id: string; is_active: boolean } | null
      return c != null && c.is_active && !(direct || []).some((d) => d.id === c.id)
    })
    .map((l) => {
      const { is_active: _, ...c } = l.contacts as unknown as { id: string; first_name: string; last_name: string; job_title: string | null; phone: string | null; email: string | null; mobile: string | null; is_active: boolean }
      return { ...c, is_primary: l.is_primary === true }
    })

  // Direct contacts are considered primary; linked contacts use their is_primary flag
  const directWithPrimary = (direct || []).map(c => ({ ...c, is_primary: true }))

  return { data: [...directWithPrimary, ...linked] }
}

export async function getSalesOrdersForCompany(companyId: string) {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sales_orders')
    .select('id, so_number, customer_po, requires_install')
    .eq('customer_id', companyId)
    .eq('org_id', user.orgId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return { data: [] }
  return { data: data || [] }
}

export async function getLinkedSalesOrders(jobId: string) {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data } = await supabase
    .from('job_sales_orders')
    .select('sales_order_id, sales_orders(id, so_number, customer_po, requires_install)')
    .eq('job_id', jobId)
    .eq('org_id', user.orgId)

  return (data || []).map(row => {
    const so = row.sales_orders as unknown as { id: string; so_number: string; customer_po: string | null; requires_install: boolean } | null
    return so ? { id: so.id, so_number: so.so_number, customer_po: so.customer_po, requires_install: so.requires_install } : null
  }).filter(Boolean) as { id: string; so_number: string; customer_po: string | null; requires_install: boolean }[]
}

// ============================================================================
// DISPATCH CALENDAR: Drag & drop helpers
// ============================================================================

export async function dragAssignJob(jobId: string, engineerId: string, date: string, time: string) {
  const user = await requirePermission('scheduling', 'edit')
  const supabase = await createClient()

  const { data: job } = await supabase
    .from('jobs')
    .select('assigned_to, status')
    .eq('id', jobId)
    .eq('org_id', user.orgId)
    .single()

  const { error } = await supabase
    .from('jobs')
    .update({
      assigned_to: engineerId,
      scheduled_date: date,
      scheduled_time: time,
      status: 'scheduled',
    })
    .eq('id', jobId)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  const fromEngineer = job?.assigned_to
  logActivity({
    supabase, user,
    entityType: 'job', entityId: jobId,
    action: fromEngineer && fromEngineer !== engineerId ? 'reassigned' : 'assigned',
    details: { engineer_id: engineerId, date, time },
  })

  revalidatePath('/scheduling')
  return { success: true }
}

export async function dragUnscheduleJob(jobId: string) {
  const user = await requirePermission('scheduling', 'edit')
  const supabase = await createClient()

  const { error } = await supabase
    .from('jobs')
    .update({
      assigned_to: null,
      scheduled_date: null,
      scheduled_time: null,
      status: 'unscheduled',
      travel_started_at: null,
      arrived_at: null,
    })
    .eq('id', jobId)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({
    supabase, user,
    entityType: 'job', entityId: jobId,
    action: 'status_changed',
    details: { to: 'unscheduled' },
  })

  revalidatePath('/scheduling')
  return { success: true }
}

// ============================================================================
// COMPANY HISTORY (for field view)
// ============================================================================

export async function getCompanyJobHistory(companyId: string) {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('v_company_job_history')
    .select('*')
    .eq('org_id', user.orgId)
    .eq('company_id', companyId)
    .limit(5)

  if (error) return { error: error.message }
  return { data: data || [] }
}

// ============================================================================
// JOB VALIDATION (office validates completed jobs)
// ============================================================================

export async function validateJob(jobId: string, notes?: string) {
  const user = await requirePermission('scheduling', 'edit')
  const supabase = await createClient()

  // Verify job is completed and not yet validated
  const { data: job } = await supabase
    .from('jobs')
    .select('status, validated_at, job_number, company_id')
    .eq('id', jobId)
    .eq('org_id', user.orgId)
    .single()

  if (!job) return { error: 'Job not found' }
  if (job.status !== 'completed') return { error: 'Only completed jobs can be validated' }
  if (job.validated_at) return { error: 'Job already validated' }

  const { error } = await supabase
    .from('jobs')
    .update({
      validated_at: new Date().toISOString(),
      validated_by: user.id,
      validation_notes: notes || null,
    })
    .eq('id', jobId)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({
    supabase, user,
    entityType: 'job', entityId: jobId,
    action: 'validated',
    details: { notes: notes || null },
  })

  revalidatePath(`/scheduling/jobs/${jobId}`)
  revalidatePath('/scheduling')
  return { success: true }
}

// ============================================================================
// JOB REPORT DATA (for PDF generation)
// ============================================================================

export async function getJobReportData(jobId: string) {
  const user = await requirePermission('scheduling', 'view')
  const supabase = await createClient()

  // Fetch the job with all related data
  const { data: job } = await supabase
    .from('jobs')
    .select(`
      *,
      company:company_id(id, name, address_line1, address_line2, city, county, postcode),
      contact:contact_id(id, first_name, last_name, email, phone, mobile, job_title),
      job_type:job_type_id(id, name, slug, color, background),
      engineer:assigned_to(id, first_name, last_name, initials, color, avatar_url),
      validated_by_user:validated_by(id, first_name, last_name)
    `)
    .eq('id', jobId)
    .eq('org_id', user.orgId)
    .single()

  if (!job) return { error: 'Job not found' }

  // Fetch notes, photos, parts, tasks in parallel
  const [notesResult, photosResult, partsResult, tasksResult] = await Promise.all([
    supabase
      .from('job_notes')
      .select('*, user:user_id(first_name, last_name)')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true }),
    supabase
      .from('job_photos')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true }),
    supabase
      .from('job_parts')
      .select('*, product:product_id(name, sku)')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true }),
    supabase
      .from('job_tasks')
      .select('*')
      .eq('job_id', jobId)
      .order('sort_order', { ascending: true }),
  ])

  // Get signed URLs for photos
  const photos = photosResult.data || []
  const photosWithUrls = await Promise.all(
    photos.map(async (photo) => {
      const { data: urlData } = await supabase.storage
        .from('job-photos')
        .createSignedUrl(photo.storage_path, 600) // 10 min
      return { ...photo, signedUrl: urlData?.signedUrl || null }
    })
  )

  // Get signed URLs for signatures
  let engineerSignatureUrl: string | null = null
  let customerSignatureUrl: string | null = null

  if (job.engineer_signature_path) {
    const { data: sigData } = await supabase.storage
      .from('job-signatures')
      .createSignedUrl(job.engineer_signature_path, 600)
    engineerSignatureUrl = sigData?.signedUrl || null
  }
  if (job.customer_signature_path) {
    const { data: sigData } = await supabase.storage
      .from('job-signatures')
      .createSignedUrl(job.customer_signature_path, 600)
    customerSignatureUrl = sigData?.signedUrl || null
  }

  // Get the brand for the customer's org (default brand)
  const { data: brand } = await supabase
    .from('brands')
    .select('name, legal_entity, logo_path, logo_width, phone, fax, email, website, footer_text, address_line1, address_line2, city, county, postcode, company_reg_number, vat_number')
    .eq('org_id', user.orgId)
    .eq('is_default', true)
    .eq('is_active', true)
    .maybeSingle()

  return {
    data: {
      job,
      notes: notesResult.data || [],
      photos: photosWithUrls,
      parts: partsResult.data || [],
      tasks: tasksResult.data || [],
      brand,
      signatures: {
        engineerSignatureUrl,
        engineerSignatureName: job.engineer_signature_name,
        customerSignatureUrl,
        customerSignatureName: job.customer_signature_name,
        customerNotPresent: job.customer_not_present,
      },
    },
  }
}

// ============================================================================
// SAVE JOB REPORT RECORD
// ============================================================================

export async function saveJobReport(jobId: string, storagePath: string, fileName: string) {
  const user = await requirePermission('scheduling', 'edit')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('job_reports')
    .insert({
      job_id: jobId,
      org_id: user.orgId,
      storage_path: storagePath,
      file_name: fileName,
      generated_by: user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  return { data }
}

export async function getJobReports(jobId: string) {
  const user = await requirePermission('scheduling', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('job_reports')
    .select('*')
    .eq('job_id', jobId)
    .eq('org_id', user.orgId)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return { data: data || [] }
}

// ============================================================================
// ACTIVITY TYPES
// ============================================================================

export async function getActivityTypes() {
  const user = await requirePermission('scheduling', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('activity_types')
    .select('*')
    .eq('org_id', user.orgId)
    .order('sort_order')

  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function getWorkingDays(): Promise<number[]> {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data } = await supabase
    .from('org_settings')
    .select('setting_value')
    .eq('org_id', user.orgId)
    .eq('setting_key', 'scheduling_working_days')
    .single()

  if (data?.setting_value) {
    try {
      return JSON.parse(data.setting_value)
    } catch { /* fall through */ }
  }
  return [1, 2, 3, 4, 5] // default Mon-Fri
}

export async function getActiveActivityTypes() {
  const user = await requirePermission('scheduling', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('activity_types')
    .select('*')
    .eq('org_id', user.orgId)
    .eq('is_active', true)
    .order('sort_order')

  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function createActivityType(input: {
  name: string
  slug: string
  color: string
  background: string
  default_duration_minutes: number
  is_active?: boolean
}) {
  const user = await requirePermission('scheduling', 'admin')
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('activity_types')
    .select('sort_order')
    .eq('org_id', user.orgId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1

  const { data, error } = await supabase
    .from('activity_types')
    .insert({
      org_id: user.orgId,
      name: input.name,
      slug: input.slug,
      color: input.color,
      background: input.background,
      default_duration_minutes: input.default_duration_minutes,
      is_active: input.is_active ?? true,
      sort_order: nextOrder,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  logActivity({
    supabase, user,
    entityType: 'activity_type', entityId: data.id,
    action: 'created',
    details: { name: input.name },
  })

  revalidatePath('/scheduling')
  revalidatePath('/scheduling/config/activity-types')
  return { data }
}

export async function updateActivityType(id: string, input: {
  name?: string
  slug?: string
  color?: string
  background?: string
  default_duration_minutes?: number
  is_active?: boolean
}) {
  const user = await requirePermission('scheduling', 'admin')
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {}
  if (input.name !== undefined) updates.name = input.name
  if (input.slug !== undefined) updates.slug = input.slug
  if (input.color !== undefined) updates.color = input.color
  if (input.background !== undefined) updates.background = input.background
  if (input.default_duration_minutes !== undefined) updates.default_duration_minutes = input.default_duration_minutes
  if (input.is_active !== undefined) updates.is_active = input.is_active

  const { error } = await supabase
    .from('activity_types')
    .update(updates)
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({
    supabase, user,
    entityType: 'activity_type', entityId: id,
    action: 'updated',
    details: { changed_fields: Object.keys(updates) },
  })

  revalidatePath('/scheduling')
  revalidatePath('/scheduling/config/activity-types')
  return { success: true }
}

export async function deleteActivityType(id: string) {
  const user = await requirePermission('scheduling', 'admin')
  const supabase = await createClient()

  const { count } = await supabase
    .from('activities')
    .select('id', { count: 'exact', head: true })
    .eq('activity_type_id', id)

  if (count && count > 0) {
    return { error: `Cannot delete — ${count} activities use this type. Deactivate it instead.` }
  }

  const { error } = await supabase
    .from('activity_types')
    .delete()
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({
    supabase, user,
    entityType: 'activity_type', entityId: id,
    action: 'deleted',
  })

  revalidatePath('/scheduling')
  revalidatePath('/scheduling/config/activity-types')
  return { success: true }
}

// ============================================================================
// ACTIVITIES
// ============================================================================

export interface CreateActivityInput {
  activity_type_id: string
  engineer_id: string
  title: string
  description?: string
  scheduled_date: string
  scheduled_time?: string
  duration_minutes: number
  all_day?: boolean
  notes?: string
}

export async function getActivities() {
  const user = await requirePermission('scheduling', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('activities')
    .select(`
      *,
      activity_type:activity_type_id(id, name, slug, color, background),
      engineer:engineer_id(id, first_name, last_name, initials, color)
    `)
    .eq('org_id', user.orgId)
    .order('scheduled_date')
    .order('scheduled_time')

  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function createActivity(input: CreateActivityInput) {
  const user = await requirePermission('scheduling', 'create')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('activities')
    .insert({
      org_id: user.orgId,
      activity_type_id: input.activity_type_id,
      engineer_id: input.engineer_id,
      title: input.title,
      description: input.description || null,
      scheduled_date: input.scheduled_date,
      scheduled_time: input.scheduled_time || null,
      duration_minutes: input.duration_minutes,
      all_day: input.all_day ?? false,
      notes: input.notes || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  logActivity({
    supabase, user,
    entityType: 'activity', entityId: data.id,
    action: 'created',
    details: { title: input.title, engineer_id: input.engineer_id, date: input.scheduled_date },
  })

  revalidatePath('/scheduling')
  return { data }
}

export async function deleteActivity(id: string) {
  const user = await requirePermission('scheduling', 'edit')
  const supabase = await createClient()

  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({
    supabase, user,
    entityType: 'activity', entityId: id,
    action: 'deleted',
  })

  revalidatePath('/scheduling')
  return { success: true }
}

export interface UpdateActivityInput {
  activity_type_id?: string
  engineer_id?: string
  title?: string
  description?: string | null
  scheduled_date?: string
  scheduled_time?: string | null
  duration_minutes?: number
  all_day?: boolean
  notes?: string | null
}

export async function updateActivity(id: string, input: UpdateActivityInput) {
  const user = await requirePermission('scheduling', 'edit')
  const supabase = await createClient()

  const updateData: Record<string, unknown> = {}
  if (input.activity_type_id !== undefined) updateData.activity_type_id = input.activity_type_id
  if (input.engineer_id !== undefined) updateData.engineer_id = input.engineer_id
  if (input.title !== undefined) updateData.title = input.title
  if (input.description !== undefined) updateData.description = input.description
  if (input.scheduled_date !== undefined) updateData.scheduled_date = input.scheduled_date
  if (input.scheduled_time !== undefined) updateData.scheduled_time = input.scheduled_time
  if (input.duration_minutes !== undefined) updateData.duration_minutes = input.duration_minutes
  if (input.all_day !== undefined) updateData.all_day = input.all_day
  if (input.notes !== undefined) updateData.notes = input.notes

  const { data, error } = await supabase
    .from('activities')
    .update(updateData)
    .eq('id', id)
    .eq('org_id', user.orgId)
    .select()
    .single()

  if (error) return { error: error.message }

  logActivity({
    supabase, user,
    entityType: 'activity', entityId: id,
    action: 'updated',
    details: { title: data.title, engineer_id: data.engineer_id, date: data.scheduled_date },
  })

  revalidatePath('/scheduling')
  return { data }
}

export async function dragMoveActivity(activityId: string, engineerId: string, date: string, time?: string) {
  const user = await requirePermission('scheduling', 'edit')
  const supabase = await createClient()

  const { error } = await supabase
    .from('activities')
    .update({
      engineer_id: engineerId,
      scheduled_date: date,
      scheduled_time: time || null,
    })
    .eq('id', activityId)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({
    supabase, user,
    entityType: 'activity', entityId: activityId,
    action: 'rescheduled',
    details: { engineer_id: engineerId, date, time },
  })

  revalidatePath('/scheduling')
  return { success: true }
}

// ============================================================================
// SCHEDULING SETTINGS (Working Hours / Travel Buffer)
// ============================================================================

export async function getSchedulingSettings(): Promise<{
  working_day_start: string
  working_day_end: string
  travel_buffer_minutes: number
}> {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data } = await supabase
    .from('org_settings')
    .select('setting_key, setting_value')
    .eq('org_id', user.orgId)
    .eq('category', 'scheduling')
    .in('setting_key', ['working_day_start', 'working_day_end', 'travel_buffer_minutes'])

  const result = {
    working_day_start: '08:00',
    working_day_end: '17:30',
    travel_buffer_minutes: 15,
  }

  if (data) {
    for (const row of data) {
      try {
        const val = JSON.parse(row.setting_value)
        if (row.setting_key === 'working_day_start') result.working_day_start = val
        else if (row.setting_key === 'working_day_end') result.working_day_end = val
        else if (row.setting_key === 'travel_buffer_minutes') result.travel_buffer_minutes = parseInt(val) || 15
      } catch { /* skip malformed */ }
    }
  }

  return result
}

export async function updateSchedulingSettings(input: {
  working_day_start: string
  working_day_end: string
  travel_buffer_minutes: number
}) {
  const user = await requirePermission('scheduling', 'admin')
  const supabase = await createClient()

  const settings = [
    { key: 'working_day_start', value: JSON.stringify(input.working_day_start) },
    { key: 'working_day_end', value: JSON.stringify(input.working_day_end) },
    { key: 'travel_buffer_minutes', value: JSON.stringify(input.travel_buffer_minutes) },
  ]

  for (const s of settings) {
    const { error } = await supabase
      .from('org_settings')
      .upsert(
        {
          org_id: user.orgId,
          category: 'scheduling',
          setting_key: s.key,
          setting_value: s.value,
        },
        { onConflict: 'org_id,setting_key' }
      )

    if (error) return { error: error.message }
  }

  logActivity({
    supabase, user,
    entityType: 'org_settings', entityId: user.orgId,
    action: 'updated',
    details: { category: 'scheduling', ...input },
  })

  return { success: true }
}

// ============================================================================
// INDIVIDUAL WORKING HOURS
// ============================================================================

export interface UserWorkingHoursEntry {
  day_of_week: number // 1=Mon ... 7=Sun
  is_working_day: boolean
  start_time: string | null // HH:MM or null (use org default)
  end_time: string | null
}

export interface UserWorkingHoursRow extends UserWorkingHoursEntry {
  id: string
  user_id: string
}

/**
 * Get individual working hours for a specific user.
 * Returns only rows that exist — absence means "use org defaults".
 */
export async function getUserWorkingHours(userId: string): Promise<{ data?: UserWorkingHoursRow[]; error?: string }> {
  await requirePermission('scheduling', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('user_working_hours')
    .select('id, user_id, day_of_week, is_working_day, start_time, end_time')
    .eq('user_id', userId)
    .order('day_of_week')

  if (error) return { error: error.message }
  return { data: data || [] }
}

/**
 * Get individual working hours for ALL engineers in the org (for calendar display).
 */
export async function getAllUserWorkingHours(): Promise<{ data?: UserWorkingHoursRow[]; error?: string }> {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('user_working_hours')
    .select('id, user_id, day_of_week, is_working_day, start_time, end_time')
    .eq('org_id', user.orgId)
    .order('day_of_week')

  if (error) return { error: error.message }
  return { data: data || [] }
}

/**
 * Save individual working hours for a user.
 * Upserts entries. Days not in the input are deleted (revert to org default).
 */
export async function updateUserWorkingHours(
  userId: string,
  entries: UserWorkingHoursEntry[]
): Promise<{ error?: string }> {
  const user = await requirePermission('scheduling', 'admin')
  const supabase = await createClient()

  // Delete existing rows for this user
  const { error: delError } = await supabase
    .from('user_working_hours')
    .delete()
    .eq('user_id', userId)
    .eq('org_id', user.orgId)

  if (delError) return { error: delError.message }

  // Filter out entries that are just "use defaults" (working day with no custom times)
  const rowsToInsert = entries
    .filter(e => !e.is_working_day || e.start_time || e.end_time)
    .map(e => ({
      user_id: userId,
      org_id: user.orgId,
      day_of_week: e.day_of_week,
      is_working_day: e.is_working_day,
      start_time: e.is_working_day ? (e.start_time || null) : null,
      end_time: e.is_working_day ? (e.end_time || null) : null,
    }))

  if (rowsToInsert.length > 0) {
    const { error: insError } = await supabase
      .from('user_working_hours')
      .insert(rowsToInsert)

    if (insError) return { error: insError.message }
  }

  logActivity({
    supabase, user,
    entityType: 'user_working_hours', entityId: userId,
    action: 'updated',
    details: { entries_count: rowsToInsert.length },
  })

  revalidatePath('/scheduling')
  return {}
}
