'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  JobCollectionWithDetails,
  CollectionSlipPublic,
  CreateCollectionLineInput,
} from './types'

// ============================================================================
// NUMBER GENERATION
// ============================================================================

async function generateCollectionNumber(supabase: SupabaseClient, orgId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `COL-${year}-`

  const { data: existing } = await supabase
    .from('job_collections')
    .select('slip_number')
    .eq('org_id', orgId)
    .like('slip_number', `${prefix}%`)
    .order('slip_number', { ascending: false })
    .limit(1)

  let seq = 1
  if (existing && existing.length > 0) {
    const last = existing[0].slip_number
    const parts = last.split('-')
    const lastSeq = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(lastSeq)) seq = lastSeq + 1
  }

  return `${prefix}${String(seq).padStart(4, '0')}`
}

// ============================================================================
// READS
// ============================================================================

export async function getCollections(filters?: {
  status?: string
  dateFrom?: string
  dateTo?: string
  engineerId?: string
}) {
  const user = await requirePermission('collections', 'view')
  const supabase = await createClient()

  let query = supabase
    .from('job_collections')
    .select(`
      *,
      jobs(id, job_number, title, assigned_to),
      sales_orders(id, so_number, customer_id, customers(id, name)),
      prepared_by_user:users!job_collections_prepared_by_fkey(id, first_name, last_name, initials, color, avatar_url),
      collected_by_user:users!job_collections_collected_by_fkey(id, first_name, last_name, initials, color, avatar_url)
    `)
    .eq('org_id', user.orgId)
    .order('created_at', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.dateFrom) {
    query = query.gte('created_at', filters.dateFrom)
  }
  if (filters?.dateTo) {
    query = query.lte('created_at', filters.dateTo + 'T23:59:59')
  }

  const { data, error } = await query

  if (error) {
    console.error('[getCollections]', error.message)
    return []
  }

  // If filtering by engineer, filter client-side (job's assigned_to)
  let results = data || []
  if (filters?.engineerId) {
    results = results.filter(
      (c: { jobs: { assigned_to: string | null } }) =>
        c.jobs?.assigned_to === filters.engineerId
    )
  }

  return results as JobCollectionWithDetails[]
}

export async function getCollection(id: string) {
  const user = await requirePermission('collections', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('job_collections')
    .select(`
      *,
      jobs(id, job_number, title, assigned_to),
      sales_orders(id, so_number, customer_id, customers(id, name)),
      prepared_by_user:users!job_collections_prepared_by_fkey(id, first_name, last_name, initials, color, avatar_url),
      collected_by_user:users!job_collections_collected_by_fkey(id, first_name, last_name, initials, color, avatar_url),
      job_collection_lines(
        id, collection_id, sales_order_line_id, product_id, description,
        quantity_expected, quantity_confirmed, expected_serials, confirmed_serials,
        is_confirmed, confirmed_at, notes, sort_order, created_at,
        products(id, sku, name)
      )
    `)
    .eq('id', id)
    .eq('org_id', user.orgId)
    .single()

  if (error) {
    console.error('[getCollection]', error.message)
    return null
  }

  return data as JobCollectionWithDetails
}

/** Fetch collection by token — admin client, no auth required (magic link) */
export async function getCollectionByToken(token: string): Promise<CollectionSlipPublic | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('job_collections')
    .select(`
      id, slip_number, status, collected_at, notes, job_id,
      jobs(id, job_number),
      sales_orders(customers(name)),
      collected_by_user:users!job_collections_collected_by_fkey(first_name, last_name),
      job_collection_lines(
        id, description, quantity_expected, quantity_confirmed,
        expected_serials, confirmed_serials, is_confirmed, notes, sort_order
      )
    `)
    .eq('slip_token', token)
    .single()

  if (error || !data) return null

  const job = data.jobs as unknown as { id: string; job_number: string } | null
  const so = data.sales_orders as unknown as { customers: { name: string } | null } | null
  const collectedByUser = data.collected_by_user as unknown as { first_name: string; last_name: string } | null
  const lines = ((data.job_collection_lines || []) as {
    id: string; description: string; quantity_expected: number; quantity_confirmed: number;
    expected_serials: string[] | null; confirmed_serials: string[] | null;
    is_confirmed: boolean; notes: string | null; sort_order: number
  }[]).sort((a, b) => a.sort_order - b.sort_order)

  return {
    id: data.id,
    slip_number: data.slip_number,
    status: data.status as CollectionSlipPublic['status'],
    collected_at: data.collected_at,
    collected_by_name: collectedByUser ? `${collectedByUser.first_name} ${collectedByUser.last_name}` : null,
    customer_name: so?.customers?.name || 'Unknown',
    job_number: job?.job_number || 'Unknown',
    job_id: job?.id || data.job_id,
    notes: data.notes,
    lines,
  }
}

export async function getCollectionsForJob(jobId: string) {
  const user = await requirePermission('collections', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('job_collections')
    .select(`
      *,
      prepared_by_user:users!job_collections_prepared_by_fkey(id, first_name, last_name, initials, color, avatar_url),
      collected_by_user:users!job_collections_collected_by_fkey(id, first_name, last_name, initials, color, avatar_url),
      job_collection_lines(id, description, quantity_expected, quantity_confirmed, is_confirmed, expected_serials, confirmed_serials)
    `)
    .eq('job_id', jobId)
    .eq('org_id', user.orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getCollectionsForJob]', error.message)
    return []
  }

  return data || []
}

export async function getCollectionsForSo(salesOrderId: string) {
  const user = await requirePermission('collections', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('job_collections')
    .select(`
      *,
      jobs(id, job_number, title),
      prepared_by_user:users!job_collections_prepared_by_fkey(id, first_name, last_name, initials, color, avatar_url),
      collected_by_user:users!job_collections_collected_by_fkey(id, first_name, last_name, initials, color, avatar_url),
      job_collection_lines(id, description, quantity_expected, quantity_confirmed, is_confirmed, expected_serials, confirmed_serials)
    `)
    .eq('sales_order_id', salesOrderId)
    .eq('org_id', user.orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getCollectionsForSo]', error.message)
    return []
  }

  return data || []
}

export async function getCollectionStats() {
  const user = await requirePermission('collections', 'view')
  const supabase = await createClient()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1) // Monday
  weekStart.setHours(0, 0, 0, 0)

  const [
    { count: pendingCount },
    { count: collectedTodayCount },
    { count: weekCount },
  ] = await Promise.all([
    supabase
      .from('job_collections')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', user.orgId)
      .eq('status', 'pending'),
    supabase
      .from('job_collections')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', user.orgId)
      .eq('status', 'collected')
      .gte('collected_at', todayStart.toISOString())
      .lte('collected_at', todayEnd.toISOString()),
    supabase
      .from('job_collections')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', user.orgId)
      .in('status', ['collected', 'partial'])
      .gte('collected_at', weekStart.toISOString()),
  ])

  return {
    pending: pendingCount || 0,
    collectedToday: collectedTodayCount || 0,
    thisWeek: weekCount || 0,
  }
}

// ============================================================================
// MUTATIONS
// ============================================================================

export async function createCollection(
  jobId: string | null,
  salesOrderId: string | null,
  lineItems: CreateCollectionLineInput[],
  notes?: string
) {
  const user = await requirePermission('collections', 'create')
  const supabase = await createClient()

  if (lineItems.length === 0) {
    return { error: 'At least one line item is required.' }
  }

  if (!jobId && !salesOrderId) {
    return { error: 'Either a job or sales order must be specified.' }
  }

  const slipNumber = await generateCollectionNumber(supabase, user.orgId)
  const slipToken = crypto.randomUUID()

  const { data: collection, error: colErr } = await supabase
    .from('job_collections')
    .insert({
      org_id: user.orgId,
      job_id: jobId || null,
      sales_order_id: salesOrderId,
      slip_number: slipNumber,
      slip_token: slipToken,
      status: 'pending',
      prepared_by: user.id,
      prepared_at: new Date().toISOString(),
      notes: notes || null,
    })
    .select('id, slip_token')
    .single()

  if (colErr || !collection) {
    console.error('[createCollection]', colErr?.message)
    return { error: colErr?.message || 'Failed to create collection.' }
  }

  // Insert lines
  const lineRows = lineItems.map((item, idx) => ({
    collection_id: collection.id,
    sales_order_line_id: item.sales_order_line_id || null,
    product_id: item.product_id,
    description: item.description,
    quantity_expected: item.quantity_expected,
    expected_serials: item.expected_serials || null,
    notes: item.notes || null,
    sort_order: item.sort_order ?? idx,
  }))

  const { error: lineErr } = await supabase
    .from('job_collection_lines')
    .insert(lineRows)

  if (lineErr) {
    console.error('[createCollection lines]', lineErr.message)
    // Clean up the header
    await supabase.from('job_collections').delete().eq('id', collection.id)
    return { error: lineErr.message }
  }

  const entityType = jobId ? 'job' : 'sales_order'
  const entityId = jobId || salesOrderId!

  logActivity({
    supabase,
    user,
    entityType,
    entityId,
    action: 'collection.created',
    details: { collection_id: collection.id, slip_number: slipNumber, line_count: lineItems.length },
  })

  revalidatePath('/collections')
  if (jobId) revalidatePath(`/scheduling/jobs/${jobId}`)
  if (salesOrderId) revalidatePath(`/orders/${salesOrderId}`)

  return { id: collection.id, slip_token: collection.slip_token }
}

export async function confirmCollection(
  token: string,
  confirmedLines: { lineId: string; quantityConfirmed: number; confirmedSerials?: string[]; notes?: string }[],
  notes?: string,
  gps?: { latitude: number; longitude: number; accuracy: number | null },
  signature?: { signaturePath: string | null; engineerName: string; engineerInitials: string }
) {
  const supabase = createAdminClient()

  // Fetch collection
  const { data: collection, error: fetchErr } = await supabase
    .from('job_collections')
    .select('id, job_id, sales_order_id, status, org_id')
    .eq('slip_token', token)
    .single()

  if (fetchErr || !collection) {
    return { error: 'Collection not found.' }
  }

  if (collection.status !== 'pending') {
    return { error: `Collection already ${collection.status}.` }
  }

  // Fetch all lines to determine overall status
  const { data: allLines } = await supabase
    .from('job_collection_lines')
    .select('id')
    .eq('collection_id', collection.id)

  const totalLineCount = allLines?.length || 0
  const confirmedLineIds = new Set(confirmedLines.map((l) => l.lineId))
  const now = new Date().toISOString()

  // Update each confirmed line
  for (const cl of confirmedLines) {
    await supabase
      .from('job_collection_lines')
      .update({
        is_confirmed: true,
        quantity_confirmed: cl.quantityConfirmed,
        confirmed_serials: cl.confirmedSerials || null,
        confirmed_at: now,
        notes: cl.notes || null,
      })
      .eq('id', cl.lineId)

    // Update serial registry for confirmed serials
    if (cl.confirmedSerials && cl.confirmedSerials.length > 0) {
      for (const serial of cl.confirmedSerials) {
        await supabase
          .from('serial_number_registry')
          .update({ status: 'collected', updated_at: now })
          .eq('serial_number', serial)
          .eq('org_id', collection.org_id)
          .eq('status', 'allocated')
      }
    }
  }

  // Determine overall status
  const allConfirmed = confirmedLineIds.size >= totalLineCount
  const newStatus = allConfirmed ? 'collected' : 'partial'

  // Update collection header
  await supabase
    .from('job_collections')
    .update({
      status: newStatus,
      collected_at: now,
      collection_latitude: gps?.latitude || null,
      collection_longitude: gps?.longitude || null,
      collection_accuracy: gps?.accuracy || null,
      engineer_signature_path: signature?.signaturePath || null,
      engineer_name: signature?.engineerName || null,
      engineer_initials: signature?.engineerInitials || null,
      notes: notes || null,
      updated_at: now,
    })
    .eq('id', collection.id)

  // Log activity (fire-and-forget via admin client)
  const logEntityType = collection.job_id ? 'job' : 'sales_order'
  const logEntityId = collection.job_id || collection.sales_order_id

  if (logEntityId) {
    await supabase.from('activity_log').insert({
      org_id: collection.org_id,
      user_id: null,
      entity_type: logEntityType,
      entity_id: logEntityId,
      action: newStatus === 'collected' ? 'collection.confirmed' : 'collection.partial',
      details: {
        collection_id: collection.id,
        confirmed_count: confirmedLines.length,
        total_count: totalLineCount,
      },
    })
  }

  return { success: true, status: newStatus }
}

export async function cancelCollection(id: string) {
  const user = await requirePermission('collections', 'edit')
  const supabase = await createClient()

  const { data: collection } = await supabase
    .from('job_collections')
    .select('id, job_id, sales_order_id, status')
    .eq('id', id)
    .eq('org_id', user.orgId)
    .single()

  if (!collection) return { error: 'Collection not found.' }
  if (collection.status !== 'pending') return { error: 'Only pending collections can be cancelled.' }

  const { error } = await supabase
    .from('job_collections')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  const entityType = collection.job_id ? 'job' : 'sales_order'
  const entityId = collection.job_id || collection.sales_order_id

  logActivity({
    supabase,
    user,
    entityType,
    entityId: entityId!,
    action: 'collection.cancelled',
    details: { collection_id: id },
  })

  revalidatePath('/collections')
  if (collection.job_id) revalidatePath(`/scheduling/jobs/${collection.job_id}`)
  if (collection.sales_order_id) revalidatePath(`/orders/${collection.sales_order_id}`)

  return { success: true }
}
